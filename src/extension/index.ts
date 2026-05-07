/**
 * Minimal Subagent Extension Entry Point
 * 
 * This extension registers a single 'subagent' tool that delegates
 * focused tasks to specialized readonly agents.
 * 
 * Features:
 * - Foreground single execution only
 * - maxSubagentDepth = 1 (no nested subagents)
 * - Default readonly agents
 * - Sensitive info sanitization
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { type ExtensionAPI, type ExtensionContext, type ToolDefinition } from "@mariozechner/pi-coding-agent";
import { SubagentParams } from "./schemas.ts";
import {
	type Details,
	type ExtensionConfig,
	type SubagentState,
	RESULTS_DIR,
	PI_SUBAGENT_CHILD,
	checkSubagentDepth,
	resolveCurrentMaxSubagentDepth,
} from "../shared/types.ts";
import { createSubagentExecutor, type SubagentParamsLike } from "../runs/foreground/subagent-executor.ts";
import { discoverAgents } from "../agents/agents.ts";
import { resolveCurrentSessionId } from "../shared/session-identity.ts";

/**
 * Derive subagent session base directory from parent session file.
 */
function getSubagentSessionRoot(parentSessionFile: string | null): string {
	if (parentSessionFile) {
		const baseName = path.basename(parentSessionFile, ".jsonl");
		const sessionsDir = path.dirname(parentSessionFile);
		return path.join(sessionsDir, baseName);
	}
	// Fallback to temp directory
	return path.join(RESULTS_DIR, "sessions");
}

/**
 * Ensure directory exists and is accessible.
 */
function ensureAccessibleDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Load extension configuration from config.json
 */
function loadConfig(): ExtensionConfig {
	const configPath = path.join(process.env.HOME ?? os.homedir(), ".pi", "agent", "extensions", "subagent", "config.json");
	try {
		if (fs.existsSync(configPath)) {
			return JSON.parse(fs.readFileSync(configPath, "utf-8")) as ExtensionConfig;
		}
	} catch (error) {
		console.error(`Failed to load subagent config from '${configPath}':`, error);
	}
	return {};
}

function loadDefaultConfig(): Required<ExtensionConfig> {
	return {
		enabled: true,
		maxSubagentDepth: 1,
		timeoutMs: 120000,
		allowWriteSubagents: false,
	};
}

function mergeConfig(base: ExtensionConfig): Required<ExtensionConfig> {
	return {
		enabled: base.enabled ?? true,
		maxSubagentDepth: base.maxSubagentDepth ?? 1,
		timeoutMs: base.timeoutMs ?? 120000,
		allowWriteSubagents: base.allowWriteSubagents ?? false,
	};
}

// Need os for homedir
import * as os from "node:os";

export default function registerSubagentExtension(pi: ExtensionAPI): void {
	// Prevent child processes from registering this extension
	if (process.env[PI_SUBAGENT_CHILD] === "1") return;

	const globalStore = globalThis as Record<string, unknown>;

	// Ensure results directory exists
	ensureAccessibleDir(RESULTS_DIR);

	// Load configuration
	const config = loadConfig();
	const effectiveConfig = mergeConfig(config);

	// Check if subagents are disabled
	if (effectiveConfig.enabled === false) {
		console.log("Subagent extension is disabled in config");
		return;
	}

	// Initialize state
	const state: SubagentState = {
		baseCwd: process.cwd(),
		currentSessionId: null,
		lastUiContext: null,
	};

	// Create executor
	const executor = createSubagentExecutor({
		pi,
		state,
		config: effectiveConfig,
		getSubagentSessionRoot,
		discoverAgents,
	});

	const executeSubagent = (
		id: string,
		params: SubagentParamsLike,
		signal: AbortSignal,
		onUpdate: ((result: AgentToolResult<Details>) => void) | undefined,
		ctx: ExtensionContext,
	): Promise<AgentToolResult<Details>> => {
		// Check recursion depth
		const depthCheck = checkSubagentDepth(effectiveConfig.maxSubagentDepth);
		if (depthCheck.blocked) {
			return Promise.resolve({
				content: [{
					type: "text",
					text: `Subagent depth exceeded (${depthCheck.depth}/${depthCheck.maxDepth}). Nested subagents are not allowed.`,
				}],
				isError: true,
				details: { mode: "management", results: [] },
			});
		}

		// Collapse UI when executing
		if (ctx.hasUI) {
			ctx.ui.setToolsExpanded(false);
		}

		return executor.execute(id, params, signal, onUpdate, ctx);
	};

	// Define the subagent tool
	const tool: ToolDefinition<typeof SubagentParams, Details> = {
		name: "subagent",
		label: "Subagent",
		description: `Delegate a focused task to a specialized readonly agent.

Available agents:
• explorer - Codebase navigation and file search (readonly)
• researcher - Web research and information synthesis (readonly)
• reviewer - Code review and quality assessment (readonly)
• implementer - Implementation planning (readonly)
• tester - Test planning and strategy (readonly)

Parameters:
• agent: Agent name to use
• task: Task description

Example:
  subagent({ agent: "explorer", task: "Find where authentication is implemented" })`,
		parameters: SubagentParams,

		execute(id, params, signal, onUpdate, ctx) {
			return executeSubagent(id, params, signal, onUpdate, ctx);
		},

		renderCall(args, theme) {
			return {
				type: "text" as const,
				text: `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.agent || "?")}`,
				render: () => [{ text: `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.agent || "?")}` }],
			};
		},

		renderResult(result, options, theme) {
			// Simple text rendering for results
			const content = result.content
				.map((item) => item.type === "text" ? item.text : "")
				.join("\n");

			const prefix = result.isError
				? theme.fg("error", "✗")
				: theme.fg("success", "✓");

			return {
				type: "text" as const,
				text: `${prefix} ${content}`,
				render: () => [`${prefix} ${content}`],
			};
		},
	};

	// Register the tool
	pi.registerTool(tool);

	// Session lifecycle handlers
	const resetSessionState = (ctx: ExtensionContext) => {
		state.baseCwd = ctx.cwd;
		state.currentSessionId = resolveCurrentSessionId(ctx.sessionManager);
		state.lastUiContext = ctx;
	};

	pi.on("session_start", (_event, ctx) => {
		resetSessionState(ctx);
	});

	pi.on("session_shutdown", () => {
		// Cleanup state
		state.lastUiContext = null;
		state.currentSessionId = null;
	});
}
