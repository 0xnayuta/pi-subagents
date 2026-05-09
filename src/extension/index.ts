/**
 * Minimal Subagent Extension Entry Point
 *
 * This extension registers bundled readonly web tools and a single
 * 'subagent' tool that delegates focused tasks to specialized readonly agents.
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
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { discoverAgents } from "../agents/agents.ts";
import { loadConfig, mergeConfig } from "../config/load-config.ts";
import {
  type SubagentParamsLike,
  createSubagentExecutor,
} from "../runtime/foreground/subagent-executor.ts";
import { resolveCurrentSessionId } from "../shared/session-identity.ts";
import {
  type Details,
  MVP_ERROR_CODES,
  PI_SUBAGENT_CHILD,
  RESULTS_DIR,
  type SubagentState,
  checkSubagentDepth,
} from "../shared/types.ts";
import { registerWebTools } from "../web/index.ts";
import { formatDoctorReport, runDoctorChecks } from "./commands/doctor.ts";
import { formatAgentList, getAgentList } from "./commands/list.ts";
import { type LogsOptions, formatLogs } from "./commands/logs.ts";
import { SubagentParams } from "./schemas.ts";

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

export default function registerSubagentExtension(pi: ExtensionAPI): void {
  // Load configuration
  const config = loadConfig();
  const effectiveConfig = mergeConfig(config);

  // Web tools are available in both parent and child processes.
  registerWebTools(pi, effectiveConfig);

  // Prevent child processes from registering the subagent tool.
  if (process.env[PI_SUBAGENT_CHILD] === "1") return;

  // Ensure results directory exists
  ensureAccessibleDir(RESULTS_DIR);

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
    ctx: ExtensionContext
  ): Promise<AgentToolResult<Details>> => {
    // Check recursion depth
    const depthCheck = checkSubagentDepth(effectiveConfig.maxSubagentDepth);
    if (depthCheck.blocked) {
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: `Subagent depth exceeded (${depthCheck.depth}/${depthCheck.maxDepth}). Nested subagents are not allowed.`,
          },
        ],
        details: {
          mode: "management",
          results: [],
          error: {
            code: MVP_ERROR_CODES.SUBAGENT_DEPTH_EXCEEDED,
            message: `Subagent depth exceeded (${depthCheck.depth}/${depthCheck.maxDepth}). Nested subagents are not allowed.`,
          },
        },
      });
    }

    // Collapse UI when executing
    if (ctx.hasUI) {
      ctx.ui.setToolsExpanded(false);
    }

    return executor.execute(id, params, signal, onUpdate, ctx);
  };

  // Define the subagent tool
  const tool = {
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
    parameters: SubagentParams as any,
    execute(
      id: string,
      params: SubagentParamsLike,
      signal: AbortSignal,
      onUpdate: ((result: AgentToolResult<Details>) => void) | undefined,
      ctx: ExtensionContext
    ) {
      return executeSubagent(id, params, signal, onUpdate, ctx);
    },

    renderCall(args: any, theme: any) {
      const label = `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.agent || "?")}`;
      return new Text(label, 0, 0);
    },

    renderResult(result: any, _options: any, theme: any, context: any) {
      // Safely extract text content from result
      const content = result.content
        .filter((item: any): item is { type: "text"; text: string } => item.type === "text")
        .map((item: any) => item.text)
        .join("\n");

      const hasManagedError =
        Boolean(result.details?.error) ||
        Boolean(
          result.details?.results?.some(
            (r: any) => typeof r.exitCode === "number" && r.exitCode !== 0
          )
        );
      const prefix =
        context?.isError || hasManagedError ? theme.fg("error", "✗") : theme.fg("success", "✓");
      const displayText = content || result.details?.error?.message || "(no output)";
      return new Text(`${prefix} ${displayText}`, 0, 0);
    },
  } as any;

  // Register the tool
  pi.registerTool(tool);

  // Register developer commands
  registerDeveloperCommands(pi);

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

// ============================================================================
// Developer Commands
// ============================================================================

function registerDeveloperCommands(pi: ExtensionAPI): void {
  // /subagents doctor - Diagnostic check
  pi.registerCommand("doctor", {
    description: "Check subagent configuration, agents, and providers",
    handler: async (_args: string, ctx) => {
      const cwd = ctx.cwd;
      try {
        const report = await runDoctorChecks(cwd);
        const output = formatDoctorReport(report);
        console.log(output);
        ctx.ui.notify(
          `Doctor: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`,
          "info"
        );
      } catch (error) {
        ctx.ui.notify(
          `Doctor check failed: ${error instanceof Error ? error.message : error}`,
          "error"
        );
      }
    },
  });

  // /subagents list - List available agents
  pi.registerCommand("list", {
    description: "List all available subagents",
    handler: async (_args: string, ctx) => {
      try {
        const report = getAgentList(ctx.cwd);
        const output = formatAgentList(report);
        console.log(output);
        ctx.ui.notify(`Found ${report.total} agents`, "info");
      } catch (error) {
        ctx.ui.notify(`List failed: ${error instanceof Error ? error.message : error}`, "error");
      }
    },
  });

  // /subagents logs - Show recent activity logs
  pi.registerCommand("logs", {
    description: "Show recent web tool activity logs",
    handler: async (args: string, ctx) => {
      try {
        // Parse options from args
        const options: LogsOptions = {};
        if (args.includes("--search")) {
          options.type = "search";
        } else if (args.includes("--fetch")) {
          options.type = "fetch";
        }
        const match = args.match(/--limit\s+(\d+)/);
        if (match) {
          options.limit = Number.parseInt(match[1], 10);
        }

        const output = formatLogs(options);
        console.log(output);
        ctx.ui.notify("Activity logs printed to console", "info");
      } catch (error) {
        ctx.ui.notify(`Logs failed: ${error instanceof Error ? error.message : error}`, "error");
      }
    },
  });
}
