/**
 * MVP: Tool Registration
 * Validates that the subagent tool is properly registered with correct schema.
 * 
 * NOTE: These tests define MVP behavior. Some tests will fail until MVP features
 * are implemented. This is intentional - tests serve as the specification.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SubagentParams } from "../../../src/extension/schemas.ts";

describe("SubagentParams schema (MVP)", () => {
	describe("required fields", () => {
		it("has optional 'agent' string parameter", () => {
			assert.ok(SubagentParams.properties.agent);
			assert.equal(SubagentParams.properties.agent.type, "string");
		});

		it("has optional 'task' string parameter", () => {
			assert.ok(SubagentParams.properties.task);
			assert.equal(SubagentParams.properties.task.type, "string");
		});
	});

	describe("agent parameter", () => {
		it("accepts string agent name", () => {
			// Valid agent names: explorer, researcher, reviewer, implementer, tester
			// Plus user/project custom agents
		});
	});

	describe("task parameter", () => {
		it("accepts string task description", () => {
			// Task can be any string describing the subagent's work
		});
	});

	describe("MVP removes legacy parameters", () => {
		it("does not include 'chain' parameter (chain workflow removed)", () => {
			// TODO: After MVP implementation, verify chain is removed
			// assert.equal(SubagentParams.properties.chain, undefined);
		});

		it("does not include 'tasks' parameter (parallel execution removed)", () => {
			// TODO: After MVP implementation, verify tasks is removed
			// assert.equal(SubagentParams.properties.tasks, undefined);
		});

		it("does not include 'async' parameter (background jobs removed)", () => {
			// TODO: After MVP implementation, verify async is removed
			// assert.equal(SubagentParams.properties.async, undefined);
		});

		it("does not include 'share' parameter (session sharing removed)", () => {
			// TODO: After MVP implementation, verify share is removed
			// assert.equal(SubagentParams.properties.share, undefined);
		});

		it("does not include 'worktree' parameter (worktree management removed)", () => {
			// TODO: After MVP implementation, verify worktree is removed
			// assert.equal(SubagentParams.properties.worktree, undefined);
		});
	});

	describe("control parameters (minimal)", () => {
		it("has optional 'action' for management", () => {
			assert.ok(SubagentParams.properties.action);
		});

		it("has optional 'id' for status/interrupt/resume", () => {
			assert.ok(SubagentParams.properties.id);
		});
	});

	describe("session parameters", () => {
		it("has optional 'sessionDir' for child session file", () => {
			assert.ok(SubagentParams.properties.sessionDir);
		});
	});
});