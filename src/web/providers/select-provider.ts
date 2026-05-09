import type { ResolvedExtensionConfig } from "../../shared/types.ts";
import type { WebToolError } from "../types.ts";
import { getSearchProvider } from "./registry.ts";
import type { SearchProviderAdapter, WebSearchProviderName } from "./types.ts";

export type ProviderSelection =
  | { ok: true; provider: SearchProviderAdapter }
  | { ok: false; error: WebToolError };

function error(code: string, message: string): WebToolError {
  return { error: { code, message } };
}

async function isAvailable(
  provider: SearchProviderAdapter,
  config: ResolvedExtensionConfig
): Promise<boolean> {
  if (provider.isAvailable === undefined) return true;
  try {
    return await provider.isAvailable(config);
  } catch {
    return false;
  }
}

export async function selectSearchProvider(
  config: ResolvedExtensionConfig
): Promise<ProviderSelection> {
  const configuredProvider = config.webTools.provider;

  if (configuredProvider === "auto") {
    const candidates = config.webTools.providerPriority.map((name) => getSearchProvider(name));

    for (const candidate of candidates) {
      if (await isAvailable(candidate, config)) {
        return { ok: true, provider: candidate };
      }
    }

    return {
      ok: false,
      error: error(
        "WEB_SEARCH_FAILED",
        `No available web_search provider for auto mode. Tried: ${config.webTools.providerPriority.join(", ")}.`
      ),
    };
  }

  if (
    configuredProvider !== "brave" &&
    configuredProvider !== "ddgs" &&
    configuredProvider !== "openserp" &&
    configuredProvider !== "searxng" &&
    configuredProvider !== "tavily" &&
    configuredProvider !== "serper"
  ) {
    return {
      ok: false,
      error: error("INVALID_INPUT", `Unsupported web_search provider: ${configuredProvider}`),
    };
  }

  if (configuredProvider === "openserp" && !config.webTools.openserp.enabled) {
    return {
      ok: false,
      error: error(
        "INVALID_INPUT",
        "Configured web_search provider 'openserp' is unavailable. Enable webTools.openserp.enabled and check provider settings."
      ),
    };
  }

  if (configuredProvider === "searxng" && !config.webTools.searxng.enabled) {
    return {
      ok: false,
      error: error(
        "INVALID_INPUT",
        "Configured web_search provider 'searxng' is unavailable. Enable webTools.searxng.enabled and check provider settings."
      ),
    };
  }

  if (configuredProvider === "tavily" && !config.webTools.tavily.enabled) {
    return {
      ok: false,
      error: error(
        "INVALID_INPUT",
        "Configured web_search provider 'tavily' is unavailable. Enable webTools.tavily.enabled and check provider settings."
      ),
    };
  }

  if (configuredProvider === "serper" && !config.webTools.serper.enabled) {
    return {
      ok: false,
      error: error(
        "INVALID_INPUT",
        "Configured web_search provider 'serper' is unavailable. Enable webTools.serper.enabled and check provider settings."
      ),
    };
  }

  return { ok: true, provider: getSearchProvider(configuredProvider as WebSearchProviderName) };
}
