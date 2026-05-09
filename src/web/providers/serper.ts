import type { ResolvedExtensionConfig } from "../../shared/types.ts";
import { withTimeoutSignal } from "../abort.ts";
import { recordSearchCall, recordSearchFailure, recordSearchSuccess } from "../observability.ts";
import type { SearchResultItem } from "../types.ts";
import type { ProviderSearchParams, SearchProviderAdapter } from "./types.ts";

interface SearchHttpError extends Error {
  status: number;
  responseText?: string;
}

interface SerperResultItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperResultItem[];
}

function createSearchHttpError(
  status: number,
  statusText: string,
  responseText?: string
): SearchHttpError {
  const err = new Error(`Serper returned HTTP ${status} ${statusText}`) as SearchHttpError;
  err.status = status;
  err.responseText = responseText;
  return err;
}

function getApiKey(config: ResolvedExtensionConfig): string | undefined {
  const value = process.env[config.webTools.serper.apiKeyEnv];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeResults(items: SerperResultItem[], count: number): SearchResultItem[] {
  return items
    .map((item) => {
      const url = item.link ?? "";
      return {
        title: item.title ?? url,
        url,
        snippet: item.snippet,
        source: "serper",
      };
    })
    .filter((item) => item.url.length > 0)
    .slice(0, count);
}

async function search(
  params: ProviderSearchParams,
  config: ResolvedExtensionConfig
): Promise<SearchResultItem[]> {
  const apiKey = getApiKey(config);
  if (!apiKey) {
    throw new Error(
      `${config.webTools.serper.apiKeyEnv} is required for web_search provider 'serper'`
    );
  }

  const searchStart = recordSearchCall("serper");

  try {
    const response = await fetch(config.webTools.serper.baseUrl, {
      method: "POST",
      signal: withTimeoutSignal(config.webTools.timeoutMs, params.signal),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        q: params.query,
        num: params.numResults,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      recordSearchFailure("serper", `HTTP_${response.status}`, searchStart);
      throw createSearchHttpError(response.status, response.statusText, responseText.slice(0, 300));
    }

    const data = (await response.json()) as SerperResponse;
    recordSearchSuccess("serper", searchStart);
    return normalizeResults(data.organic ?? [], params.numResults);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
    ) {
      throw error;
    }
    recordSearchFailure("serper", "WEB_SEARCH_NETWORK_ERROR", searchStart);
    throw error;
  }
}

function isAvailable(config: ResolvedExtensionConfig): boolean {
  try {
    const baseUrl = new URL(config.webTools.serper.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return Boolean(getApiKey(config));
}

export const serperProvider: SearchProviderAdapter = {
  name: "serper",
  isAvailable,
  search,
};
