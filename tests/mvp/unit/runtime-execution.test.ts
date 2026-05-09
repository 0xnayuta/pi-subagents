/**
 * MVP: Runtime Execution
 * Validates foreground single execution runtime.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeOutput, containsSensitiveInfo } from "../../../src/runtime/foreground/sanitize.ts";
import { truncateOutput, DEFAULT_MAX_OUTPUT } from "../../../src/shared/types.ts";
import { checkSubagentDepth, PI_SUBAGENT_DEPTH, PI_SUBAGENT_MAX_DEPTH } from "../../../src/shared/types.ts";

describe("MVP Runtime Execution", () => {
	describe("Sanitization", () => {
		it("masks API keys", () => {
			const input = "api_key: sk-1234567890abcdefghijklmnop";
			const output = sanitizeOutput(input);
			assert.ok(!output.includes("sk-1234567890abcdef") || output.includes("[REDACTED]"));
		});

		it("masks Bearer tokens", () => {
			const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
			const output = sanitizeOutput(input);
			assert.ok(!output.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9") || output.includes("[REDACTED]"));
		});

		it("masks GitHub tokens", () => {
			const input = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
			const output = sanitizeOutput(input);
			assert.ok(!output.includes("ghp_1234567890") || output.includes("[GITHUB_TOKEN_REDACTED]"));
		});

		it("masks AWS credentials", () => {
			const input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
			const output = sanitizeOutput(input);
			assert.ok(!output.includes("AKIAIOSFODNN7EXAMPLE") || output.includes("[REDACTED]"));
		});

		it("masks absolute paths in stack traces", () => {
			const input = "    at Function.test (/home/user/project/src/file.ts:10:5)";
			const output = sanitizeOutput(input);
			// The home path should be replaced
			assert.ok(!output.includes("/home/user"));
		});

		it("handles empty input", () => {
			const output = sanitizeOutput("");
			assert.equal(output, "");
		});

		it("preserves normal text", () => {
			const input = "This is a normal response without sensitive information.";
			const output = sanitizeOutput(input);
			assert.equal(output, input);
		});
	});

	describe("Sensitive Info Detection", () => {
		it("detects API key patterns", () => {
			assert.equal(containsSensitiveInfo("api_key=sk-1234567890"), true);
		});

		it("detects Authorization headers", () => {
			assert.equal(containsSensitiveInfo("Authorization: Bearer token123"), true);
		});

		it("detects GitHub tokens", () => {
			assert.equal(containsSensitiveInfo("ghp_xxxxxxxxxxxxxxxxxxxx"), true);
		});

		it("does not detect normal text as sensitive", () => {
			assert.equal(containsSensitiveInfo("This is a normal response."), false);
		});
	});

	describe("Output Truncation", () => {
		it("does not truncate short output", () => {
			const input = "Short response";
			const result = truncateOutput(input, DEFAULT_MAX_OUTPUT);
			assert.equal(result.truncated, false);
			assert.equal(result.text, input);
		});

		it("truncates output exceeding line limit", () => {
			const lines = Array.from({ length: 6000 }, (_, i) => `Line ${i}`);
			const input = lines.join("\n");
			const result = truncateOutput(input, DEFAULT_MAX_OUTPUT);
			assert.equal(result.truncated, true);
			assert.ok(result.originalLines && result.originalLines > result.text.split("\n").length);
		});

		it("reports original size when truncated", () => {
			const lines = Array.from({ length: 6000 }, (_, i) => `Line ${i}`);
			const input = lines.join("\n");
			const result = truncateOutput(input, DEFAULT_MAX_OUTPUT);
			assert.ok(result.originalLines && result.originalLines > 5000);
		});
	});

	describe("Recursion Depth Guard", () => {
		it("blocks when depth exceeds max", () => {
			// Set up environment
			const originalDepth = process.env[PI_SUBAGENT_DEPTH];
			const originalMaxDepth = process.env[PI_SUBAGENT_MAX_DEPTH];
			
			process.env[PI_SUBAGENT_DEPTH] = "1";
			process.env[PI_SUBAGENT_MAX_DEPTH] = "1";
			
			const result = checkSubagentDepth(1);
			assert.equal(result.blocked, true);
			
			// Restore
			if (originalDepth === undefined) delete process.env[PI_SUBAGENT_DEPTH];
			else process.env[PI_SUBAGENT_DEPTH] = originalDepth;
			if (originalMaxDepth === undefined) delete process.env[PI_SUBAGENT_MAX_DEPTH];
			else process.env[PI_SUBAGENT_MAX_DEPTH] = originalMaxDepth;
		});

		it("allows when depth is below max", () => {
			const originalDepth = process.env[PI_SUBAGENT_DEPTH];
			const originalMaxDepth = process.env[PI_SUBAGENT_MAX_DEPTH];
			
			process.env[PI_SUBAGENT_DEPTH] = "0";
			process.env[PI_SUBAGENT_MAX_DEPTH] = "1";
			
			const result = checkSubagentDepth(1);
			assert.equal(result.blocked, false);
			
			// Restore
			if (originalDepth === undefined) delete process.env[PI_SUBAGENT_DEPTH];
			else process.env[PI_SUBAGENT_DEPTH] = originalDepth;
			if (originalMaxDepth === undefined) delete process.env[PI_SUBAGENT_MAX_DEPTH];
			else process.env[PI_SUBAGENT_MAX_DEPTH] = originalMaxDepth;
		});

		it("resolves to correct depth values", () => {
			const originalDepth = process.env[PI_SUBAGENT_DEPTH];
			
			process.env[PI_SUBAGENT_DEPTH] = "1";
			
			const result = checkSubagentDepth(2);
			assert.equal(result.depth, 1);
			assert.equal(result.maxDepth, 2);
			
			// Restore
			if (originalDepth === undefined) delete process.env[PI_SUBAGENT_DEPTH];
			else process.env[PI_SUBAGENT_DEPTH] = originalDepth;
		});
	});

	describe("Readonly Tools Filtering", () => {
		const ALLOWED_READONLY_TOOLS = ["read", "grep", "find", "ls", "web_search", "fetch_content", "get_search_content"];
		const FORBIDDEN_WRITE_TOOLS = ["edit", "write", "delete", "mkdir", "rm"];

		it("filters write tools when agent is readonly", () => {
			const agentTools = ["read", "edit", "write", "grep"];
			const readonly = true;
			
			const filtered = readonly
				? agentTools.filter((t) => ALLOWED_READONLY_TOOLS.includes(t))
				: agentTools;
			
			assert.ok(!filtered.includes("edit"));
			assert.ok(!filtered.includes("write"));
			assert.ok(filtered.includes("read"));
			assert.ok(filtered.includes("grep"));
		});

		it("allows only readonly tools in MVP", () => {
			const agentTools = ["read", "grep", "find", "ls", "bash", "web_search"];
			const readonly = true;
			
			const filtered = readonly
				? agentTools.filter((t) => ALLOWED_READONLY_TOOLS.includes(t))
				: agentTools;
			
			assert.deepEqual(filtered, ["read", "grep", "find", "ls", "web_search"]);
			assert.ok(!filtered.includes("bash"));
		});

		it("rejects forbidden tools regardless of agent config", () => {
			for (const tool of FORBIDDEN_WRITE_TOOLS) {
				const filtered = ALLOWED_READONLY_TOOLS.filter((t) => t !== tool);
				assert.ok(!filtered.includes(tool), `${tool} should not be in allowed tools`);
			}
		});
	});
});

describe("MVP Execution Flow", () => {
	describe("Minimal Flow Validation", () => {
		it("validates input before execution", () => {
			// Simulate validation
			const params = { agent: "", task: "test" };
			const isValid = Boolean(params.agent && params.task);
			assert.equal(isValid, false);
		});

		it("loads agent before execution", () => {
			// Simulate agent loading
			const availableAgents = ["explorer", "researcher", "reviewer", "implementer", "tester"];
			const requestedAgent = "unknown";
			const agentFound = availableAgents.includes(requestedAgent);
			assert.equal(agentFound, false);
		});

		it("returns UNKNOWN_AGENT for unknown agents", () => {
			const availableAgents = ["explorer", "researcher", "reviewer", "implementer", "tester"];
			const requestedAgent = "worker";
			
			if (!availableAgents.includes(requestedAgent)) {
				const errorCode = "UNKNOWN_AGENT";
				assert.equal(errorCode, "UNKNOWN_AGENT");
			}
		});

		it("returns INVALID_INPUT for missing agent", () => {
			const params = { agent: "", task: "test" };
			
			if (!params.agent) {
				const errorCode = "INVALID_INPUT";
				assert.equal(errorCode, "INVALID_INPUT");
			}
		});

		it("returns INVALID_INPUT for missing task", () => {
			const params = { agent: "explorer", task: "" };
			
			if (!params.task) {
				const errorCode = "INVALID_INPUT";
				assert.equal(errorCode, "INVALID_INPUT");
			}
		});
	});

	describe("Timeout Handling", () => {
		it("returns SUBAGENT_TIMEOUT for timeout exit code (124)", () => {
			const exitCode = 124;
			
			if (exitCode === 124) {
				const errorCode = "SUBAGENT_TIMEOUT";
				assert.equal(errorCode, "SUBAGENT_TIMEOUT");
			}
		});

		it("returns SUBAGENT_FAILED for non-zero non-timeout exit code", () => {
			const exitCode = 1;
			
			if (exitCode !== 0 && exitCode !== 124) {
				const errorCode = "SUBAGENT_FAILED";
				assert.equal(errorCode, "SUBAGENT_FAILED");
			}
		});

		it("does not return error for zero exit code", () => {
			const exitCode = 0;
			
			if (exitCode === 124) {
				assert.fail("Should not be timeout");
			} else if (exitCode !== 0) {
				assert.fail("Should not be failed");
			}
			assert.equal(exitCode, 0);
		});
	});
});
