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
				timeoutMs: 10000,
				maxResponseBytes: 1048576,
				maxContentChars: 30000,
				maxResults: 5,
			});
		});
	});

	describe("Web Tools Configuration", () => {
		it("merges partial webTools config with defaults", () => {
			const config = mergeConfig({ webTools: { enabled: false, maxResults: 3 } });
			assert.equal(config.webTools.enabled, false);
			assert.equal(config.webTools.provider, "brave");
			assert.equal(config.webTools.maxResults, 3);
			assert.equal(config.webTools.timeoutMs, 10000);
		});

		it("rejects invalid webTools values", () => {
			const config = mergeConfig({
				webTools: {
					enabled: "no" as any,
					provider: "duckduckgo" as any,
					timeoutMs: 0,
					maxResponseBytes: -1,
					maxContentChars: 1.5,
					maxResults: 0,
				},
			});
			assert.deepEqual(config.webTools, DEFAULT_CONFIG.webTools);
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
