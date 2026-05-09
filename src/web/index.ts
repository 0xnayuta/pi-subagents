import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { initializeSearchCache } from "./cache.ts";
import { initializeRequestThrottler } from "./concurrency.ts";
import { fetchContent } from "./fetch.ts";
import { initializeConnectionPool } from "./http-pool.ts";
import { configureWebObservability, resetWebToolStats } from "./observability.ts";
import {
  renderFetchContentCall,
  renderFetchContentResult,
  renderGetSearchContentCall,
  renderGetSearchContentResult,
  renderWebSearchCall,
  renderWebSearchResult,
} from "./renderers.ts";
import { FetchContentParams, GetSearchContentParams, WebSearchParams } from "./schemas.ts";
import { webSearch } from "./search.ts";
import {
  WEB_RESULTS_CUSTOM_TYPE,
  clearResults,
  getSearchContent,
  restoreResultsFromSession,
  setSessionResultAppender,
  setStorageLimits,
} from "./storage.ts";
import type { FetchContentInput, GetSearchContentInput, WebSearchInput } from "./types.ts";

// Re-export observability and error APIs for external access
export {
  getActivityLog,
  getDebugLevel,
  getWebToolStats,
  recordFetchActivity,
  recordSearchActivity,
  type ActivityEntry,
  type ProviderStats,
  type WebToolStats,
} from "./observability.ts";
export {
  createWebError,
  formatWebError,
  getErrorSummary,
  mapHttpStatusToError,
  mapNetworkErrorToWebError,
  WEB_ERROR_CODES,
  type RecoverySuggestion,
  type WebError,
  type WebErrorCode,
} from "./errors.ts";

// Re-export performance optimization APIs
export {
  getSearchCache,
  initializeSearchCache,
  resetSearchCache,
  type CacheConfig,
  type CacheStats,
  SearchResultCache,
} from "./cache.ts";
export {
  getRequestThrottler,
  initializeRequestThrottler,
  resetRequestThrottler,
  withThrottle,
  type ConcurrencyConfig,
  type ThrottlerStats,
  RequestThrottler,
  QueueFullError,
} from "./concurrency.ts";
export {
  getConnectionPool,
  initializeConnectionPool,
  resetConnectionPool,
  pooledFetch,
  type ConnectionPoolConfig,
  type PoolStats,
  HttpConnectionPool,
} from "./http-pool.ts";

function asToolResult(details: unknown): AgentToolResult<any> {
  return {
    content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
    details,
  };
}

/**
 * Register bundled readonly web tools.
 */
export function registerWebTools(pi: ExtensionAPI, config: ResolvedExtensionConfig): void {
  if (!config.webTools.enabled) return;

  // Initialize performance optimization modules
  initializeSearchCache(config.webTools.cache);
  initializeRequestThrottler(config.webTools.concurrency);
  initializeConnectionPool(config.webTools.connectionPool);

  configureWebObservability(config.webTools.debug);
  setStorageLimits({
    maxStoredResults: config.webTools.maxStoredResults,
    maxStoredContentChars: config.webTools.maxStoredContentChars,
  });

  const piAny = pi as any;
  if (typeof piAny.appendEntry === "function") {
    setSessionResultAppender((data) => {
      piAny.appendEntry(WEB_RESULTS_CUSTOM_TYPE, data);
    });
  } else {
    setSessionResultAppender(null);
  }

  if (typeof piAny.on === "function") {
    piAny.on("session_start", (_event: unknown, ctx: any) => {
      const branch = ctx?.sessionManager?.getBranch?.();
      if (Array.isArray(branch)) {
        restoreResultsFromSession(branch);
      } else {
        clearResults();
      }
      resetWebToolStats();
    });

    piAny.on("session_shutdown", () => {
      clearResults();
      resetWebToolStats();
    });
  }

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web with the configured readonly search provider.",
    parameters: WebSearchParams as any,
    execute(_id: string, params: WebSearchInput, signal: AbortSignal) {
      return webSearch(params, config, signal).then(asToolResult);
    },
    renderCall(args: WebSearchInput, theme: any) {
      return renderWebSearchCall(args, theme);
    },
    renderResult(
      result: AgentToolResult<any>,
      options: { expanded: boolean; isPartial: boolean },
      theme: any
    ) {
      return renderWebSearchResult(result, options, theme);
    },
  } as any);

  pi.registerTool({
    name: "fetch_content",
    label: "Fetch Content",
    description: "Fetch HTTP/HTTPS URL content and extract readable text. Readonly.",
    parameters: FetchContentParams as any,
    execute(_id: string, params: FetchContentInput, signal: AbortSignal) {
      return fetchContent(params, config, signal).then(asToolResult);
    },
    renderCall(args: FetchContentInput, theme: any) {
      return renderFetchContentCall(args, theme);
    },
    renderResult(
      result: AgentToolResult<any>,
      options: { expanded: boolean; isPartial: boolean },
      theme: any
    ) {
      return renderFetchContentResult(result, options, theme);
    },
  } as any);

  pi.registerTool({
    name: "get_search_content",
    label: "Get Search Content",
    description: "Retrieve stored web_search or fetch_content results by responseId. Readonly.",
    parameters: GetSearchContentParams as any,
    execute(_id: string, params: GetSearchContentInput) {
      return asToolResult(getSearchContent(params, config.webTools.maxContentChars));
    },
    renderCall(args: GetSearchContentInput, theme: any) {
      return renderGetSearchContentCall(args, theme);
    },
    renderResult(
      result: AgentToolResult<any>,
      options: { expanded: boolean; isPartial: boolean },
      theme: any
    ) {
      return renderGetSearchContentResult(result, options, theme);
    },
  } as any);
}

export type { FetchContentInput, GetSearchContentInput, WebSearchInput };
export { FetchContentParams, GetSearchContentParams, WebSearchParams };
