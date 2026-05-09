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
const LEGACY_AGENTS = ["planner", "worker", "delegate", "oracle", "scout", "context-builder"];

function getBuiltinAgents(): AgentConfig[] {
	return discoverAgents(PROJECT_ROOT, "builtin").agents;
}

describe("MVP Built-in Agents Discovery", () => {
	it("[MVP TARGET] discovers exactly 5 builtin agents", () => {
		const builtin = getBuiltinAgents();
		assert.deepEqual(builtin.map((a) => a.name).sort(), MVP_BUILTIN_AGENTS.sort());
	});

	it("[MVP TARGET] each builtin agent has required properties", () => {
		const builtin = getBuiltinAgents();
		for (const name of MVP_BUILTIN_AGENTS) {
			const agent = builtin.find((a) => a.name === name);
			assert.ok(agent, `${name} should be discovered`);
			assert.ok(agent.description, `${name} should have a description`);
			assert.equal(agent.readonly, true, `${name} should be readonly`);
			assert.equal(agent.source, "builtin", `${name} should have source='builtin'`);
		}
	});

	it("[MVP TARGET] explorer has safe exploration tools", () => {
		const explorer = getBuiltinAgents().find((a) => a.name === "explorer");
		assert.ok(explorer);
		assert.ok(explorer.tools?.includes("read"));
		assert.ok(explorer.tools?.includes("grep"));
		assert.ok(explorer.tools?.includes("find"));
		assert.ok(explorer.tools?.includes("ls"));
	});

	it("[MVP TARGET] researcher has web search, reviewer has read/grep", () => {
		const researcher = getBuiltinAgents().find((a) => a.name === "researcher");
		assert.ok(researcher);
		assert.ok(researcher.tools?.includes("web_search"));

		const reviewer = getBuiltinAgents().find((a) => a.name === "reviewer");
		assert.ok(reviewer);
		assert.ok(reviewer.tools?.includes("read"));
		assert.ok(reviewer.tools?.includes("grep"));
	});

	it("[MVP TARGET] implementer and tester are readonly (no edit/write)", () => {
		for (const name of ["implementer", "tester"]) {
			const agent = getBuiltinAgents().find((a) => a.name === name);
			assert.ok(agent);
			assert.equal(agent.tools?.includes("edit"), false, `${name} should not have edit`);
			assert.equal(agent.tools?.includes("write"), false, `${name} should not have write`);
		}
	});
});

describe("MVP Removed Builtin Agents", () => {
	it("[MVP TARGET] legacy agents are not present", () => {
		const builtin = getBuiltinAgents();
		for (const name of LEGACY_AGENTS) {
			assert.equal(builtin.find((a) => a.name === name), undefined, `${name} should not exist`);
		}
	});
});
