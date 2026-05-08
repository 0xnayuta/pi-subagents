import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { truncateContent } from "./extract.ts";
import { fetchUrlContent } from "./fetch.ts";
import { storeResult } from "./storage.ts";
import type { QueryResultData, SearchResultItem, WebSearchInput, WebToolError } from "./types.ts";

export interface WebSearchSuccess {
  responseId: string;
  queries: QueryResultData[];
}

export type WebSearchResult = WebSearchSuccess | WebToolError;

const MAX_QUERIES = 5;
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
  config: ResolvedExtensionConfig
): Promise<SearchResultItem[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is required for web_search provider 'brave'");
  }

  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.webTools.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip",
        "x-subscription-token": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API returned HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;
    return (data.web?.results ?? [])
      .filter((item) => typeof item.url === "string" && typeof item.title === "string")
      .slice(0, count)
      .map((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.description,
        source: item.profile?.name ?? "brave",
      }));
  } finally {
    clearTimeout(timeout);
  }
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

async function attachContent(
  queries: QueryResultData[],
  config: ResolvedExtensionConfig
): Promise<QueryResultData[]> {
  const output: QueryResultData[] = [];

  for (const query of queries) {
    const results: SearchResultItem[] = [];
    for (const result of query.results) {
      try {
        results.push({
          ...result,
          content: await fetchUrlContent(result.url, config),
        });
      } catch {
        results.push(result);
      }
    }
    output.push({ ...query, results });
  }

  return output;
}

export async function webSearch(
  params: WebSearchInput,
  config: ResolvedExtensionConfig
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
        results: await braveSearch(query, numResults, config),
      });
    }

    if (params.includeContent === true) {
      queryResults = await attachContent(queryResults, config);
    }

    const responseId = storeResult({ type: "search", queries: queryResults });
    return {
      responseId,
      queries: limitSearchOutput(queryResults, config.webTools.maxContentChars),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      return error("SUBAGENT_TIMEOUT", message);
    }
    return error("WEB_SEARCH_FAILED", message);
  }
}
