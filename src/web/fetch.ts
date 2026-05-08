import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { extractHtml, extractPlainText, truncateContent } from "./extract.ts";
import { getWebSecurityLimits, validatePublicHttpUrl } from "./security.ts";
import { storeResult } from "./storage.ts";
import type { ExtractedContent, FetchContentInput, WebToolError } from "./types.ts";

export interface FetchContentSuccess {
  responseId: string;
  results: ExtractedContent[];
}

export type FetchContentResult = FetchContentSuccess | WebToolError;

const MAX_REDIRECTS = 5;

function normalizeUrls(params: FetchContentInput): string[] {
  const urls = [params.url, ...(params.urls ?? [])]
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return [...new Set(urls)];
}

function error(code: string, message: string): WebToolError {
  return { error: { code, message } };
}

function isSupportedContentType(contentType: string): "html" | "text" | null {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "text/html") return "html";
  if (normalized === "text/plain") return "text";
  return null;
}

async function readLimitedBody(
  response: Response,
  maxBytes: number
): Promise<{ body: Uint8Array; truncated: boolean }> {
  if (!response.body) return { body: new Uint8Array(), truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = maxBytes - totalBytes;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }

      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        totalBytes += remaining;
        truncated = true;
        await reader.cancel();
        break;
      }

      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body, truncated };
}

async function fetchWithRedirects(
  initialUrl: URL,
  timeoutMs: number,
  maxResponseBytes: number
): Promise<{ response: Response; body: Uint8Array; finalUrl: string; bodyTruncated: boolean }> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
          "user-agent": "pi-subagents-web-tools/0.1",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Redirect without Location header: ${currentUrl.href}`);
        currentUrl = await validatePublicHttpUrl(new URL(location, currentUrl).href);
        continue;
      }

      const { body, truncated } = await readLimitedBody(response, maxResponseBytes);
      return { response, body, finalUrl: currentUrl.href, bodyTruncated: truncated };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Too many redirects for ${initialUrl.href}`);
}

function truncateExtractedContent(
  result: ExtractedContent,
  maxContentChars: number
): ExtractedContent {
  const truncated = truncateContent(result.content, maxContentChars);
  return {
    ...result,
    ...truncated,
    truncated: result.truncated || truncated.truncated,
  };
}

export async function fetchUrlContent(
  url: string,
  config: ResolvedExtensionConfig
): Promise<ExtractedContent> {
  const limits = getWebSecurityLimits(config);
  const parsedUrl = await validatePublicHttpUrl(url);
  const { response, body, finalUrl, bodyTruncated } = await fetchWithRedirects(
    parsedUrl,
    limits.timeoutMs,
    limits.maxResponseBytes
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${finalUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? "text/plain";
  const supportedType = isSupportedContentType(contentType);
  if (!supportedType) {
    throw new Error(`Unsupported content type for ${finalUrl}: ${contentType}`);
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(body);
  const options = { maxContentChars: Number.MAX_SAFE_INTEGER, contentType };
  const extracted =
    supportedType === "html"
      ? extractHtml(finalUrl, text, options)
      : extractPlainText(finalUrl, text, options);
  return bodyTruncated ? { ...extracted, truncated: true } : extracted;
}

export async function fetchContent(
  params: FetchContentInput,
  config: ResolvedExtensionConfig
): Promise<FetchContentResult> {
  const urls = normalizeUrls(params);
  if (urls.length === 0) {
    return error("INVALID_INPUT", "fetch_content requires url or urls");
  }

  try {
    const storedResults: ExtractedContent[] = [];
    for (const url of urls) {
      storedResults.push(await fetchUrlContent(url, config));
    }

    const responseId = storeResult({ type: "fetch", urls: storedResults });
    const limits = getWebSecurityLimits(config);
    const results = storedResults.map((result) =>
      truncateExtractedContent(result, limits.maxContentChars)
    );
    return { responseId, results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      return error("SUBAGENT_TIMEOUT", message);
    }
    return error("FETCH_CONTENT_FAILED", message);
  }
}
