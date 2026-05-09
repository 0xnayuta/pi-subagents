import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  DebugLevel,
  ExtensionConfig,
  ResolvedExtensionConfig,
  ResolvedWebToolsConfig,
  WebSearchProviderName,
  WebToolsConfig,
} from "../shared/types.ts";

export const DEFAULT_WEB_TOOLS_CONFIG: ResolvedWebToolsConfig = {
  enabled: true,
  provider: "ddgs",
  providerPriority: ["tavily", "serper", "brave", "openserp", "searxng", "ddgs"],
  timeoutMs: 10000,
  maxResponseBytes: 1048576,
  maxContentChars: 30000,
  maxResults: 5,
  enableJinaFallback: false,
  jinaTimeoutMs: 8000,
  maxStoredResults: 100,
  maxStoredContentChars: 200000,
  debug: false,
  cache: {
    enabled: false,
    maxEntries: 50,
    ttlMs: 300000,
  },
  concurrency: {
    maxConcurrent: 3,
    maxQueueSize: 10,
  },
  connectionPool: {
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: 60000,
  },
  openserp: {
    enabled: false,
    baseUrl: "https://api.openserp.com/search",
    apiKeyEnv: "OPENSERP_API_KEY",
  },
  searxng: {
    enabled: false,
    baseUrl: "",
    defaultEngine: "google",
  },
  tavily: {
    enabled: false,
    baseUrl: "https://api.tavily.com/search",
    apiKeyEnv: "TAVILY_API_KEY",
  },
  serper: {
    enabled: false,
    baseUrl: "https://google.serper.dev/search",
    apiKeyEnv: "SERPER_API_KEY",
  },
};

export const DEFAULT_CONFIG: ResolvedExtensionConfig = {
  enabled: true,
  maxSubagentDepth: 1,
  timeoutMs: 120000,
  allowWriteSubagents: false,
  webTools: DEFAULT_WEB_TOOLS_CONFIG,
};

export function getConfigPath(): string {
  return path.join(
    process.env.HOME ?? os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "subagent",
    "config.json"
  );
}

export function loadConfig(configPath = getConfigPath()): ExtensionConfig {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8")) as ExtensionConfig;
    }
  } catch (error) {
    console.error(`Failed to load subagent config from '${configPath}':`, error);
  }
  return {};
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

const PROVIDER_NAMES: Exclude<WebSearchProviderName, "auto">[] = [
  "tavily",
  "serper",
  "brave",
  "openserp",
  "searxng",
  "ddgs",
];

function normalizeProvider(value: unknown): ResolvedWebToolsConfig["provider"] {
  return value === "brave" ||
    value === "ddgs" ||
    value === "auto" ||
    value === "openserp" ||
    value === "searxng" ||
    value === "tavily" ||
    value === "serper"
    ? value
    : DEFAULT_WEB_TOOLS_CONFIG.provider;
}

function normalizeProviderPriority(value: unknown): ResolvedWebToolsConfig["providerPriority"] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_WEB_TOOLS_CONFIG.providerPriority];
  }

  const filtered = value.filter(
    (item): item is Exclude<WebSearchProviderName, "auto"> =>
      typeof item === "string" &&
      PROVIDER_NAMES.includes(item as Exclude<WebSearchProviderName, "auto">)
  );

  if (filtered.length === 0) {
    return [...DEFAULT_WEB_TOOLS_CONFIG.providerPriority];
  }

  return [...new Set(filtered)];
}

function normalizeDebugLevel(value: unknown): DebugLevel {
  if (value === false || value === "minimal" || value === "verbose") {
    return value;
  }
  if (value === true) return "minimal";
  return DEFAULT_WEB_TOOLS_CONFIG.debug;
}

function normalizeWebToolsConfig(base: WebToolsConfig | undefined): ResolvedWebToolsConfig {
  return {
    enabled: booleanValue(base?.enabled, DEFAULT_WEB_TOOLS_CONFIG.enabled),
    provider: normalizeProvider(base?.provider),
    providerPriority: normalizeProviderPriority(base?.providerPriority),
    timeoutMs: positiveInteger(base?.timeoutMs, DEFAULT_WEB_TOOLS_CONFIG.timeoutMs),
    maxResponseBytes: positiveInteger(
      base?.maxResponseBytes,
      DEFAULT_WEB_TOOLS_CONFIG.maxResponseBytes
    ),
    maxContentChars: positiveInteger(
      base?.maxContentChars,
      DEFAULT_WEB_TOOLS_CONFIG.maxContentChars
    ),
    maxResults: positiveInteger(base?.maxResults, DEFAULT_WEB_TOOLS_CONFIG.maxResults),
    enableJinaFallback: booleanValue(
      base?.enableJinaFallback,
      DEFAULT_WEB_TOOLS_CONFIG.enableJinaFallback
    ),
    jinaTimeoutMs: positiveInteger(base?.jinaTimeoutMs, DEFAULT_WEB_TOOLS_CONFIG.jinaTimeoutMs),
    maxStoredResults: positiveInteger(
      base?.maxStoredResults,
      DEFAULT_WEB_TOOLS_CONFIG.maxStoredResults
    ),
    maxStoredContentChars: positiveInteger(
      base?.maxStoredContentChars,
      DEFAULT_WEB_TOOLS_CONFIG.maxStoredContentChars
    ),
    debug: normalizeDebugLevel(base?.debug),
    cache: {
      enabled: booleanValue(base?.cache?.enabled, DEFAULT_WEB_TOOLS_CONFIG.cache.enabled),
      maxEntries: positiveInteger(
        base?.cache?.maxEntries,
        DEFAULT_WEB_TOOLS_CONFIG.cache.maxEntries
      ),
      ttlMs: positiveInteger(base?.cache?.ttlMs, DEFAULT_WEB_TOOLS_CONFIG.cache.ttlMs),
    },
    concurrency: {
      maxConcurrent: positiveInteger(
        base?.concurrency?.maxConcurrent,
        DEFAULT_WEB_TOOLS_CONFIG.concurrency.maxConcurrent
      ),
      maxQueueSize: positiveInteger(
        base?.concurrency?.maxQueueSize,
        DEFAULT_WEB_TOOLS_CONFIG.concurrency.maxQueueSize
      ),
    },
    connectionPool: {
      maxSockets: positiveInteger(
        base?.connectionPool?.maxSockets,
        DEFAULT_WEB_TOOLS_CONFIG.connectionPool.maxSockets
      ),
      maxFreeSockets: positiveInteger(
        base?.connectionPool?.maxFreeSockets,
        DEFAULT_WEB_TOOLS_CONFIG.connectionPool.maxFreeSockets
      ),
      timeout: positiveInteger(
        base?.connectionPool?.timeout,
        DEFAULT_WEB_TOOLS_CONFIG.connectionPool.timeout
      ),
    },
    openserp: {
      enabled: booleanValue(base?.openserp?.enabled, DEFAULT_WEB_TOOLS_CONFIG.openserp.enabled),
      baseUrl:
        typeof base?.openserp?.baseUrl === "string" && base.openserp.baseUrl.trim().length > 0
          ? base.openserp.baseUrl.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.openserp.baseUrl,
      apiKeyEnv:
        typeof base?.openserp?.apiKeyEnv === "string" && base.openserp.apiKeyEnv.trim().length > 0
          ? base.openserp.apiKeyEnv.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.openserp.apiKeyEnv,
    },
    searxng: {
      enabled: booleanValue(base?.searxng?.enabled, DEFAULT_WEB_TOOLS_CONFIG.searxng.enabled),
      baseUrl:
        typeof base?.searxng?.baseUrl === "string"
          ? base.searxng.baseUrl.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.searxng.baseUrl,
      defaultEngine:
        typeof base?.searxng?.defaultEngine === "string" &&
        base.searxng.defaultEngine.trim().length > 0
          ? base.searxng.defaultEngine.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.searxng.defaultEngine,
    },
    tavily: {
      enabled: booleanValue(base?.tavily?.enabled, DEFAULT_WEB_TOOLS_CONFIG.tavily.enabled),
      baseUrl:
        typeof base?.tavily?.baseUrl === "string" && base.tavily.baseUrl.trim().length > 0
          ? base.tavily.baseUrl.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.tavily.baseUrl,
      apiKeyEnv:
        typeof base?.tavily?.apiKeyEnv === "string" && base.tavily.apiKeyEnv.trim().length > 0
          ? base.tavily.apiKeyEnv.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.tavily.apiKeyEnv,
    },
    serper: {
      enabled: booleanValue(base?.serper?.enabled, DEFAULT_WEB_TOOLS_CONFIG.serper.enabled),
      baseUrl:
        typeof base?.serper?.baseUrl === "string" && base.serper.baseUrl.trim().length > 0
          ? base.serper.baseUrl.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.serper.baseUrl,
      apiKeyEnv:
        typeof base?.serper?.apiKeyEnv === "string" && base.serper.apiKeyEnv.trim().length > 0
          ? base.serper.apiKeyEnv.trim()
          : DEFAULT_WEB_TOOLS_CONFIG.serper.apiKeyEnv,
    },
  };
}

export function mergeConfig(base: ExtensionConfig): ResolvedExtensionConfig {
  return {
    enabled: booleanValue(base.enabled, DEFAULT_CONFIG.enabled),
    maxSubagentDepth: nonNegativeInteger(base.maxSubagentDepth, DEFAULT_CONFIG.maxSubagentDepth),
    timeoutMs: positiveInteger(base.timeoutMs, DEFAULT_CONFIG.timeoutMs),
    allowWriteSubagents: booleanValue(base.allowWriteSubagents, DEFAULT_CONFIG.allowWriteSubagents),
    webTools: normalizeWebToolsConfig(base.webTools),
  };
}
