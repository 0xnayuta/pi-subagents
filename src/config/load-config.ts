import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionConfig, ResolvedExtensionConfig, WebToolsConfig } from "../shared/types.ts";

export const DEFAULT_WEB_TOOLS_CONFIG: Required<WebToolsConfig> = {
  enabled: true,
  provider: "brave",
  timeoutMs: 10000,
  maxResponseBytes: 1048576,
  maxContentChars: 30000,
  maxResults: 5,
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

function normalizeWebToolsConfig(base: WebToolsConfig | undefined): Required<WebToolsConfig> {
  return {
    enabled: booleanValue(base?.enabled, DEFAULT_WEB_TOOLS_CONFIG.enabled),
    provider: base?.provider === "brave" ? base.provider : DEFAULT_WEB_TOOLS_CONFIG.provider,
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
