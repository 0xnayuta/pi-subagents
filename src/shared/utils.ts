/**
 * Minimal utility functions for the subagent extension
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Resolve child working directory
 */
export function resolveChildCwd(baseCwd: string, childCwd: string | undefined): string {
	if (!childCwd) return baseCwd;
	return path.isAbsolute(childCwd) ? childCwd : path.resolve(baseCwd, childCwd);
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
	try {
		return fs.existsSync(filePath);
	} catch {
		return false;
	}
}

/**
 * Read file content
 */
export function readFile(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Get error message from error
 */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Read last lines from a file
 */
export function readLastLines(filePath: string, maxLines: number = 5): string[] {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const lines = content.split("\n");
		return lines.slice(-maxLines).filter((line) => line.trim());
	} catch {
		return [];
	}
}

/**
 * Find latest session file in directory
 */
export function findLatestSessionFile(dirPath: string): string | undefined {
	try {
		const files = fs.readdirSync(dirPath);
		const sessionFiles = files.filter((f) => f.endsWith(".jsonl"));
		if (sessionFiles.length === 0) return undefined;

		sessionFiles.sort((a, b) => {
			const statA = fs.statSync(path.join(dirPath, a));
			const statB = fs.statSync(path.join(dirPath, b));
			return statB.mtimeMs - statA.mtimeMs;
		});

		return path.join(dirPath, sessionFiles[0]!);
	} catch {
		return undefined;
	}
}
