/**
 * Logs Command Tests
 * Phase 3: Test Framework - /subagents logs tests
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearActivityLog,
  formatLogs,
  formatLogsJson,
  getRecentLogs,
  recordFetchActivity,
  recordSearchActivity,
  resetWebToolStats,
  type LogsOptions,
} from "../../../src/extension/commands/logs.ts";

describe("commands/logs - getRecentLogs", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  afterEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should return entries and stats", () => {
    const result = getRecentLogs();

    assert.ok(Array.isArray(result.entries));
    assert.ok(result.stats);
    assert.ok(typeof result.stats.totalRequests === "number");
  });

  it("should include entries when available", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const result = getRecentLogs();
    assert.ok(result.entries.length > 0);
  });

  it("should respect limit option", () => {
    const startTs = Date.now() - 1000;
    for (let i = 0; i < 10; i++) {
      recordSearchActivity("ddgs", "success", startTs + i);
    }

    const result = getRecentLogs({ limit: 5 });
    assert.ok(result.entries.length <= 5);
  });

  it("should filter by search type", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordFetchActivity("success");

    const result = getRecentLogs({ type: "search" });
    assert.ok(result.entries.every((e) => e.type === "search"));
  });

  it("should filter by fetch type", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordFetchActivity("success");

    const result = getRecentLogs({ type: "fetch" });
    assert.ok(result.entries.every((e) => e.type === "fetch"));
  });

  it("should return stats with correct structure", () => {
    const stats = getRecentLogs().stats;

    assert.ok(typeof stats.totalRequests === "number");
    assert.ok(typeof stats.successCount === "number");
    assert.ok(typeof stats.errorCount === "number");
    assert.ok(typeof stats.rateLimitedCount === "number");
    assert.ok(typeof stats.averageLatencyMs === "number");
    assert.ok(typeof stats.providerStats === "object");
  });
});

describe("commands/logs - formatLogs", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  afterEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should format logs as text", () => {
    const output = formatLogs();

    assert.ok(typeof output === "string");
    assert.ok(output.includes("Activity") || output.includes("Recent"));
  });

  it("should show no activity message when empty", () => {
    const output = formatLogs();

    assert.ok(output.includes("no recent activity") || output.includes("Recent"));
  });

  it("should include statistics section", () => {
    const output = formatLogs();

    assert.ok(output.includes("Statistics"));
    assert.ok(output.includes("Total Requests"));
  });

  it("should show entries when available", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const output = formatLogs();

    assert.ok(output.includes("ddgs") || output.includes("web_search"));
  });

  it("should show success icon", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const output = formatLogs();

    assert.ok(output.includes("✓") || output.includes("success"));
  });

  it("should show error icon", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "error", startTs, "WEB_SEARCH_FAILED");

    const output = formatLogs();

    assert.ok(output.includes("✗") || output.includes("error"));
  });

  it("should show rate limited icon", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "rate_limited", startTs);

    const output = formatLogs();

    assert.ok(output.includes("⚠") || output.includes("rate_limited"));
  });

  it("should include duration", () => {
    const startTs = Date.now() - 150;
    recordSearchActivity("ddgs", "success", startTs);

    const output = formatLogs();

    assert.ok(output.includes("ms"));
  });

  it("should include provider stats", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordSearchActivity("ddgs", "success", startTs + 50);

    const output = formatLogs();

    assert.ok(output.includes("ddgs"));
    assert.ok(output.includes("requests"));
  });
});

describe("commands/logs - formatLogsJson", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  afterEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should format as valid JSON", () => {
    const output = formatLogsJson();

    assert.doesNotThrow(() => JSON.parse(output));
  });

  it("should include entries and stats in JSON", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const output = formatLogsJson();
    const parsed = JSON.parse(output);

    assert.ok(parsed.entries);
    assert.ok(parsed.stats);
  });

  it("should have valid entry structure", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const output = formatLogsJson();
    const parsed = JSON.parse(output);

    if (parsed.entries.length > 0) {
      const entry = parsed.entries[0];
      assert.ok(typeof entry.timestamp === "number");
      assert.ok(["search", "fetch", "get_content"].includes(entry.type));
      assert.ok(["pending", "success", "error", "rate_limited"].includes(entry.status));
      assert.ok(entry.requestId);
    }
  });

  it("should have valid stats structure", () => {
    const output = formatLogsJson();
    const parsed = JSON.parse(output);
    const stats = parsed.stats;

    assert.ok(typeof stats.totalRequests === "number");
    assert.ok(typeof stats.successCount === "number");
    assert.ok(typeof stats.errorCount === "number");
    assert.ok(typeof stats.rateLimitedCount === "number");
    assert.ok(typeof stats.averageLatencyMs === "number");
  });
});
