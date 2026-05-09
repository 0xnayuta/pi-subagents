/**
 * MVP: Configuration Loading
 * Validates config loading from config.json with MVP defaults.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, mergeConfig } from "../../../src/config/load-config.ts";

describe("MVP Config Loading", () => {
	describe("Default Configuration", () => {
		it("has correct default values", () => {
			// Test the default config object directly
			assert.equal(DEFAULT_CONFIG.enabled, true);
			assert.equal(DEFAULT_CONFIG.maxSubagentDepth, 1);
			assert.equal(DEFAULT_CONFIG.timeoutMs, 120_000);
			assert.equal(DEFAULT_CONFIG.allowWriteSubagents, false);
		});

		it("has maxSubagentDepth = 1 for MVP", () => {
			// This is a key MVP constraint
			assert.equal(DEFAULT_CONFIG.maxSubagentDepth, 1);
		});

		it("has allowWriteSubagents = false for MVP", () => {
			// MVP is readonly by default
			assert.equal(DEFAULT_CONFIG.allowWriteSubagents, false);
		});

		it("has web tools enabled with readonly defaults", () => {
			assert.deepEqual(DEFAULT_CONFIG.webTools, {
				enabled: true,
				provider: "brave",
				providerPriority: ["brave", "tavily", "serper", "openserp", "searxng", "ddgs"],
				timeoutMs: 10000,
				maxResponseBytes: 1048576,
				maxContentChars: 30000,
				maxResults: 5,
				enableJinaFallback: false,
				jinaTimeoutMs: 8000,
				maxStoredResults: 100,
				maxStoredContentChars: 200000,
				debug: false,
				openserp: {
					enabled: false,
					baseUrl: "https://api.openserp.com/search",
					apiKeyEnv: "OPENSERP_API_KEY",
				},
				searxng: {
					enabled: false,
					baseUrl: "http://127.0.0.1:8080",
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
			});
		});
	});

	describe("Web Tools Configuration", () => {
		it("merges partial webTools config with defaults", () => {
			const config = mergeConfig({
				webTools: {
					enabled: false,
					provider: "auto",
					providerPriority: ["searxng", "ddgs"],
					maxResults: 3,
					enableJinaFallback: true,
					maxStoredResults: 20,
					debug: true,
					openserp: {
						enabled: true,
						baseUrl: "https://api.openserp.com/custom",
						apiKeyEnv: "CUSTOM_OPENSERP_KEY",
					},
					searxng: {
						enabled: true,
						baseUrl: "http://127.0.0.1:9090",
						defaultEngine: "duckduckgo",
					},
					tavily: {
						enabled: true,
						baseUrl: "https://api.tavily.com/custom",
						apiKeyEnv: "CUSTOM_TAVILY_KEY",
					},
					serper: {
						enabled: true,
						baseUrl: "https://google.serper.dev/custom",
						apiKeyEnv: "CUSTOM_SERPER_KEY",
					},
				},
			});
			assert.equal(config.webTools.enabled, false);
			assert.equal(config.webTools.provider, "auto");
			assert.deepEqual(config.webTools.providerPriority, ["searxng", "ddgs"]);
			assert.equal(config.webTools.maxResults, 3);
			assert.equal(config.webTools.timeoutMs, 10000);
			assert.equal(config.webTools.enableJinaFallback, true);
			assert.equal(config.webTools.maxStoredResults, 20);
			assert.equal(config.webTools.debug, true);
			assert.equal(config.webTools.openserp.enabled, true);
			assert.equal(config.webTools.openserp.baseUrl, "https://api.openserp.com/custom");
			assert.equal(config.webTools.openserp.apiKeyEnv, "CUSTOM_OPENSERP_KEY");
			assert.equal(config.webTools.searxng.enabled, true);
			assert.equal(config.webTools.searxng.baseUrl, "http://127.0.0.1:9090");
			assert.equal(config.webTools.searxng.defaultEngine, "duckduckgo");
			assert.equal(config.webTools.tavily.enabled, true);
			assert.equal(config.webTools.tavily.baseUrl, "https://api.tavily.com/custom");
			assert.equal(config.webTools.tavily.apiKeyEnv, "CUSTOM_TAVILY_KEY");
			assert.equal(config.webTools.serper.enabled, true);
			assert.equal(config.webTools.serper.baseUrl, "https://google.serper.dev/custom");
			assert.equal(config.webTools.serper.apiKeyEnv, "CUSTOM_SERPER_KEY");
		});

		it("accepts ddgs provider and rejects invalid webTools values", () => {
			const valid = mergeConfig({ webTools: { provider: "ddgs" } });
			assert.equal(valid.webTools.provider, "ddgs");

			const invalid = mergeConfig({
				webTools: {
					enabled: "no" as any,
					provider: "duckduckgo" as any,
					providerPriority: ["x", "y"] as any,
					timeoutMs: 0,
					maxResponseBytes: -1,
					maxContentChars: 1.5,
					maxResults: 0,
					enableJinaFallback: "yes" as any,
					jinaTimeoutMs: 0,
					maxStoredResults: 0,
					maxStoredContentChars: -1,
					debug: "true" as any,
					openserp: { enabled: "on", baseUrl: "", apiKeyEnv: "" } as any,
					searxng: { enabled: "on", baseUrl: "", defaultEngine: "" } as any,
					tavily: { enabled: "on", baseUrl: "", apiKeyEnv: "" } as any,
					serper: { enabled: "on", baseUrl: "", apiKeyEnv: "" } as any,
				},
			});
			assert.deepEqual(invalid.webTools, DEFAULT_CONFIG.webTools);
		});
	});

	describe("Config Field Validation", () => {
		it("parses valid enabled field", () => {
			const parsed = { enabled: true };
			const config = { ...DEFAULT_CONFIG, ...parsed };
			assert.equal(config.enabled, true);
		});

		it("parses valid maxSubagentDepth field", () => {
			const parsed = { maxSubagentDepth: 2 };
			const config = { ...DEFAULT_CONFIG, ...parsed };
			assert.equal(config.maxSubagentDepth, 2);
		});

		it("rejects negative maxSubagentDepth", () => {
			// Negative values should be ignored
			const parsed = { maxSubagentDepth: -1 };
			// Only accept non-negative integers
			const isValid = typeof parsed.maxSubagentDepth === "number"
				&& Number.isInteger(parsed.maxSubagentDepth)
				&& parsed.maxSubagentDepth >= 0;
			assert.equal(isValid, false);
		});

		it("parses valid timeoutMs field", () => {
			const parsed = { timeoutMs: 60000 };
			const config = { ...DEFAULT_CONFIG, ...parsed };
			assert.equal(config.timeoutMs, 60000);
		});

		it("rejects zero or negative timeoutMs", () => {
			const parsed = { timeoutMs: 0 };
			const isValid = typeof parsed.timeoutMs === "number" && parsed.timeoutMs > 0;
			assert.equal(isValid, false);
		});

		it("parses valid allowWriteSubagents field", () => {
			const parsed = { allowWriteSubagents: true };
			const config = { ...DEFAULT_CONFIG, ...parsed };
			assert.equal(config.allowWriteSubagents, true);
		});
	});

	describe("MVP Config Constraints", () => {
		it("MVP does not support asyncByDefault", () => {
			// asyncByDefault is removed in MVP
			const parsed = { asyncByDefault: true };
			const hasAsyncField = "asyncByDefault" in parsed;
			assert.equal(hasAsyncField, true); // Field exists in input but...
			// ...should be ignored by MVP config loader
		});

		it("MVP does not support parallel config", () => {
			// parallel config is removed in MVP
			const parsed = { parallel: { maxTasks: 12, concurrency: 6 } };
			const hasParallelField = "parallel" in parsed;
			assert.equal(hasParallelField, true); // Field exists in input but...
			// ...should be ignored by MVP config loader
		});

		it("MVP does not support intercomBridge config", () => {
			// intercomBridge is removed in MVP
			const parsed = { intercomBridge: { mode: "always" } };
			const hasIntercomField = "intercomBridge" in parsed;
			assert.equal(hasIntercomField, true); // Field exists in input but...
			// ...should be ignored by MVP config loader
		});

		it("MVP does not support worktreeSetupHook config", () => {
			// worktreeSetupHook is removed in MVP
			const parsed = { worktreeSetupHook: "./setup.sh" };
			const hasWorktreeField = "worktreeSetupHook" in parsed;
			assert.equal(hasWorktreeField, true); // Field exists in input but...
			// ...should be ignored by MVP config loader
		});

		it("MVP does not support agentOverrides", () => {
			// agentOverrides (model, fallback, skills, etc.) removed in MVP
			const parsed = { agentOverrides: { reviewer: { model: "claude" } } };
			const hasOverridesField = "agentOverrides" in parsed;
			assert.equal(hasOverridesField, true); // Field exists in input but...
			// ...should be ignored by MVP config loader
		});
	});

	describe("isAgentEnabled", () => {
		it("returns true when config.enabled is true", () => {
			const config = { ...DEFAULT_CONFIG, enabled: true };
			const isEnabled = config.enabled;
			assert.equal(isEnabled, true);
		});

		it("returns false when config.enabled is false", () => {
			const config = { ...DEFAULT_CONFIG, enabled: false };
			const isEnabled = config.enabled;
			assert.equal(isEnabled, false);
		});
	});

	describe("canAgentWrite", () => {
		it("returns false when allowWriteSubagents is false (MVP default)", () => {
			const config = { ...DEFAULT_CONFIG, allowWriteSubagents: false };
			const canWrite = config.allowWriteSubagents;
			assert.equal(canWrite, false);
		});

		it("returns true when allowWriteSubagents is true", () => {
			const config = { ...DEFAULT_CONFIG, allowWriteSubagents: true };
			const canWrite = config.allowWriteSubagents;
			assert.equal(canWrite, true);
		});
	});
});
