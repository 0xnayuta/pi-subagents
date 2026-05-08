import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { isAbortLikeError, withTimeoutSignal } from "./abort.ts";
import { truncateContent } from "./extract.ts";
import { fetchUrlContent } from "./fetch.ts";
import {
  recordSearchCall,
  recordSearchFailure,
  recordSearchSuccess,
  webDebugLog,
} from "./observability.ts";
import { storeResult } from "./storage.ts";
import type { QueryResultData, SearchResultItem, WebSearchInput, WebToolError } from "./types.ts";

export interface WebSearchSuccess {
  responseId: string;
  queries: QueryResultData[];
}

export type WebSearchResult = WebSearchSuccess | WebToolError;

const MAX_QUERIES = 5;
const INCLUDE_CONTENT_CONCURRENCY = 3;
const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

interface BraveSearchResult {
  title?: string;
  url?: string;
  description?: string;
  profile?: {
    name?: string;
  };
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

interface SearchHttpError extends Error {
  status: number;
  responseText?: string;
}

function createSearchHttpError(
  status: number,
  statusText: string,
  responseText?: string
): SearchHttpError {
  const err = new Error(
    `Brave Search API returned HTTP ${status} ${statusText}`
  ) as SearchHttpError;
  err.status = status;
  err.responseText = responseText;
  return err;
}

function error(code: string, message: string): WebToolError {
  return { error: { code, message } };
}

function normalizeQueries(params: WebSearchInput): string[] {
  const queries = [params.query, ...(params.queries ?? [])]
    .filter((query): query is string => typeof query === "string")
    .map((query) => query.trim())
    .filter((query) => query.length > 0);
  return [...new Set(queries)].slice(0, MAX_QUERIES);
}

function normalizeNumResults(params: WebSearchInput, config: ResolvedExtensionConfig): number {
  const requested = params.numResults;
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return config.webTools.maxResults;
  }
  return Math.min(Math.max(Math.floor(requested), 1), config.webTools.maxResults);
}

function getBraveApiKey(): string | undefined {
  const value = process.env.BRAVE_SEARCH_API_KEY;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function braveSearch(
  query: string,
  count: number,
  config: ResolvedExtensionConfig,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is required for web_search provider 'brave'");
  }

  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));

  const searchStart = recordSearchCall("brave");
  const response = await fetch(url, {
    method: "GET",
    signal: withTimeoutSignal(config.webTools.timeoutMs, signal),
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip",
      "x-subscription-token": apiKey,
    },
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    recordSearchFailure("brave", `HTTP_${response.status}`, searchStart);
    throw createSearchHttpError(response.status, response.statusText, responseText.slice(0, 300));
  }

  const data = (await response.json()) as BraveSearchResponse;
  recordSearchSuccess("brave", searchStart);
  return (data.web?.results ?? [])
    .filter((item) => typeof item.url === "string" && typeof item.title === "string")
    .slice(0, count)
    .map((item) => ({
      title: item.title ?? item.url ?? "Untitled",
      url: item.url ?? "",
      snippet: item.description,
      source: item.profile?.name ?? "brave",
    }));
}

function limitSearchOutput(queries: QueryResultData[], maxContentChars: number): QueryResultData[] {
  return queries.map((query) => ({
    ...query,
    results: query.results.map((result) => ({
      ...result,
      content: result.content
        ? {
            ...result.content,
            ...truncateContent(result.content.content, maxContentChars),
          }
        : undefined,
    })),
  }));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const output = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.min(safeConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return output;
}

async function attachContent(
  queries: QueryResultData[],
  config: ResolvedExtensionConfig,
  signal?: AbortSignal
): Promise<QueryResultData[]> {
  const output: QueryResultData[] = [];

  for (const query of queries) {
    const results = await mapWithConcurrency(
      query.results,
      INCLUDE_CONTENT_CONCURRENCY,
      async (result): Promise<SearchResultItem> => {
        try {
          return {
            ...result,
            content: await fetchUrlContent(result.url, config, signal),
          };
        } catch {
          return result;
        }
      }
    );

    output.push({ ...query, results });
  }

  return output;
}

function classifySearchError(err: unknown): WebToolError {
  if (isAbortLikeError(err)) {
    recordSearchFailure("brave", "SUBAGENT_TIMEOUT", Date.now());
    return error(
      "SUBAGENT_TIMEOUT",
      "web_search timed out or was aborted. Try fewer queries, smaller numResults, or increase webTools.timeoutMs."
    );
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("BRAVE_SEARCH_API_KEY")) {
    recordSearchFailure("brave", "WEB_SEARCH_AUTH_REQUIRED", Date.now());
    return error(
      "WEB_SEARCH_AUTH_REQUIRED",
      "Brave provider requires BRAVE_SEARCH_API_KEY. Set it in environment and retry."
    );
  }

  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as any).status === "number"
      ? (err as any).status
      : undefined;

  if (status === 401 || status === 403) {
    recordSearchFailure("brave", "WEB_SEARCH_AUTH_REQUIRED", Date.now());
    return error(
      "WEB_SEARCH_AUTH_REQUIRED",
      `Brave Search authentication failed (HTTP ${status}). Check BRAVE_SEARCH_API_KEY and account permissions.`
    );
  }

  if (status === 429) {
    recordSearchFailure("brave", "WEB_SEARCH_RATE_LIMIT", Date.now());
    return error(
      "WEB_SEARCH_RATE_LIMIT",
      "Brave Search rate limit reached (HTTP 429). Retry later or reduce query frequency."
    );
  }

  if (typeof status === "number" && status >= 500) {
    recordSearchFailure("brave", "WEB_SEARCH_PROVIDER_ERROR", Date.now());
    return error(
      "WEB_SEARCH_PROVIDER_ERROR",
      `Brave Search provider temporary error (HTTP ${status}). Retry later.`
    );
  }

  const lower = message.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econn")) {
    recordSearchFailure("brave", "WEB_SEARCH_NETWORK_ERROR", Date.now());
    return error(
      "WEB_SEARCH_NETWORK_ERROR",
      `Network error while calling Brave Search: ${message}. Check network connectivity and DNS.`
    );
  }

  recordSearchFailure("brave", "WEB_SEARCH_FAILED", Date.now());
  return error("WEB_SEARCH_FAILED", message);
}

export async function webSearch(
  params: WebSearchInput,
  config: ResolvedExtensionConfig,
  signal?: AbortSignal
): Promise<WebSearchResult> {
  const queries = normalizeQueries(params);
  if (queries.length === 0) {
    return error("INVALID_INPUT", "web_search requires query or queries");
  }

  if (config.webTools.provider !== "brave") {
    return error("INVALID_INPUT", `Unsupported web_search provider: ${config.webTools.provider}`);
  }

  const numResults = normalizeNumResults(params, config);

  try {
    let queryResults: QueryResultData[] = [];
    for (const query of queries) {
      queryResults.push({
        query,
        results: await braveSearch(query, numResults, config, signal),
      });
    }

    if (params.includeContent === true) {
      queryResults = await attachContent(queryResults, config, signal);
    }

    const responseId = storeResult({ type: "search", queries: queryResults });
    webDebugLog("web_search success", {
      queries: queryResults.length,
      responseId,
      includeContent: params.includeContent === true,
    });
    return {
      responseId,
      queries: limitSearchOutput(queryResults, config.webTools.maxContentChars),
    };
  } catch (err) {
    const classified = classifySearchError(err);
    webDebugLog("web_search failed", {
      code: classified.error.code,
      message: classified.error.message,
    });
    return classified;
  }
}
