/**
 * MVP: Markdown Frontmatter Agent Definition
 * Validates simple frontmatter parsing for custom agents.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { discoverAgents } from "../../../src/agents/agents.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

function tempAgent(name: string, body: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pi-mvp-${name}-`));
	tempDirs.push(dir);
	const agentsDir = path.join(dir, ".pi", "agents");
	fs.mkdirSync(agentsDir, { recursive: true });
	fs.writeFileSync(path.join(agentsDir, `${name}.md`), `---\n${body}\n---\n\nAgent body.`, "utf-8");
	return dir;
}

describe("MVP Simple Frontmatter Parsing", () => {
	it("parses name, description, readonly, tools, and systemPrompt", () => {
		const dir = tempAgent("custom", [
			"name: custom-reviewer",
			"description: Project-specific reviewer",
			"readonly: true",
			"tools: read, grep, find, ls",
		].join("\n"));

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "custom-reviewer");
		assert.ok(agent);
		assert.equal(agent.description, "Project-specific reviewer");
		assert.equal(agent.readonly, true);
		assert.ok(agent.tools?.includes("read"));
		assert.ok(agent.tools?.includes("grep"));
		assert.ok(agent.tools?.includes("find"));
		assert.ok(agent.tools?.includes("ls"));
		assert.ok(agent.systemPrompt?.includes("Agent body"));
		assert.equal(agent.source, "project");
	});

	it("sets source to 'project' for project agents", () => {
		const dir = tempAgent("proj-agent", "name: proj-agent\ndescription: Test\nreadonly: true\ntools: read");
		const result = discoverAgents(dir, "project");
		assert.equal(result.agents[0].source, "project");
	});
});

describe("MVP Removed Frontmatter Features", () => {
	it("does not parse 'package' frontmatter", () => {
		const dir = tempAgent("pkg-agent", [
			"name: pkg-agent",
			"package: code-analysis",
			"description: Fast recon",
		].join("\n"));
		const result = discoverAgents(dir, "project");
		assert.equal(result.agents.find((a) => a.name === "code-analysis.pkg-agent"), undefined);
	});

	it("does not parse 'inheritSkills' frontmatter", () => {
		const dir = tempAgent("skill-agent", [
			"name: skill-agent",
			"description: Worker",
			"inheritSkills: true",
		].join("\n"));
		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "skill-agent");
		assert.ok(agent);
		assert.equal((agent as any).inheritSkills, undefined);
	});

	it("does not parse 'defaultContext' frontmatter", () => {
		const dir = tempAgent("ctx-agent", [
			"name: ctx-agent",
			"description: Delegate",
			"defaultContext: fork",
		].join("\n"));
		const result = discoverAgents(dir, "project");
		assert.equal(result.agents.find((a) => a.name === "ctx-agent")?.defaultContext, undefined);
	});
});

describe("MVP User Agents", () => {
	it("discovers user agents from ~/.pi/agent/agents", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-user-agent-"));
		tempDirs.push(dir);
		const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-home-"));
		tempDirs.push(homeDir);
		const previousHome = process.env.HOME;
		const previousUserProfile = process.env.USERPROFILE;
		const userAgentsDir = path.join(homeDir, ".pi", "agent", "agents");
		fs.mkdirSync(userAgentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(userAgentsDir, "my-agent.md"),
			`---\nname: my-agent\ndescription: My custom agent\nreadonly: true\ntools: read, grep\n---\n\nMy agent prompt.`,
			"utf-8"
		);
		try {
			process.env.HOME = homeDir;
			process.env.USERPROFILE = homeDir;
			const result = discoverAgents(dir, "user");
			const agent = result.agents.find((a) => a.name === "my-agent");
			assert.ok(agent, "my-agent should be discovered from user agents");
			assert.equal(agent.source, "user");
		} finally {
			if (previousHome === undefined) delete process.env.HOME;
			else process.env.HOME = previousHome;
			if (previousUserProfile === undefined) delete process.env.USERPROFILE;
			else process.env.USERPROFILE = previousUserProfile;
		}
	});
});
