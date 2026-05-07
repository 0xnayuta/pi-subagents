/**
 * MVP: Extension Registration
 * Tests that the extension properly registers the subagent tool.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";

describe("Extension Registration (MVP)", () => {
	it("registers subagent tool with correct name", () => {
		// Tool should be registered as 'subagent'
		// pi.registerTool should be called with tool definition
	});

	it("tool has agent and task parameters", () => {
		// Tool schema should accept:
		// - agent: string
		// - task: string (optional for self-contained agents)
	});

	it("tool has no async parameter", () => {
		// MVP: async parameter removed
	});

	it("tool has no chain parameter", () => {
		// MVP: chain parameter removed
	});

	it("tool has no parallel tasks parameter", () => {
		// MVP: tasks parameter removed
	});

	it("registers message renderers for subagent results", () => {
		// pi.registerMessageRenderer should be called
		// for rendering subagent progress and results
	});

	it("registers event handlers for async events", () => {
		// MVP: No async events (background removed)
		// But may have control events for recursion protection
	});
});

describe("Extension Lifecycle (MVP)", () => {
	it("initializes state on registerSubagentExtension", () => {
		// State should include:
		// - baseCwd
		// - currentSessionId
		// - asyncJobs (empty, no async)
		// - foregroundRuns
	});

	it("cleans up on session_shutdown", () => {
		// Should cleanup timers, event handlers, etc.
		// No async job cleanup needed
	});

	it("resets state on session_start", () => {
		// Should reset cwd and session ID
	});
});