/**
 * MVP Test Suite Summary
 * 
 * This directory contains tests for the MVP scope defined in docs/guides/01-goals-and-scope.md
 * 
 * Run with: pnpm test:mvp
 */

export const MVP_TEST_FILES = {
	unit: [
		"test/mvp/unit/tool-registration.test.ts",
		"test/mvp/unit/builtin-agents.test.ts",
		"test/mvp/unit/recursion-guard.test.ts",
		"test/mvp/unit/readonly-scope.test.ts",
		"test/mvp/unit/frontmatter.test.ts",
		"test/mvp/unit/child-session.test.ts",
		"test/mvp/unit/extension-registration.test.ts",
	],
	integration: [
		"test/mvp/integration/single-execution.test.ts",
	],
};

// MVP Features to Test
export const MVP_FEATURES = {
	included: [
		"subagent tool registration",
		"5 builtin agents: explorer, researcher, reviewer, implementer, tester",
		"markdown frontmatter agent definition",
		"foreground synchronous execution",
		"maxSubagentDepth = 1 recursion protection",
		"readonly agents with safe tools only",
		"minimal child session file for debugging",
	],
	excluded: [
		"background/async jobs",
		"chain workflow",
		"parallel execution",
		"intercom",
		"worktree management",
		"TUI widget",
		"slash bridge (/subagents command)",
		"skills directory/skills injection",
		"complex artifact system",
		"model fallback chain",
		"agent management actions (create/update/delete)",
		"bash tool in readonly agents",
		"implementer/tester write capabilities",
	],
};