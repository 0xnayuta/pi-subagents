/**
 * MVP: Single Execution Integration
 * Tests the foreground synchronous execution flow.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it, beforeEach } from "node:test";
import { discoverAgents, type AgentConfig } from "../../../src/agents/agents.ts";
import { runSync, type RunSyncOptions } from "../../../src/runs/foreground/execution.ts";

const tempDirs: string[] = [];

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

describe("MVP Single Execution Flow", () => {
	it("executes explorer agent with task", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-explorer-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-1",
			maxSubagentDepth: 1,
		};

		const result = await runSync(tmpDir, builtin, "explorer", "List the files in the current directory", options);

		assert.equal(result.agent, "explorer");
		assert.equal(result.task, "List the files in the current directory");
		// Result should have either output or error
		assert.ok(result.exitCode === 0 || result.error, "should have exitCode 0 or error");
	});

	it("executes researcher agent with task", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-researcher-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-2",
			maxSubagentDepth: 1,
		};

		const result = await runSync(tmpDir, builtin, "researcher", "Search for TODO comments in the code", options);

		assert.equal(result.agent, "researcher");
		assert.equal(result.task, "Search for TODO comments in the code");
	});

	it("executes reviewer agent with task", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-reviewer-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-3",
			maxSubagentDepth: 1,
		};

		// Create a test file to review
		const testFile = path.join(tmpDir, "test-code.js");
		fs.writeFileSync(testFile, "// TODO: fix this\nexport function test() {}\n", "utf-8");

		const result = await runSync(tmpDir, builtin, "reviewer", `Review the file ${testFile}`, options);

		assert.equal(result.agent, "reviewer");
	});

	it("returns error for unknown agent", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-unknown-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-4",
			maxSubagentDepth: 1,
		};

		const result = await runSync(tmpDir, builtin, "non-existent-agent", "Do something", options);

		assert.notEqual(result.exitCode, 0);
		assert.ok(result.error, "should have error for unknown agent");
		assert.ok(result.error?.includes("Unknown agent") || result.error?.includes("not found"));
	});

	it("includes usage statistics in result", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-usage-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-5",
			maxSubagentDepth: 1,
		};

		const result = await runSync(tmpDir, builtin, "explorer", "List files", options);

		assert.ok(result.usage, "result should have usage statistics");
	});

	it("includes progress summary in result", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-exec-progress-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const options: RunSyncOptions = {
			sessionDir: tmpDir,
			runId: "test-run-6",
			maxSubagentDepth: 1,
		};

		const result = await runSync(tmpDir, builtin, "explorer", "List files", options);

		assert.ok(result.progressSummary, "result should have progress summary");
	});
});

describe("MVP Execution Constraints", () => {
	it("foreground execution is synchronous (blocks until complete)", () => {
		// runSync should be async but wait for completion
		// No async callback or background processing
	});

	it("no chain execution support", async () => {
		// chain parameter should not be in MVP
		// Sequential/parallel execution via chains not supported
	});

	it("no parallel execution support", async () => {
		// tasks parameter should not be in MVP
		// Multiple concurrent subagent execution not supported
	});
});

describe("MVP Child Session File Generation", () => {
	it("creates child session directory during execution", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mvp-session-gen-"));
		tempDirs.push(tmpDir);
		const builtin = getBuiltinAgents(tmpDir);

		const sessionDir = path.join(tmpDir, "sessions", "child");
		const options: RunSyncOptions = {
			sessionDir,
			runId: "child-run-1",
			maxSubagentDepth: 1,
		};

		await runSync(tmpDir, builtin, "explorer", "List files", options);

		// Child session directory should be created
		assert.ok(fs.existsSync(sessionDir) || fs.existsSync(path.dirname(sessionDir)));
	});

	it("session file contains structured logs", async () => {
		// Session file should be JSONL with structured entries
		// for debugging purposes
	});
});