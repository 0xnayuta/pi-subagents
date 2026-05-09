import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { isAbortLikeError } from "./abort.ts";
import { truncateContent } from "./extract.ts";
import { fetchUrlContent } from "./fetch.ts";
import { recordSearchFailure, webDebugLog } from "./observability.ts";
import { selectSearchProvider } from "./providers/select-provider.ts";
import { storeResult } from "./storage.ts";
import type { QueryResultData, SearchResultItem, WebSearchInput, WebToolError } from "./types.ts";

export interface WebSearchSuccess {
  responseId: string;
  queries: QueryResultData[];
}

export type WebSearchResult = WebSearchSuccess | WebToolError;

const MAX_QUERIES = 5;
const INCLUDE_CONTENT_CONCURRENCY = 3;

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

function providerDisplayName(providerName: string): string {
  if (providerName === "brave") return "Brave Search";
  if (providerName === "ddgs") return "DuckDuckGo Lite";
  if (providerName === "openserp") return "OpenSERP";
  if (providerName === "searxng") return "SearXNG";
  if (providerName === "tavily") return "Tavily";
  if (providerName === "serper") return "Serper";
  return providerName;
}

function classifySearchError(err: unknown, providerName: string): WebToolError {
  const displayName = providerDisplayName(providerName);
  if (isAbortLikeError(err)) {
    recordSearchFailure(providerName, "SUBAGENT_TIMEOUT", Date.now());
    return error(
      "SUBAGENT_TIMEOUT",
      "web_search timed out or was aborted. Try fewer queries, smaller numResults, or increase webTools.timeoutMs."
    );
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("BRAVE_SEARCH_API_KEY")) {
    recordSearchFailure(providerName, "WEB_SEARCH_AUTH_REQUIRED", Date.now());
    return error(
      "WEB_SEARCH_AUTH_REQUIRED",
      "Brave provider requires BRAVE_SEARCH_API_KEY. Set it in environment and retry."
    );
  }

  if (message.includes("is required for web_search provider")) {
    recordSearchFailure(providerName, "WEB_SEARCH_AUTH_REQUIRED", Date.now());
    return error(
      "WEB_SEARCH_AUTH_REQUIRED",
      `${displayName} requires credentials from configured environment variables. Check provider config and retry.`
    );
  }

  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;

  if (status === 401 || status === 403) {
    recordSearchFailure(providerName, "WEB_SEARCH_AUTH_REQUIRED", Date.now());
    return error(
      "WEB_SEARCH_AUTH_REQUIRED",
      `${displayName} authentication failed (HTTP ${status}). Check provider credentials and account permissions.`
    );
  }

  if (status === 429) {
    recordSearchFailure(providerName, "WEB_SEARCH_RATE_LIMIT", Date.now());
    return error(
      "WEB_SEARCH_RATE_LIMIT",
      `${displayName} rate limit reached (HTTP 429). Retry later or reduce query frequency.`
    );
  }

  if (typeof status === "number" && status >= 500) {
    recordSearchFailure(providerName, "WEB_SEARCH_PROVIDER_ERROR", Date.now());
    return error(
      "WEB_SEARCH_PROVIDER_ERROR",
      `${displayName} temporary provider error (HTTP ${status}). Retry later.`
    );
  }

  const lower = message.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econn")) {
    recordSearchFailure(providerName, "WEB_SEARCH_NETWORK_ERROR", Date.now());
    return error(
      "WEB_SEARCH_NETWORK_ERROR",
      `Network error while calling ${displayName}: ${message}. Check network connectivity and DNS.`
    );
  }

  recordSearchFailure(providerName, "WEB_SEARCH_FAILED", Date.now());
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

  const selection = await selectSearchProvider(config);
  if (!selection.ok) {
    return selection.error;
  }

  const provider = selection.provider;
  const numResults = normalizeNumResults(params, config);

  try {
    let queryResults: QueryResultData[] = [];
    for (const query of queries) {
      queryResults.push({
        query,
        results: await provider.search({ query, numResults, signal }, config),
      });
    }

    if (params.includeContent === true) {
      queryResults = await attachContent(queryResults, config, signal);
    }

    const responseId = storeResult({ type: "search", queries: queryResults });
    webDebugLog("web_search success", {
      provider: provider.name,
      queries: queryResults.length,
      responseId,
      includeContent: params.includeContent === true,
    });
    return {
      responseId,
      queries: limitSearchOutput(queryResults, config.webTools.maxContentChars),
    };
  } catch (err) {
    const classified = classifySearchError(err, provider.name);
    webDebugLog("web_search failed", {
      provider: provider.name,
      code: classified.error.code,
      message: classified.error.message,
    });
    return classified;
  }
}
