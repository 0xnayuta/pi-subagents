/**
 * MVP: Readonly Scope
 * Validates that all MVP agents are readonly by default with safe tools only.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";

const MVP_SAFE_TOOLS = ["read", "grep", "find", "ls"];
const RESEARCHER_EXTRA_TOOLS = ["web_search", "fetch_content", "get_search_content"];
const MVP_FORBIDDEN_TOOLS = ["bash", "edit", "write", "contact_supervisor"];

// Get project root - test/mvp/unit -> test/mvp -> test -> project
const PROJECT_ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));

function getBuiltinAgents(): AgentConfig[] {
	return discoverAgents(PROJECT_ROOT, "builtin").agents;
}

describe("MVP All Agents Readonly", () => {
	it("no builtin agent has bash tool", () => {
		const builtin = getBuiltinAgents();
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("bash"),
				false,
				`${agent.name} should not have bash tool`,
			);
		}
	});

	it("no builtin agent has edit tool", () => {
		const builtin = getBuiltinAgents();
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("edit"),
				false,
				`${agent.name} should not have edit tool`,
			);
		}
	});

	it("no builtin agent has write tool", () => {
		const builtin = getBuiltinAgents();
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("write"),
				false,
				`${agent.name} should not have write tool`,
			);
		}
	});

	it("no builtin agent has contact_supervisor tool", () => {
		const builtin = getBuiltinAgents();
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("contact_supervisor"),
				false,
				`${agent.name} should not have contact_supervisor tool`,
			);
		}
	});
});

describe("MVP Safe Tools Availability", () => {
	it("explorer has read, grep, find, ls", () => {
		const builtin = getBuiltinAgents();
		const explorer = builtin.find((a) => a.name === "explorer");
		assert.ok(explorer, "explorer should exist");
		for (const tool of MVP_SAFE_TOOLS) {
			assert.ok(
				explorer.tools?.includes(tool),
				`explorer should have ${tool}`,
			);
		}
	});

	it("reviewer has read, grep, find, ls", () => {
		const builtin = getBuiltinAgents();
		const reviewer = builtin.find((a) => a.name === "reviewer");
		assert.ok(reviewer, "reviewer should exist");
		for (const tool of MVP_SAFE_TOOLS) {
			assert.ok(
				reviewer.tools?.includes(tool),
				`reviewer should have ${tool}`,
			);
		}
	});

	it("researcher has safe tools plus web search", () => {
		const builtin = getBuiltinAgents();
		const researcher = builtin.find((a) => a.name === "researcher");
		assert.ok(researcher, "researcher should exist");
		const hasWebSearch = researcher.tools?.some((t) =>
			RESEARCHER_EXTRA_TOOLS.includes(t)
		);
		assert.ok(hasWebSearch, "researcher should have web search tools");
	});

	it("implementer has safe read-only tools", () => {
		const builtin = getBuiltinAgents();
		const implementer = builtin.find((a) => a.name === "implementer");
		assert.ok(implementer, "implementer should exist");
		for (const tool of MVP_SAFE_TOOLS) {
			assert.ok(
				implementer.tools?.includes(tool),
				`implementer should have ${tool}`,
			);
		}
	});

	it("tester has safe read-only tools", () => {
		const builtin = getBuiltinAgents();
		const tester = builtin.find((a) => a.name === "tester");
		assert.ok(tester, "tester should exist");
		for (const tool of MVP_SAFE_TOOLS) {
			assert.ok(
				tester.tools?.includes(tool),
				`tester should have ${tool}`,
			);
		}
	});
});

describe("MVP User/Project Agents Readonly Default", () => {
	it("user agents default to readonly", () => {
		// User agents would be loaded from ~/.pi/agent/agents if they exist
		// For MVP, we only test that builtin agents are readonly
	});

	it("project agents default to readonly", () => {
		// Project agents would be loaded from .pi/agents if they exist
		// For MVP, we only test that builtin agents are readonly
	});
});

describe("MVP Config Override", () => {
	it("allowWriteSubagents: true enables bash for specific agents", () => {
		// This would be tested in integration tests
	});
});
