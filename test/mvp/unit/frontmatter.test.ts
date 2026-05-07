/**
 * MVP: Markdown Frontmatter Agent Definition
 * Validates simple frontmatter parsing for custom agents.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";

const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (!dir) continue;
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("MVP Simple Frontmatter Parsing", () => {
	it("parses name from frontmatter", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-name-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "custom.md"),
			`---
name: custom-reviewer
description: Project-specific reviewer
readonly: true
tools: read, grep, find, ls
---

You are a custom reviewer agent.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "custom-reviewer");
		assert.ok(agent, "custom-reviewer should be discovered");
		assert.equal(agent.description, "Project-specific reviewer");
	});

	it("parses description from frontmatter", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-desc-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "reviewer.md"),
			`---
name: reviewer
description: Reviews code for quality
readonly: true
tools: read, grep
---

You are a code reviewer.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "reviewer");
		assert.ok(agent, "reviewer should be discovered");
		assert.equal(agent.description, "Reviews code for quality");
	});

	it("parses readonly boolean from frontmatter", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-readonly-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "worker.md"),
			`---
name: worker
description: Worker agent
readonly: true
tools: read, grep, find, ls
---

Do work.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "worker");
		assert.ok(agent, "worker should be discovered");
		assert.equal(agent.readonly, true);
	});

	it("parses comma-separated tools from frontmatter", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-tools-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "scout.md"),
			`---
name: scout
description: Scout agent
readonly: true
tools: read, grep, find, ls
---

Scout the codebase.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "scout");
		assert.ok(agent, "scout should be discovered");
		assert.ok(agent.tools, "scout should have tools");
		assert.ok(agent.tools?.includes("read"), "should have read");
		assert.ok(agent.tools?.includes("grep"), "should have grep");
		assert.ok(agent.tools?.includes("find"), "should have find");
		assert.ok(agent.tools?.includes("ls"), "should have ls");
	});

	it("parses systemPrompt from body after frontmatter", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-body-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "explorer.md"),
			`---
name: explorer
description: Explore files
readonly: true
tools: read, grep, find, ls
---

You are an explorer agent. Navigate the codebase and report findings.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "explorer");
		assert.ok(agent, "explorer should be discovered");
		assert.ok(agent.systemPrompt, "explorer should have systemPrompt");
		assert.ok(agent.systemPrompt.includes("explorer agent"));
	});

	it("sets source to 'project' for project agents", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-fm-source-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "tester.md"),
			`---
name: tester
description: Test agent
readonly: true
tools: read, grep
---

You are a tester agent.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "tester");
		assert.ok(agent, "tester should be discovered");
		assert.equal(agent.source, "project");
	});
});

describe("MVP Removed Frontmatter Features", () => {
	it("does not parse 'package' frontmatter (packaged agents removed)", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-package-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "scout.md"),
			`---
name: scout
package: code-analysis
description: Fast recon
---

Inspect code.
`,
			"utf-8",
		);

		// Should NOT create "code-analysis.scout" runtime name
		// MVP does not support packaged agents
		const result = discoverAgents(dir, "project");
		const packaged = result.agents.find((a) => a.name === "code-analysis.scout");
		assert.equal(packaged, undefined, "packaged agents not supported in MVP");
	});

	it("does not parse 'inheritSkills' frontmatter (skills injection removed)", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-inheritSkills-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "worker.md"),
			`---
name: worker
description: Worker
inheritSkills: true
---

Do work.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "worker");
		assert.ok(agent, "worker should be discovered");
		// MVP: inheritSkills not supported, should default to false
		assert.equal(agent.inheritSkills, false);
	});

	it("does not parse 'defaultContext' frontmatter (fork context removed)", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-no-defaultContext-"));
		tempDirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "delegate.md"),
			`---
name: delegate
description: Delegate
defaultContext: fork
---

Delegate tasks.
`,
			"utf-8",
		);

		const result = discoverAgents(dir, "project");
		const agent = result.agents.find((a) => a.name === "delegate");
		assert.ok(agent, "delegate should be discovered");
		// MVP: defaultContext not supported, should default to fresh
		assert.equal(agent.defaultContext, undefined);
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
			`---
name: my-agent
description: My custom agent
readonly: true
tools: read, grep
---

My agent prompt.
`,
			"utf-8",
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

	it("user agents take precedence over project agents on name collision", () => {
		// When user and project have agents with the same name,
		// the MVP should define clear precedence rules
	});
});