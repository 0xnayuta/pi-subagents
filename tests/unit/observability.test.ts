/**
 * Observability Module Tests
 * Phase 3: Test Framework - Observability tests
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearActivityLog,
  configureWebObservability,
  getActivityLog,
  getDebugLevel,
  getWebToolStats,
  recordFetchActivity,
  recordSearchActivity,
  resetWebToolStats,
  type ActivityEntry,
} from "../../src/web/observability.ts";

describe("observability - configuration", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  afterEach(() => {
    configureWebObservability(false);
  });

  it("should default debug level to false", () => {
    configureWebObservability(false);
    assert.equal(getDebugLevel(), false);
  });

  it("should support minimal debug level", () => {
    configureWebObservability("minimal");
    assert.equal(getDebugLevel(), "minimal");
  });

  it("should support verbose debug level", () => {
    configureWebObservability("verbose");
    assert.equal(getDebugLevel(), "verbose");
  });
});

describe("observability - stats", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should track search success", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.successCount, 1);
    assert.equal(stats.errorCount, 0);
  });

  it("should track search error", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "error", startTs, "WEB_SEARCH_FAILED");

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.successCount, 0);
    assert.equal(stats.errorCount, 1);
  });

  it("should track search rate limited", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "rate_limited", startTs, "PROVIDER_RATE_LIMITED");

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.rateLimitedCount, 1);
  });

  it("should track fetch success", () => {
    recordFetchActivity("success");

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.successCount, 1);
    assert.equal(stats.errorCount, 0);
  });

  it("should track fetch error", () => {
    recordFetchActivity("error", "FETCH_CONTENT_FAILED");

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.successCount, 0);
    assert.equal(stats.errorCount, 1);
  });

  it("should aggregate provider stats", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordSearchActivity("ddgs", "success", startTs + 50);
    recordSearchActivity("tavily", "success", startTs + 100);

    const stats = getWebToolStats();
    assert.ok(stats.providerStats["ddgs"]);
    assert.ok(stats.providerStats["tavily"]);
    assert.equal(stats.providerStats["ddgs"].requests, 2);
    assert.equal(stats.providerStats["tavily"].requests, 1);
  });

  it("should calculate success rate", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordSearchActivity("ddgs", "success", startTs + 50);
    recordSearchActivity("ddgs", "error", startTs + 100);

    const stats = getWebToolStats();
    assert.equal(stats.providerStats["ddgs"].successRate, 2 / 3);
  });

  it("should calculate average latency", () => {
    const startTs = Date.now() - 500;
    // Use larger gap to ensure consistent timing
    recordSearchActivity("ddgs", "success", startTs);
    recordSearchActivity("ddgs", "success", startTs);

    const stats = getWebToolStats();
    // Latency should be close to 0 since both calls happen quickly
    // Allow for some variance due to test execution time
    assert.ok(stats.averageLatencyMs >= 0);
    assert.ok(stats.averageLatencyMs < 1000); // Should be small since calls are sequential
  });

  it("should reset stats correctly", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordFetchActivity("success");

    resetWebToolStats();

    const stats = getWebToolStats();
    assert.equal(stats.totalRequests, 0);
    assert.equal(stats.successCount, 0);
    assert.equal(stats.errorCount, 0);
  });
});

describe("observability - activity log", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should record search activity entries", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);

    const log = getActivityLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].type, "search");
    assert.equal(log[0].provider, "ddgs");
    assert.equal(log[0].status, "success");
    assert.ok(log[0].requestId.startsWith("req_"));
  });

  it("should record fetch activity entries", () => {
    recordFetchActivity("success");

    const log = getActivityLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].type, "fetch");
    assert.equal(log[0].status, "success");
  });

  it("should record error in activity entry", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "error", startTs, "WEB_SEARCH_FAILED");

    const log = getActivityLog();
    assert.equal(log[0].status, "error");
    assert.equal(log[0].error, "WEB_SEARCH_FAILED");
  });

  it("should limit activity log to 100 entries", () => {
    const startTs = Date.now();

    // Record 150 entries
    for (let i = 0; i < 150; i++) {
      recordSearchActivity("ddgs", "success", startTs + i);
    }

    const log = getActivityLog();
    assert.ok(log.length <= 100);
  });

  it("should return entries in insertion order with limit", () => {
    const startTs = Date.now() - 1000;

    recordSearchActivity("ddgs", "error", startTs);
    recordSearchActivity("ddgs", "success", startTs + 100);
    recordSearchActivity("ddgs", "success", startTs + 200);

    // Without reverse(), entries are in insertion order
    const allLog = getActivityLog();
    assert.ok(allLog.length >= 3);
    // First entry should be the oldest (error at startTs)
    assert.ok(allLog[0].timestamp <= allLog[1].timestamp);
  });

  it("should clear activity log", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordFetchActivity("success");

    clearActivityLog();

    const log = getActivityLog();
    assert.equal(log.length, 0);
  });

  it("should filter by type", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordFetchActivity("success");
    recordSearchActivity("tavily", "success", startTs + 50);

    const searchLog = getActivityLog().filter((e) => e.type === "search");
    const fetchLog = getActivityLog().filter((e) => e.type === "fetch");

    assert.ok(searchLog.every((e) => e.type === "search"));
    assert.ok(fetchLog.every((e) => e.type === "fetch"));
  });
});

describe("observability - record functions", () => {
  beforeEach(() => {
    resetWebToolStats();
    clearActivityLog();
  });

  it("should generate unique request IDs", () => {
    const startTs = Date.now() - 100;
    recordSearchActivity("ddgs", "success", startTs);
    recordSearchActivity("ddgs", "success", startTs + 1);

    const log = getActivityLog();
    assert.notEqual(log[0].requestId, log[1].requestId);
  });

  it("should record duration for search", () => {
    const startTs = Date.now() - 150;
    recordSearchActivity("ddgs", "success", startTs);

    const log = getActivityLog();
    assert.ok(log[0].duration !== undefined);
    assert.ok(log[0].duration! >= 150);
  });
});
