/**
 * MVP: Configuration Loading
 * Validates config loading from config.json with MVP defaults.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, mergeConfig } from "../../../src/config/load-config.ts";
import { MVP_ERROR_CODES } from "../../../src/shared/types.ts";
import { SubagentParams } from "../../../src/extension/schemas.ts";

describe("MVP Config Loading", () => {
	describe("Default Configuration", () => {
		it("has correct MVP default values", () => {
			assert.equal(DEFAULT_CONFIG.enabled, true);
			assert.equal(DEFAULT_CONFIG.maxSubagentDepth, 1);
			assert.equal(DEFAULT_CONFIG.timeoutMs, 120_000);
			assert.equal(DEFAULT_CONFIG.allowWriteSubagents, false);
			assert.equal(DEFAULT_CONFIG.webTools.enabled, true);
			assert.equal(DEFAULT_CONFIG.webTools.provider, "ddgs");
		});

		it("has correct webTools providerPriority", () => {
			assert.deepEqual(DEFAULT_CONFIG.webTools.providerPriority, [
				"tavily", "serper", "brave", "openserp", "searxng", "ddgs",
			]);
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
					searxng: { enabled: true, baseUrl: "http://127.0.0.1:9090" },
				},
			});
			assert.equal(config.webTools.enabled, false);
			assert.equal(config.webTools.provider, "auto");
			assert.deepEqual(config.webTools.providerPriority, ["searxng", "ddgs"]);
			assert.equal(config.webTools.maxResults, 3);
			assert.equal(config.webTools.searxng.enabled, true);
			assert.equal(config.webTools.searxng.baseUrl, "http://127.0.0.1:9090");
		});

		it("accepts valid provider, rejects invalid values", () => {
			const valid = mergeConfig({ webTools: { provider: "ddgs" } });
			assert.equal(valid.webTools.provider, "ddgs");

			const invalid = mergeConfig({
				webTools: { enabled: "no" as any, provider: "duckduckgo" as any },
			});
			assert.deepEqual(invalid.webTools, DEFAULT_CONFIG.webTools);
		});
	});

	describe("Config Field Validation", () => {
		it("validates depth and timeout ranges", () => {
			const isValidDepth = (v: number) => Number.isInteger(v) && v >= 0;
			assert.equal(isValidDepth(-1), false);
			assert.equal(isValidDepth(2), true);

			const isValidTimeout = (v: number) => typeof v === "number" && v > 0;
			assert.equal(isValidTimeout(0), false);
			assert.equal(isValidTimeout(60000), true);
		});
	});

	describe("MVP Error Codes", () => {
		it("has exactly 8 error codes", () => {
			assert.equal(Object.keys(MVP_ERROR_CODES).length, 8);
		});

		it("includes all required error codes", () => {
			assert.equal(MVP_ERROR_CODES.INVALID_INPUT, "INVALID_INPUT");
			assert.equal(MVP_ERROR_CODES.SUBAGENTS_DISABLED, "SUBAGENTS_DISABLED");
			assert.equal(MVP_ERROR_CODES.UNKNOWN_AGENT, "UNKNOWN_AGENT");
			assert.equal(MVP_ERROR_CODES.SUBAGENT_DISABLED, "SUBAGENT_DISABLED");
			assert.equal(MVP_ERROR_CODES.SUBAGENT_DEPTH_EXCEEDED, "SUBAGENT_DEPTH_EXCEEDED");
			assert.equal(MVP_ERROR_CODES.SUBAGENT_TIMEOUT, "SUBAGENT_TIMEOUT");
			assert.equal(MVP_ERROR_CODES.SUBAGENT_FAILED, "SUBAGENT_FAILED");
			assert.equal(MVP_ERROR_CODES.SUBAGENT_OUTPUT_TRUNCATED, "SUBAGENT_OUTPUT_TRUNCATED");
		});
	});

	describe("SubagentParams Schema (MVP)", () => {
		it("has required agent and task, excludes legacy params", () => {
			assert.equal(SubagentParams.properties.agent.type, "string");
			assert.equal(SubagentParams.properties.task.type, "string");

			const legacy = ["chain", "tasks", "async", "share", "worktree", "action", "id", "sessionDir", "control", "model", "skills"];
			for (const key of legacy) {
				assert.equal(SubagentParams.properties[key as keyof typeof SubagentParams.properties], undefined);
			}
		});
	});
});
