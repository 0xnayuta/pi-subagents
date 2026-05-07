/**
 * MVP: Built-in Agents
 * Validates the 5 built-in agents: explorer, researcher, reviewer, implementer, tester
 * 
 * CURRENT STATE: The codebase still has legacy agents (scout, worker, etc.)
 * MVP TARGET: After simplification, only these 5 agents should exist:
 *   - explorer, researcher, reviewer, implementer, tester
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";

const tempDirs: string[] = [];

const MVP_BUILTIN_AGENTS = ["explorer", "researcher", "reviewer", "implementer", "tester"];

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

describe("MVP Built-in Agents Discovery", () => {
	it("[MVP TARGET] discovers exactly 5 builtin agents", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-builtin-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const builtinNames = builtin.map((a) => a.name).sort();
		// TODO: After MVP implementation, this should pass
		assert.deepEqual(builtinNames, MVP_BUILTIN_AGENTS.sort());
	});

	it("[MVP TARGET] each builtin agent has a description", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-builtin-desc-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.ok(agent.description, `${name} should have a description`);
		}
	});

	it("[MVP TARGET] each builtin agent is readonly (no bash tool)", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-builtin-readonly-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.ok(agent.tools, `${name} should have explicit tools`);
			// MVP: readonly agents do not have bash
			assert.equal(agent.tools?.includes("bash"), false, `${name} should not have bash tool`);
		}
	});

	it("[MVP TARGET] explorer has safe exploration tools", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-explorer-tools-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const explorer = builtin.find((a) => a.name === "explorer");
		assert.ok(explorer, "explorer should be discovered");
		// Explorer should have: read, grep, find, ls
		assert.ok(explorer.tools?.includes("read"), "explorer should have read");
		assert.ok(explorer.tools?.includes("grep"), "explorer should have grep");
		assert.ok(explorer.tools?.includes("find"), "explorer should have find");
		assert.ok(explorer.tools?.includes("ls"), "explorer should have ls");
	});

	it("[MVP TARGET] researcher has safe tools plus web search", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-researcher-tools-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const researcher = builtin.find((a) => a.name === "researcher");
		assert.ok(researcher, "researcher should be discovered");
		// Researcher may have web search tools
		const hasWebSearch = researcher.tools?.some((t) =>
			t === "web_search" || t === "fetch_content" || t === "get_search_content"
		);
		assert.ok(hasWebSearch, "researcher should have web search capabilities");
	});

	it("[MVP TARGET] reviewer has safe tools for code review", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-reviewer-tools-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const reviewer = builtin.find((a) => a.name === "reviewer");
		assert.ok(reviewer, "reviewer should be discovered");
		assert.ok(reviewer.tools?.includes("read"), "reviewer should have read");
		assert.ok(reviewer.tools?.includes("grep"), "reviewer should have grep");
	});

	it("[MVP TARGET] implementer is readonly (returns plan, not writes)", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-implementer-readonly-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const implementer = builtin.find((a) => a.name === "implementer");
		assert.ok(implementer, "implementer should be discovered");
		// MVP: implementer is readonly - no bash, no edit, no write
		assert.equal(implementer.tools?.includes("bash"), false, "implementer should not have bash");
		assert.equal(implementer.tools?.includes("edit"), false, "implementer should not have edit");
		assert.equal(implementer.tools?.includes("write"), false, "implementer should not have write");
	});

	it("[MVP TARGET] tester is readonly (returns test plan, not writes)", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-tester-readonly-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const tester = builtin.find((a) => a.name === "tester");
		assert.ok(tester, "tester should be discovered");
		// MVP: tester is readonly - no bash, no edit, no write
		assert.equal(tester.tools?.includes("bash"), false, "tester should not have bash");
		assert.equal(tester.tools?.includes("edit"), false, "tester should not have edit");
		assert.equal(tester.tools?.includes("write"), false, "tester should not have write");
	});

	it("[MVP TARGET] all builtin agents have source='builtin'", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-builtin-source-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.equal(agent.source, "builtin", `${name} should have source='builtin'`);
		}
	});

	it("[MVP TARGET] all builtin agents are not disabled", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-builtin-enabled-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.notEqual(agent.disabled, true, `${name} should not be disabled`);
		}
	});
});

describe("MVP Removed Builtin Agents", () => {
	it("[MVP TARGET] does not include legacy 'planner' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-planner-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const planner = builtin.find((a) => a.name === "planner");
		assert.equal(planner, undefined, "planner should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'worker' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-worker-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const worker = builtin.find((a) => a.name === "worker");
		assert.equal(worker, undefined, "worker should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'delegate' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-delegate-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const delegate = builtin.find((a) => a.name === "delegate");
		assert.equal(delegate, undefined, "delegate should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'oracle' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-oracle-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const oracle = builtin.find((a) => a.name === "oracle");
		assert.equal(oracle, undefined, "oracle should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'scout' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-scout-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const scout = builtin.find((a) => a.name === "scout");
		assert.equal(scout, undefined, "scout should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'context-builder' agent", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-context-builder-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);
		const contextBuilder = builtin.find((a) => a.name === "context-builder");
		assert.equal(contextBuilder, undefined, "context-builder should not be in MVP builtin agents");
	});
});