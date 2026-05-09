import type { ResolvedExtensionConfig } from "../../shared/types.ts";
import { withTimeoutSignal } from "../abort.ts";
import { recordSearchCall, recordSearchFailure, recordSearchSuccess } from "../observability.ts";
import type { SearchResultItem } from "../types.ts";
import type { ProviderSearchParams, SearchProviderAdapter } from "./types.ts";

interface SearchHttpError extends Error {
  status: number;
  responseText?: string;
}

interface OpenSerpResultItem {
  title?: string;
  link?: string;
  url?: string;
  snippet?: string;
  description?: string;
}

interface OpenSerpResponse {
  organic_results?: OpenSerpResultItem[];
  results?: OpenSerpResultItem[];
}

function createSearchHttpError(
  status: number,
  statusText: string,
  responseText?: string
): SearchHttpError {
  const err = new Error(`OpenSERP returned HTTP ${status} ${statusText}`) as SearchHttpError;
  err.status = status;
  err.responseText = responseText;
  return err;
}

function getApiKey(config: ResolvedExtensionConfig): string | undefined {
  const keyName = config.webTools.openserp.apiKeyEnv;
  const value = process.env[keyName];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeResults(items: OpenSerpResultItem[], count: number): SearchResultItem[] {
  return items
    .map((item) => {
      const url = item.url ?? item.link ?? "";
      return {
        title: item.title ?? url,
        url,
        snippet: item.snippet ?? item.description,
        source: "openserp",
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
      `${config.webTools.openserp.apiKeyEnv} is required for web_search provider 'openserp'`
    );
  }

  const endpoint = new URL(config.webTools.openserp.baseUrl);
  endpoint.searchParams.set("q", params.query);
  endpoint.searchParams.set("num", String(params.numResults));

  const searchStart = recordSearchCall("openserp");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: withTimeoutSignal(config.webTools.timeoutMs, params.signal),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      recordSearchFailure("openserp", `HTTP_${response.status}`, searchStart);
      throw createSearchHttpError(response.status, response.statusText, responseText.slice(0, 300));
    }

    const data = (await response.json()) as OpenSerpResponse;
    recordSearchSuccess("openserp", searchStart);

    const items = data.organic_results ?? data.results ?? [];
    return normalizeResults(items, params.numResults);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
    ) {
      throw error;
    }
    recordSearchFailure("openserp", "WEB_SEARCH_NETWORK_ERROR", searchStart);
    throw error;
  }
}

function isAvailable(config: ResolvedExtensionConfig): boolean {
  if (!config.webTools.openserp.enabled) return false;
  try {
    const baseUrl = new URL(config.webTools.openserp.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return false;
    }
  } catch {
    return false;
  }
  return Boolean(getApiKey(config));
}

export const openserpProvider: SearchProviderAdapter = {
  name: "openserp",
  isAvailable,
  search,
};
