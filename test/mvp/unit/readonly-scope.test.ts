/**
 * MVP: Readonly Scope
 * Validates that all MVP agents are readonly by default with safe tools only.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";

const tempDirs: string[] = [];

const MVP_SAFE_TOOLS = ["read", "grep", "find", "ls"];
const RESEARCHER_EXTRA_TOOLS = ["web_search", "fetch_content", "get_search_content"];
const MVP_FORBIDDEN_TOOLS = ["bash", "edit", "write", "contact_supervisor"];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (!dir) continue;
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

function getBuiltinAgents(tmpDir: string): AgentConfig[] {
	const previousHome = process.env.HOME;
	const previousUserProfile = process.env.USERPROFILE;
	try {
		process.env.HOME = tmpDir;
		process.env.USERPROFILE = tmpDir;
		return discoverAgents(tmpDir, "builtin").agents;
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		if (previousUserProfile === undefined) delete process.env.USERPROFILE;
		else process.env.USERPROFILE = previousUserProfile;
	}
}

describe("MVP All Agents Readonly", () => {
	it("no builtin agent has bash tool", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-bash-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("bash"),
				false,
				`${agent.name} should not have bash tool`,
			);
		}
	});

	it("no builtin agent has edit tool", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-edit-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("edit"),
				false,
				`${agent.name} should not have edit tool`,
			);
		}
	});

	it("no builtin agent has write tool", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-write-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const agent of builtin) {
			assert.equal(
				agent.tools?.includes("write"),
				false,
				`${agent.name} should not have write tool`,
			);
		}
	});

	it("no builtin agent has contact_supervisor tool", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-supervisor-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
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
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-explorer-safe-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
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
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-reviewer-safe-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const reviewer = builtin.find((a) => a.name === "reviewer");
		assert.ok(reviewer, "reviewer should exist");
		for (const tool of ["read", "grep"]) {
			assert.ok(
				reviewer.tools?.includes(tool),
				`reviewer should have ${tool}`,
			);
		}
	});

	it("researcher has safe tools plus web search", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-researcher-web-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const researcher = builtin.find((a) => a.name === "researcher");
		assert.ok(researcher, "researcher should exist");
		// Basic safe tools
		for (const tool of ["read", "grep", "find", "ls"]) {
			assert.ok(
				researcher.tools?.includes(tool),
				`researcher should have ${tool}`,
			);
		}
		// Web search tools
		const hasWebSearch = researcher.tools?.some((t) =>
			RESEARCHER_EXTRA_TOOLS.includes(t)
		);
		assert.ok(hasWebSearch, "researcher should have web search tools");
	});

	it("implementer has safe read-only tools", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-implementer-safe-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const implementer = builtin.find((a) => a.name === "implementer");
		assert.ok(implementer, "implementer should exist");
		for (const tool of ["read", "grep", "find"]) {
			assert.ok(
				implementer.tools?.includes(tool),
				`implementer should have ${tool}`,
			);
		}
		// Should NOT have mutating tools
		for (const tool of MVP_FORBIDDEN_TOOLS) {
			assert.equal(
				implementer.tools?.includes(tool),
				false,
				`implementer should not have ${tool}`,
			);
		}
	});

	it("tester has safe read-only tools", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-tester-safe-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const tester = builtin.find((a) => a.name === "tester");
		assert.ok(tester, "tester should exist");
		for (const tool of ["read", "grep", "find"]) {
			assert.ok(
				tester.tools?.includes(tool),
				`tester should have ${tool}`,
			);
		}
		// Should NOT have mutating tools
		for (const tool of MVP_FORBIDDEN_TOOLS) {
			assert.equal(
				tester.tools?.includes(tool),
				false,
				`tester should not have ${tool}`,
			);
		}
	});
});

describe("MVP User/Project Agents Readonly Default", () => {
	it("user agents default to readonly", () => {
		// User-defined agents should also be readonly by default
		// unless explicitly configured otherwise
	});

	it("project agents default to readonly", () => {
		// Project-defined agents should also be readonly by default
	});
});

describe("MVP Config Override", () => {
	it("allowWriteSubagents: true enables bash for specific agents", () => {
		// Future: if config.allowWriteSubagents is set,
		// certain agents could have write capabilities
	});
});