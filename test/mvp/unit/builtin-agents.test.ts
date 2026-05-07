/**
 * MVP: Built-in Agents
 * Validates the 5 built-in agents: explorer, researcher, reviewer, implementer, tester
 */

import assert from "node:assert/strict";
import * as path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";

const PROJECT_ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));

const MVP_BUILTIN_AGENTS = ["explorer", "researcher", "reviewer", "implementer", "tester"];

function getBuiltinAgents(): AgentConfig[] {
	return discoverAgents(PROJECT_ROOT, "builtin").agents;
}

describe("MVP Built-in Agents Discovery", () => {
	it("[MVP TARGET] discovers exactly 5 builtin agents", () => {
		const builtin = getBuiltinAgents();
		const builtinNames = builtin.map((a) => a.name).sort();
		assert.deepEqual(builtinNames, MVP_BUILTIN_AGENTS.sort());
	});

	it("[MVP TARGET] each builtin agent has a description", () => {
		const builtin = getBuiltinAgents();
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.ok(agent.description, `${name} should have a description`);
		}
	});

	it("[MVP TARGET] each builtin agent is readonly", () => {
		const builtin = getBuiltinAgents();
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.equal(agent.readonly, true, `${name} should be readonly`);
		}
	});

	it("[MVP TARGET] explorer has safe exploration tools", () => {
		const builtin = getBuiltinAgents();
		const explorer = builtin.find((a) => a.name === "explorer");
		assert.ok(explorer, "explorer should be discovered");
		assert.ok(explorer.tools?.includes("read"), "explorer should have read");
		assert.ok(explorer.tools?.includes("grep"), "explorer should have grep");
		assert.ok(explorer.tools?.includes("find"), "explorer should have find");
		assert.ok(explorer.tools?.includes("ls"), "explorer should have ls");
	});

	it("[MVP TARGET] researcher has safe tools plus web search", () => {
		const builtin = getBuiltinAgents();
		const researcher = builtin.find((a) => a.name === "researcher");
		assert.ok(researcher, "researcher should be discovered");
		assert.ok(researcher.tools?.includes("web_search"), "researcher should have web_search");
	});

	it("[MVP TARGET] reviewer has safe tools for code review", () => {
		const builtin = getBuiltinAgents();
		const reviewer = builtin.find((a) => a.name === "reviewer");
		assert.ok(reviewer, "reviewer should be discovered");
		assert.ok(reviewer.tools?.includes("read"), "reviewer should have read");
		assert.ok(reviewer.tools?.includes("grep"), "reviewer should have grep");
	});

	it("[MVP TARGET] implementer is readonly (returns plan, not writes)", () => {
		const builtin = getBuiltinAgents();
		const implementer = builtin.find((a) => a.name === "implementer");
		assert.ok(implementer, "implementer should be discovered");
		assert.equal(implementer.tools?.includes("edit"), false, "implementer should not have edit");
		assert.equal(implementer.tools?.includes("write"), false, "implementer should not have write");
	});

	it("[MVP TARGET] tester is readonly (returns test plan, not writes)", () => {
		const builtin = getBuiltinAgents();
		const tester = builtin.find((a) => a.name === "tester");
		assert.ok(tester, "tester should be discovered");
		assert.equal(tester.tools?.includes("edit"), false, "tester should not have edit");
		assert.equal(tester.tools?.includes("write"), false, "tester should not have write");
	});

	it("[MVP TARGET] all builtin agents have source='builtin'", () => {
		const builtin = getBuiltinAgents();
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.equal(agent.source, "builtin", `${name} should have source='builtin'`);
		}
	});
});

describe("MVP Removed Builtin Agents", () => {
	it("[MVP TARGET] does not include legacy 'planner' agent", () => {
		const builtin = getBuiltinAgents();
		const planner = builtin.find((a) => a.name === "planner");
		assert.equal(planner, undefined, "planner should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'worker' agent", () => {
		const builtin = getBuiltinAgents();
		const worker = builtin.find((a) => a.name === "worker");
		assert.equal(worker, undefined, "worker should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'delegate' agent", () => {
		const builtin = getBuiltinAgents();
		const delegate = builtin.find((a) => a.name === "delegate");
		assert.equal(delegate, undefined, "delegate should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'oracle' agent", () => {
		const builtin = getBuiltinAgents();
		const oracle = builtin.find((a) => a.name === "oracle");
		assert.equal(oracle, undefined, "oracle should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'scout' agent", () => {
		const builtin = getBuiltinAgents();
		const scout = builtin.find((a) => a.name === "scout");
		assert.equal(scout, undefined, "scout should not be in MVP builtin agents");
	});

	it("[MVP TARGET] does not include legacy 'context-builder' agent", () => {
		const builtin = getBuiltinAgents();
		const contextBuilder = builtin.find((a) => a.name === "context-builder");
		assert.equal(contextBuilder, undefined, "context-builder should not be in MVP builtin agents");
	});
});
