/**
 * Output collection from pi subprocess
 */

import type { Usage } from "../../shared/types.ts";

interface OutputMessage {
  type: "progress" | "update" | "result" | "error";
  content?: unknown;
  output?: string;
  usage?: Usage;
  error?: string;
}

/**
 * Parse JSON lines from pi output
 */
export function parseJsonLines(output: string): OutputMessage[] {
  const messages: OutputMessage[] = [];
  const lines = output.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      messages.push(parsed);
    } catch {
      // Not valid JSON, skip
    }
  }

  return messages;
}

/**
 * Extract final assistant output from pi messages
 */
export function extractFinalOutput(messages: OutputMessage[]): string {
  const output: string[] = [];

  for (const message of messages) {
    if (message.type === "result" && typeof message.output === "string") {
      output.push(message.output);
    }
  }

  return output.join("\n\n");
}

/**
 * Extract usage from pi messages
 */
export function extractUsage(messages: OutputMessage[]): Usage | undefined {
  for (const message of messages) {
    if (message.usage) {
      return message.usage;
    }
  }

  return undefined;
}

/**
 * Collect and process output from pi subprocess
 */
export function collectOutput(rawOutput: string): {
  output: string;
  usage?: Usage;
  truncated: boolean;
} {
  const messages = parseJsonLines(rawOutput);

  // Extract final output
  const output = extractFinalOutput(messages);

  // If no structured messages found, use raw output
  const finalOutput = output || rawOutput.trim();

  // Extract usage
  const usage = extractUsage(messages);

  return {
    output: finalOutput,
    usage,
    truncated: false,
  };
}
