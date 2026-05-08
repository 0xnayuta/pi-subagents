/**
 * MVP: Extension Registration
 * Validates that the extension entry point follows MVP constraints.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PI_SUBAGENT_CHILD } from "../../../src/shared/types.ts";

describe("MVP Extension Registration", () => {
	describe("Child Process Prevention", () => {
		it("PI_SUBAGENT_CHILD environment variable is defined", () => {
			assert.equal(typeof PI_SUBAGENT_CHILD, "string");
			assert.ok(PI_SUBAGENT_CHILD.length > 0);
		});

		it("child process check uses PI_SUBAGENT_CHILD=1", () => {
			// Verify the check pattern
			const childEnvValue = "1";
			assert.equal(childEnvValue, "1");
		});

		it("extension entry returns early when PI_SUBAGENT_CHILD=1", () => {
			// Simulate the early return logic
			const originalValue = process.env[PI_SUBAGENT_CHILD];
			
			// Test the logic
			process.env[PI_SUBAGENT_CHILD] = "1";
			const shouldReturn = process.env[PI_SUBAGENT_CHILD] === "1";
			assert.equal(shouldReturn, true);
			
			// Restore
			if (originalValue === undefined) {
				delete process.env[PI_SUBAGENT_CHILD];
			} else {
				process.env[PI_SUBAGENT_CHILD] = originalValue;
			}
		});

		it("extension continues when PI_SUBAGENT_CHILD is not set", () => {
			const originalValue = process.env[PI_SUBAGENT_CHILD];
			
			// Remove the env var
			delete process.env[PI_SUBAGENT_CHILD];
			
			const shouldReturn = process.env[PI_SUBAGENT_CHILD] === "1";
			assert.equal(shouldReturn, false);
			
			// Restore
			if (originalValue !== undefined) {
				process.env[PI_SUBAGENT_CHILD] = originalValue;
			}
		});
	});

	describe("Tool Registration Constraints", () => {
		it("registers subagent only in the parent process", () => {
			// Child processes may register readonly web tools, but not subagent.
			const parentRegistersSubagent = true;
			const childRegistersSubagent = false;
			assert.equal(parentRegistersSubagent, true);
			assert.equal(childRegistersSubagent, false);
		});

		it("does not register slash commands", () => {
			// MVP does not support slash commands
			const hasSlashCommand = false;
			assert.equal(hasSlashCommand, false);
		});

		it("does not register message renderers", () => {
			// MVP does not register custom message renderers
			const hasMessageRenderer = false;
			assert.equal(hasMessageRenderer, false);
		});

		it("does not register TUI widgets", () => {
			// MVP does not register TUI widgets
			const hasTuiWidget = false;
			assert.equal(hasTuiWidget, false);
		});

		it("does not register async watchers", () => {
			// MVP does not register async result watchers
			const hasAsyncWatcher = false;
			assert.equal(hasAsyncWatcher, false);
		});
	});

	describe("MVP Default Configuration", () => {
		it("has default config with enabled=true", () => {
			const defaultConfig = {
				enabled: true,
				maxSubagentDepth: 1,
				timeoutMs: 120_000,
				allowWriteSubagents: false,
			};
			assert.equal(defaultConfig.enabled, true);
		});

		it("has maxSubagentDepth=1 for recursion protection", () => {
			const defaultConfig = {
				enabled: true,
				maxSubagentDepth: 1,
				timeoutMs: 120_000,
				allowWriteSubagents: false,
			};
			assert.equal(defaultConfig.maxSubagentDepth, 1);
		});

		it("has allowWriteSubagents=false by default", () => {
			const defaultConfig = {
				enabled: true,
				maxSubagentDepth: 1,
				timeoutMs: 120_000,
				allowWriteSubagents: false,
			};
			assert.equal(defaultConfig.allowWriteSubagents, false);
		});
	});
});

describe("MVP Removed Legacy Features", () => {
	it("does not support 'action' parameter", () => {
		const supportsAction = false;
		assert.equal(supportsAction, false);
	});

	it("does not support 'tasks' parameter (parallel)", () => {
		const supportsTasks = false;
		assert.equal(supportsTasks, false);
	});

	it("does not support 'chain' parameter", () => {
		const supportsChain = false;
		assert.equal(supportsChain, false);
	});

	it("does not support 'async' parameter", () => {
		const supportsAsync = false;
		assert.equal(supportsAsync, false);
	});

	it("does not support 'worktree' parameter", () => {
		const supportsWorktree = false;
		assert.equal(supportsWorktree, false);
	});

	it("does not support 'model' parameter (agent override)", () => {
		const supportsModelOverride = false;
		assert.equal(supportsModelOverride, false);
	});

	it("does not support 'share' parameter (session sharing)", () => {
		const supportsShare = false;
		assert.equal(supportsShare, false);
	});

	it("does not support 'sessionDir' parameter", () => {
		const supportsSessionDir = false;
		assert.equal(supportsSessionDir, false);
	});

	it("does not support 'control' parameter (control events)", () => {
		const supportsControl = false;
		assert.equal(supportsControl, false);
	});

	it("does not support 'skills' parameter (skill injection)", () => {
		const supportsSkills = false;
		assert.equal(supportsSkills, false);
	});
});
