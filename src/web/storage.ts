import { randomUUID } from "node:crypto";
import type {
  ExtractedContent,
  GetSearchContentInput,
  QueryResultData,
  StoredResult,
  WebToolError,
} from "./types.ts";

const results = new Map<string, StoredResult>();

export interface GetSearchContentSuccess {
  responseId: string;
  result: StoredResult | ExtractedContent | QueryResultData;
}

export type GetSearchContentResult = GetSearchContentSuccess | WebToolError;

export function storeResult(result: StoredResult): string {
  const responseId = randomUUID();
  results.set(responseId, result);
  return responseId;
}

export function getResult(responseId: string): StoredResult | undefined {
  return results.get(responseId);
}

export function clearResults(): void {
  results.clear();
}

function error(code: string, message: string): WebToolError {
  return { error: { code, message } };
}

function truncateText(
  value: string,
  maxContentChars: number
): { content: string; truncated: boolean } {
  if (value.length <= maxContentChars) return { content: value, truncated: false };
  return { content: value.slice(0, maxContentChars), truncated: true };
}

function limitExtractedContent(
  result: ExtractedContent,
  maxContentChars: number
): ExtractedContent {
  return {
    ...result,
    ...truncateText(result.content, maxContentChars),
  };
}

function limitQueryResult(result: QueryResultData, maxContentChars: number): QueryResultData {
  return {
    ...result,
    results: result.results.map((item) => ({
      ...item,
      content: item.content ? limitExtractedContent(item.content, maxContentChars) : undefined,
    })),
  };
}

function limitStoredResult(result: StoredResult, maxContentChars: number): StoredResult {
  if (result.type === "fetch") {
    return {
      type: "fetch",
      urls: result.urls.map((item) => limitExtractedContent(item, maxContentChars)),
    };
  }

  return {
    type: "search",
    queries: result.queries.map((query) => limitQueryResult(query, maxContentChars)),
  };
}

function selectFetchResult(
  stored: ExtractedContent[],
  params: GetSearchContentInput
): ExtractedContent | undefined {
  if (typeof params.urlIndex === "number") return stored[params.urlIndex];
  if (params.url) return stored.find((result) => result.url === params.url);
  return undefined;
}

function selectSearchResult(
  stored: QueryResultData[],
  params: GetSearchContentInput
): QueryResultData | undefined {
  if (typeof params.queryIndex === "number") return stored[params.queryIndex];
  if (params.query) return stored.find((result) => result.query === params.query);
  return undefined;
}

export function getSearchContent(
  params: GetSearchContentInput,
  maxContentChars: number
): GetSearchContentResult {
  const responseId = typeof params.responseId === "string" ? params.responseId.trim() : "";
  if (!responseId) {
    return error("INVALID_INPUT", "get_search_content requires responseId");
  }

  const stored = getResult(responseId);
  if (!stored) {
    return error("NOT_FOUND", `No stored web result found for responseId: ${responseId}`);
  }

  if (stored.type === "fetch") {
    const selected = selectFetchResult(stored.urls, params);
    if (selected) {
      return { responseId, result: limitExtractedContent(selected, maxContentChars) };
    }
    if (params.url || typeof params.urlIndex === "number") {
      return error("NOT_FOUND", "No fetch result matched the requested url/urlIndex");
    }
  }

  if (stored.type === "search") {
    const selected = selectSearchResult(stored.queries, params);
    if (selected) {
      return { responseId, result: limitQueryResult(selected, maxContentChars) };
    }
    if (params.query || typeof params.queryIndex === "number") {
      return error("NOT_FOUND", "No search result matched the requested query/queryIndex");
    }
  }

  return { responseId, result: limitStoredResult(stored, maxContentChars) };
}
