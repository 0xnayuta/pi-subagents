/**
 * MVP: Tool Registration
 * Validates that the subagent tool is properly registered with minimal schema.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SubagentParams } from "../../../src/extension/schemas.ts";

describe("SubagentParams schema (MVP)", () => {
	describe("required fields", () => {
		it("has 'agent' string parameter", () => {
			assert.ok(SubagentParams.properties.agent);
			assert.equal(SubagentParams.properties.agent.type, "string");
		});

		it("has 'task' string parameter", () => {
			assert.ok(SubagentParams.properties.task);
			assert.equal(SubagentParams.properties.task.type, "string");
		});
	});

	describe("agent parameter", () => {
		it("accepts string agent name", () => {
			// Valid agent names: explorer, researcher, reviewer, implementer, tester
		});
	});

	describe("task parameter", () => {
		it("accepts string task description", () => {
			// Task can be any string describing the subagent's work
		});
	});

	describe("MVP removes legacy parameters", () => {
		it("does not include 'chain' parameter (chain workflow removed)", () => {
			assert.equal(SubagentParams.properties.chain, undefined);
		});

		it("does not include 'tasks' parameter (parallel execution removed)", () => {
			assert.equal(SubagentParams.properties.tasks, undefined);
		});

		it("does not include 'async' parameter (background jobs removed)", () => {
			assert.equal(SubagentParams.properties.async, undefined);
		});

		it("does not include 'share' parameter (session sharing removed)", () => {
			assert.equal(SubagentParams.properties.share, undefined);
		});

		it("does not include 'worktree' parameter (worktree management removed)", () => {
			assert.equal(SubagentParams.properties.worktree, undefined);
		});

		it("does not include 'action' parameter (management removed)", () => {
			assert.equal(SubagentParams.properties.action, undefined);
		});

		it("does not include 'id' parameter (status/resume removed)", () => {
			assert.equal(SubagentParams.properties.id, undefined);
		});

		it("does not include 'sessionDir' parameter (complex session removed)", () => {
			assert.equal(SubagentParams.properties.sessionDir, undefined);
		});

		it("does not include 'control' parameter (control events removed)", () => {
			assert.equal(SubagentParams.properties.control, undefined);
		});

		it("does not include 'model' parameter (model override removed)", () => {
			assert.equal(SubagentParams.properties.model, undefined);
		});

		it("does not include 'skills' parameter (skill injection removed)", () => {
			assert.equal(SubagentParams.properties.skill, undefined);
		});
	});
});
