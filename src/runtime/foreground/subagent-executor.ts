/**
 * Minimal subagent executor
 * Only supports: foreground single execution
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentConfig, AgentScope } from "../../agents/agents.ts";
import {
  DEFAULT_MAX_OUTPUT,
  type Details,
  type ExtensionConfig,
  MVP_ERROR_CODES,
  type MvpErrorCode,
  PI_SUBAGENT_CHILD,
  PI_SUBAGENT_DEPTH,
  PI_SUBAGENT_MAX_DEPTH,
  type SingleResult,
  type SubagentState,
  type Usage,
  checkSubagentDepth,
  truncateOutput,
} from "../../shared/types.ts";
import { buildSubagentChildArgs, cleanupTempDir } from "../shared/pi-args.ts";
import { buildChildPrompt } from "../shared/subagent-prompt-runtime.ts";
import { runSync } from "./execution.ts";
import { sanitizeOutput } from "./sanitize.ts";

export interface SubagentParamsLike {
  agent: string;
  task: string;
}

interface ExecutorDeps {
  pi: ExtensionAPI;
  state: SubagentState;
  config: Required<ExtensionConfig>;
  getSubagentSessionRoot: (parentSessionFile: string | null) => string;
  discoverAgents: (cwd: string, scope: AgentScope) => { agents: AgentConfig[] };
}

function findAgent(agents: AgentConfig[], name: string): AgentConfig | undefined {
  return agents.find((a) => a.name === name);
}

function loadAgent(
  agentName: string,
  cwd: string,
  deps: ExecutorDeps
): AgentToolResult<Details> | AgentConfig {
  const scope: AgentScope = "both";
  const discovered = deps.discoverAgents(cwd, scope).agents;
  const agent = findAgent(discovered, agentName);

  if (!agent) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown agent: ${agentName}. Available agents: ${discovered.map((a) => a.name).join(", ")}`,
        },
      ],
      details: {
        mode: "single",
        results: [],
        error: {
          code: MVP_ERROR_CODES.UNKNOWN_AGENT,
          message: `Unknown agent: ${agentName}. Available agents: ${discovered.map((a) => a.name).join(", ")}`,
        },
      },
    };
  }

  return agent;
}

function filterToolsForReadonly(agent: AgentConfig, config: Required<ExtensionConfig>): string[] {
  const readonlyTools = [
    "read",
    "grep",
    "find",
    "ls",
    "web_search",
    "fetch_content",
    "get_search_content",
  ];
  const configuredTools = agent.tools ?? [];

  if (agent.readonly) {
    return configuredTools.filter((tool) => readonlyTools.includes(tool));
  }

  if (!config.allowWriteSubagents) {
    return configuredTools.filter((tool) => readonlyTools.includes(tool));
  }

  return configuredTools;
}

export function createSubagentExecutor(deps: ExecutorDeps): {
  execute: (
    id: string,
    params: SubagentParamsLike,
    signal: AbortSignal,
    onUpdate: ((r: AgentToolResult<Details>) => void) | undefined,
    ctx: ExtensionContext
  ) => Promise<AgentToolResult<Details>>;
} {
  const execute = async (
    _id: string,
    params: SubagentParamsLike,
    signal: AbortSignal,
    onUpdate: ((r: AgentToolResult<Details>) => void) | undefined,
    ctx: ExtensionContext
  ): Promise<AgentToolResult<Details>> => {
    const cwd = ctx.cwd;
    const { depth, maxDepth } = checkSubagentDepth(deps.config.maxSubagentDepth);

    // Check if subagents are disabled
    if (!deps.config.enabled) {
      return {
        content: [{ type: "text", text: "Subagents are disabled in configuration" }],
        details: {
          mode: "single",
          results: [],
          error: {
            code: MVP_ERROR_CODES.SUBAGENTS_DISABLED,
            message: "Subagents are disabled in configuration",
          },
        },
      };
    }

    // Check depth
    if (depth >= maxDepth) {
      return {
        content: [
          {
            type: "text",
            text: `Maximum subagent depth (${maxDepth}) exceeded. Subagents cannot call other subagents.`,
          },
        ],
        details: {
          mode: "single",
          results: [],
          error: {
            code: MVP_ERROR_CODES.SUBAGENT_DEPTH_EXCEEDED,
            message: `Maximum subagent depth (${maxDepth}) exceeded. Subagents cannot call other subagents.`,
          },
        },
      };
    }

    // Validate inputs
    if (!params.agent) {
      return {
        content: [{ type: "text", text: "Missing required parameter: agent" }],
        details: {
          mode: "single",
          results: [],
          error: {
            code: MVP_ERROR_CODES.INVALID_INPUT,
            message: "Missing required parameter: agent",
          },
        },
      };
    }

    if (!params.task) {
      return {
        content: [{ type: "text", text: "Missing required parameter: task" }],
        details: {
          mode: "single",
          results: [],
          error: {
            code: MVP_ERROR_CODES.INVALID_INPUT,
            message: "Missing required parameter: task",
          },
        },
      };
    }

    // Load and validate agent
    const agentResult = loadAgent(params.agent, cwd, deps);
    if (!("name" in agentResult)) {
      return agentResult;
    }

    const agent = agentResult;
    const runId = randomUUID().slice(0, 8);
    const parentSessionFile = ctx.sessionManager.getSessionFile() ?? null;

    // Determine tools based on readonly status
    const tools = filterToolsForReadonly(agent, deps.config);

    // Build child prompt
    const systemPrompt = buildChildPrompt({
      agentName: agent.name,
      agentDescription: agent.description,
      agentSystemPrompt: agent.systemPrompt,
      agentTools: tools,
      task: params.task,
      parentMessages: [],
      childDepth: depth + 1,
      maxDepth: maxDepth,
      isReadonly: agent.readonly || !deps.config.allowWriteSubagents,
    });

    // Set up environment
    const childEnv: Record<string, string> = {
      ...process.env,
      [PI_SUBAGENT_CHILD]: "1",
      [PI_SUBAGENT_DEPTH]: String(depth + 1),
      [PI_SUBAGENT_MAX_DEPTH]: String(maxDepth),
    };

    // Build session directory
    const sessionRoot = deps.getSubagentSessionRoot(parentSessionFile);
    const sessionDir = path.join(sessionRoot, runId);

    try {
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        content: [{ type: "text", text: `Failed to create session directory: ${message}` }],
        details: {
          mode: "single",
          results: [],
          error: {
            code: MVP_ERROR_CODES.SUBAGENT_FAILED,
            message: `Failed to create session directory: ${message}`,
          },
        },
      };
    }

    const sessionFile = path.join(sessionDir, "session.jsonl");

    // Build pi arguments
    const piArgs = buildSubagentChildArgs({
      mode: "json",
      systemPrompt,
      task: params.task,
      cwd,
      sessionFile,
      model: agent.model,
      tools,
      env: childEnv,
    });

    // Run the subagent
    const timeoutMs = deps.config.timeoutMs;
    const abortController = new AbortController();

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    // Combine external signal with timeout
    const combinedSignal = AbortSignal.any([signal, abortController.signal]);

    let exitCode = 1;
    let output = "";
    let usage: Usage | undefined;

    try {
      const result = await runSync(cwd, piArgs.args, {
        signal: combinedSignal,
        env: piArgs.env,
        onUpdate: (update) => {
          onUpdate?.({
            content: update.content as any,
            details: {
              mode: "single",
              results: [],
            },
          });
        },
      });

      exitCode = result.exitCode;
      output = result.output || "";
      usage = result.usage;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Check if it was timeout or user abort
        if (signal.aborted) {
          output = "Subagent execution was cancelled by user.";
        } else {
          exitCode = 124; // Standard timeout exit code
          output = `Subagent timed out after ${timeoutMs}ms.`;
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        output = `Subagent execution failed: ${message}`;
      }
    } finally {
      cleanupTempDir(piArgs.tempDir);
    }

    // Determine error code if execution failed
    let errorCode: MvpErrorCode | undefined;
    if (exitCode === 124) {
      errorCode = MVP_ERROR_CODES.SUBAGENT_TIMEOUT;
    } else if (exitCode !== 0) {
      errorCode = MVP_ERROR_CODES.SUBAGENT_FAILED;
    }

    clearTimeout(timeoutHandle);

    // Sanitize output
    const sanitizedOutput = sanitizeOutput(output);

    // Truncate if needed
    const truncationResult = truncateOutput(sanitizedOutput, DEFAULT_MAX_OUTPUT);

    // Build result
    const singleResult: SingleResult = {
      agent: agent.name,
      task: params.task,
      exitCode,
      usage: usage || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      error: exitCode !== 0 ? sanitizedOutput : undefined,
      sessionFile,
      output: sanitizedOutput,
    };

    // Determine if truncation occurred
    let truncationError:
      | { code: typeof MVP_ERROR_CODES.SUBAGENT_OUTPUT_TRUNCATED; message: string }
      | undefined;
    if (truncationResult.truncated) {
      truncationError = {
        code: MVP_ERROR_CODES.SUBAGENT_OUTPUT_TRUNCATED,
        message: `Output truncated: showing ${truncationResult.originalLines} of ${truncationResult.originalLines} lines`,
      };
    }

    const details: Details = {
      mode: "single",
      runId,
      results: [singleResult],
    };

    // Add error info if execution failed
    if (errorCode) {
      details.error = {
        code: errorCode,
        message: sanitizedOutput,
      };
    }

    if (exitCode !== 0) {
      return {
        content: [{ type: "text", text: sanitizedOutput }],
        details,
      };
    }

    // Add truncation warning if applicable
    if (truncationError) {
      details.error = truncationError;
    }

    return {
      content: [{ type: "text", text: truncationResult.text }],
      details,
    };
  };

  return { execute };
}
