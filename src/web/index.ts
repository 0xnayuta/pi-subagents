import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedExtensionConfig } from "../shared/types.ts";
import { fetchContent } from "./fetch.ts";
import { FetchContentParams, GetSearchContentParams, WebSearchParams } from "./schemas.ts";
import { webSearch } from "./search.ts";
import { getSearchContent } from "./storage.ts";
import type { FetchContentInput, GetSearchContentInput, WebSearchInput } from "./types.ts";

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

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web with the configured readonly search provider.",
    parameters: WebSearchParams as any,
    execute(_id: string, params: WebSearchInput) {
      return webSearch(params, config).then(asToolResult);
    },
  } as any);

  pi.registerTool({
    name: "fetch_content",
    label: "Fetch Content",
    description: "Fetch HTTP/HTTPS URL content and extract readable text. Readonly.",
    parameters: FetchContentParams as any,
    execute(_id: string, params: FetchContentInput) {
      return fetchContent(params, config).then(asToolResult);
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
  } as any);
}

export type { FetchContentInput, GetSearchContentInput, WebSearchInput };
export { FetchContentParams, GetSearchContentParams, WebSearchParams };
