/**
 * MVP: Error Codes
 * Validates that proper MVP error codes are defined and used.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MVP_ERROR_CODES } from "../../../src/shared/types.ts";

describe("MVP Error Codes", () => {
	it("defines INVALID_INPUT error code", () => {
		assert.equal(MVP_ERROR_CODES.INVALID_INPUT, "INVALID_INPUT");
	});

	it("defines SUBAGENTS_DISABLED error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENTS_DISABLED, "SUBAGENTS_DISABLED");
	});

	it("defines UNKNOWN_AGENT error code", () => {
		assert.equal(MVP_ERROR_CODES.UNKNOWN_AGENT, "UNKNOWN_AGENT");
	});

	it("defines SUBAGENT_DISABLED error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENT_DISABLED, "SUBAGENT_DISABLED");
	});

	it("defines SUBAGENT_DEPTH_EXCEEDED error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENT_DEPTH_EXCEEDED, "SUBAGENT_DEPTH_EXCEEDED");
	});

	it("defines SUBAGENT_TIMEOUT error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENT_TIMEOUT, "SUBAGENT_TIMEOUT");
	});

	it("defines SUBAGENT_FAILED error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENT_FAILED, "SUBAGENT_FAILED");
	});

	it("defines SUBAGENT_OUTPUT_TRUNCATED error code", () => {
		assert.equal(MVP_ERROR_CODES.SUBAGENT_OUTPUT_TRUNCATED, "SUBAGENT_OUTPUT_TRUNCATED");
	});

	it("has exactly 8 error codes", () => {
		const errorCodeCount = Object.keys(MVP_ERROR_CODES).length;
		assert.equal(errorCodeCount, 8);
	});

	it("error codes are all uppercase strings", () => {
		for (const key of Object.keys(MVP_ERROR_CODES) as Array<keyof typeof MVP_ERROR_CODES>) {
			const code = MVP_ERROR_CODES[key];
			assert.equal(typeof code, "string");
			assert.equal(code, code.toUpperCase());
		}
	});
});

describe("MVP Legacy Error Codes Removed", () => {
	it("does not include ASYNC_JOB_NOT_FOUND (async removed)", () => {
		const hasAsyncError = "ASYNC_JOB_NOT_FOUND" in MVP_ERROR_CODES;
		assert.equal(hasAsyncError, false);
	});

	it("does not include CHAIN_NOT_FOUND (chain removed)", () => {
		const hasChainError = "CHAIN_NOT_FOUND" in MVP_ERROR_CODES;
		assert.equal(hasChainError, false);
	});

	it("does not include INTERCOM_ERROR (intercom removed)", () => {
		const hasIntercomError = "INTERCOM_ERROR" in MVP_ERROR_CODES;
		assert.equal(hasIntercomError, false);
	});

	it("does not include WORKTREE_ERROR (worktree removed)", () => {
		const hasWorktreeError = "WORKTREE_ERROR" in MVP_ERROR_CODES;
		assert.equal(hasWorktreeError, false);
	});
});
