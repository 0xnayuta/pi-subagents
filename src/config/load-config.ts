/**
 * Configuration loader for pi-subagents MVP
 * Reads from ~/.pi/agent/extensions/subagent/config.json
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionConfig } from "../shared/types.ts";

// Config file path
function getConfigPath(): string {
	const base = os.homedir();
	return path.join(base, ".pi", "agent", "extensions", "subagent", "config.json");
}

// Default configuration for MVP
export const DEFAULT_CONFIG: Required<ExtensionConfig> = {
	enabled: true,
	maxSubagentDepth: 1,
	timeoutMs: 120_000,
	allowWriteSubagents: false,
};

/**
 * Load configuration from config.json
 * Returns default config if file doesn't exist or is invalid
 */
export function loadConfig(): Required<ExtensionConfig> {
	const configPath = getConfigPath();

	try {
		if (!fs.existsSync(configPath)) {
			return { ...DEFAULT_CONFIG };
		}

		const content = fs.readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content);

		// Merge with defaults
		const config: Required<ExtensionConfig> = { ...DEFAULT_CONFIG };

		if (typeof parsed.enabled === "boolean") {
			config.enabled = parsed.enabled;
		}

		if (typeof parsed.maxSubagentDepth === "number" && Number.isInteger(parsed.maxSubagentDepth) && parsed.maxSubagentDepth >= 0) {
			config.maxSubagentDepth = parsed.maxSubagentDepth;
		}

		if (typeof parsed.timeoutMs === "number" && parsed.timeoutMs > 0) {
			config.timeoutMs = parsed.timeoutMs;
		}

		if (typeof parsed.allowWriteSubagents === "boolean") {
			config.allowWriteSubagents = parsed.allowWriteSubagents;
		}

		return config;
	} catch {
		// Return defaults on any error (file not found, invalid JSON, etc.)
		return { ...DEFAULT_CONFIG };
	}
}

/**
 * Check if an agent is enabled in config
 */
export function isAgentEnabled(config: Required<ExtensionConfig>, agentName: string): boolean {
	// MVP: all agents are enabled by default unless explicitly disabled
	// In future, this could check subagents config
	return config.enabled;
}

/**
 * Check if an agent can use write tools
 */
export function canAgentWrite(config: Required<ExtensionConfig>, agentName: string): boolean {
	// MVP: write tools only allowed if allowWriteSubagents is true
	// In future, this could check per-agent config
	return config.allowWriteSubagents;
}
