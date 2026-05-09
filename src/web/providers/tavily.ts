import type { ResolvedExtensionConfig } from "../../shared/types.ts";
import { withTimeoutSignal } from "../abort.ts";
import { recordSearchCall, recordSearchFailure, recordSearchSuccess } from "../observability.ts";
import type { SearchResultItem } from "../types.ts";
import type { ProviderSearchParams, SearchProviderAdapter } from "./types.ts";

interface SearchHttpError extends Error {
  status: number;
  responseText?: string;
}

interface TavilyResultItem {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResultItem[];
}

function createSearchHttpError(
  status: number,
  statusText: string,
  responseText?: string
): SearchHttpError {
  const err = new Error(`Tavily returned HTTP ${status} ${statusText}`) as SearchHttpError;
  err.status = status;
  err.responseText = responseText;
  return err;
}

function getApiKey(config: ResolvedExtensionConfig): string | undefined {
  const value = process.env[config.webTools.tavily.apiKeyEnv];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeResults(items: TavilyResultItem[], count: number): SearchResultItem[] {
  return items
    .map((item) => ({
      title: item.title ?? item.url ?? "Untitled",
      url: item.url ?? "",
      snippet: item.content,
      source: "tavily",
    }))
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
      `${config.webTools.tavily.apiKeyEnv} is required for web_search provider 'tavily'`
    );
  }

  const searchStart = recordSearchCall("tavily");

  try {
    const response = await fetch(config.webTools.tavily.baseUrl, {
      method: "POST",
      signal: withTimeoutSignal(config.webTools.timeoutMs, params.signal),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: params.query,
        max_results: params.numResults,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      recordSearchFailure("tavily", `HTTP_${response.status}`, searchStart);
      throw createSearchHttpError(response.status, response.statusText, responseText.slice(0, 300));
    }

    const data = (await response.json()) as TavilyResponse;
    recordSearchSuccess("tavily", searchStart);
    return normalizeResults(data.results ?? [], params.numResults);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
    ) {
      throw error;
    }
    recordSearchFailure("tavily", "WEB_SEARCH_NETWORK_ERROR", searchStart);
    throw error;
  }
}

function isAvailable(config: ResolvedExtensionConfig): boolean {
  if (!config.webTools.tavily.enabled) return false;
  try {
    const baseUrl = new URL(config.webTools.tavily.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return Boolean(getApiKey(config));
}

export const tavilyProvider: SearchProviderAdapter = {
  name: "tavily",
  isAvailable,
  search,
};
