/**
 * Minimal settings for subagent execution
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TEMP_ROOT_DIR } from "./types.ts";

// Cleanup old chain directories
export function cleanupOldChainDirs(): void {
	try {
		if (!fs.existsSync(TEMP_ROOT_DIR)) return;
		const entries = fs.readdirSync(TEMP_ROOT_DIR);
		for (const entry of entries) {
			const fullPath = path.join(TEMP_ROOT_DIR, entry);
			const stat = fs.statSync(fullPath);
			// Remove directories older than 24 hours
			if (stat.isDirectory() && Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
				try {
					fs.rmSync(fullPath, { recursive: true, force: true });
				} catch {
					// Best effort cleanup
				}
			}
		}
	} catch {
		// Best effort cleanup
	}
}

// Get default session directory
export function getDefaultSessionDir(): string {
	return TEMP_ROOT_DIR;
}
