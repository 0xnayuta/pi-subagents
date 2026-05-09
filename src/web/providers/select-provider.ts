import type { ResolvedExtensionConfig } from "../../shared/types.ts";
import type { WebToolError } from "../types.ts";
import { getSearchProvider } from "./registry.ts";
import type { SearchProviderAdapter, WebSearchProviderName } from "./types.ts";

export type ProviderSelection =
  | {
      ok: true;
      provider: SearchProviderAdapter;
      providers: SearchProviderAdapter[];
      mode: "explicit" | "auto";
    }
  | { ok: false; error: WebToolError };

const COMMERCIAL_PROVIDERS: WebSearchProviderName[] = ["tavily", "serper", "brave"];
const SELF_HOST_OR_OPEN_PROVIDERS: WebSearchProviderName[] = ["openserp", "searxng"];
const ZERO_CONFIG_PROVIDERS: WebSearchProviderName[] = ["ddgs"];
const ALL_PROVIDER_NAMES: WebSearchProviderName[] = [
  ...COMMERCIAL_PROVIDERS,
  ...SELF_HOST_OR_OPEN_PROVIDERS,
  ...ZERO_CONFIG_PROVIDERS,
];

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

function orderedTier(
  tier: WebSearchProviderName[],
  priority: WebSearchProviderName[]
): WebSearchProviderName[] {
  return priority.filter((name) => tier.includes(name));
}

function autoProviderOrder(config: ResolvedExtensionConfig): WebSearchProviderName[] {
  const priority = config.webTools.providerPriority.filter((name) =>
    ALL_PROVIDER_NAMES.includes(name)
  );
  return [
    ...orderedTier(COMMERCIAL_PROVIDERS, priority),
    ...orderedTier(SELF_HOST_OR_OPEN_PROVIDERS, priority),
    ...orderedTier(ZERO_CONFIG_PROVIDERS, priority),
  ];
}

export async function selectSearchProvider(
  config: ResolvedExtensionConfig
): Promise<ProviderSelection> {
  const configuredProvider = config.webTools.provider;

  if (configuredProvider === "auto") {
    const providerNames = autoProviderOrder(config);
    const providers: SearchProviderAdapter[] = [];

    for (const providerName of providerNames) {
      const candidate = getSearchProvider(providerName);
      if (await isAvailable(candidate, config)) {
        providers.push(candidate);
      }
    }

    if (providers.length > 0) {
      return { ok: true, provider: providers[0], providers, mode: "auto" };
    }

    return {
      ok: false,
      error: error(
        "WEB_SEARCH_FAILED",
        `No available web_search provider for auto mode. Tried: ${providerNames.join(", ")}.`
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
        "Configured web_search provider 'searxng' is unavailable. Enable webTools.searxng.enabled and configure webTools.searxng.baseUrl."
      ),
    };
  }

  if (
    configuredProvider === "searxng" &&
    !(await isAvailable(getSearchProvider("searxng"), config))
  ) {
    return {
      ok: false,
      error: error(
        "INVALID_INPUT",
        "Configured web_search provider 'searxng' is unavailable. Configure a valid webTools.searxng.baseUrl endpoint."
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

  const provider = getSearchProvider(configuredProvider as WebSearchProviderName);
  return { ok: true, provider, providers: [provider], mode: "explicit" };
}
