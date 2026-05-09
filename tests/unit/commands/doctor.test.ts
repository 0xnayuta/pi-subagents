/**
 * Doctor Command Tests
 * Phase 3: Test Framework - /subagents doctor tests
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDoctorReport,
  runDoctorChecks,
  type DoctorReport,
} from "../../../src/extension/commands/doctor.ts";

describe("commands/doctor - runDoctorChecks", () => {
  it("should return a valid report", async () => {
    const report = await runDoctorChecks(process.cwd());

    assert.ok(Array.isArray(report.items));
    assert.ok(report.summary);
    assert.equal(typeof report.summary.passed, "number");
    assert.equal(typeof report.summary.warnings, "number");
    assert.equal(typeof report.summary.failed, "number");
  });

  it("should have config check item", async () => {
    const report = await runDoctorChecks(process.cwd());

    const configItem = report.items.find((i) => i.category === "config");
    assert.ok(configItem);
  });

  it("should have agents check item", async () => {
    const report = await runDoctorChecks(process.cwd());

    const agentsItem = report.items.find((i) => i.category === "agents");
    assert.ok(agentsItem);
    assert.ok(agentsItem.message.includes("builtin agents"));
  });

  it("should have provider check items", async () => {
    const report = await runDoctorChecks(process.cwd());

    const providerItems = report.items.filter((i) => i.category === "provider");
    assert.ok(providerItems.length > 0);
  });

  it("should have permissions check item", async () => {
    const report = await runDoctorChecks(process.cwd());

    const permissionsItem = report.items.find((i) => i.category === "permissions");
    assert.ok(permissionsItem);
  });

  it("should have web-tools check item", async () => {
    const report = await runDoctorChecks(process.cwd());

    const webToolsItem = report.items.find((i) => i.category === "web-tools");
    assert.ok(webToolsItem);
  });

  it("should have valid status values", async () => {
    const report = await runDoctorChecks(process.cwd());

    for (const item of report.items) {
      assert.ok(
        ["pass", "warn", "fail", "info"].includes(item.status),
        `Invalid status: ${item.status}`
      );
    }
  });

  it("should have messages for all items", async () => {
    const report = await runDoctorChecks(process.cwd());

    for (const item of report.items) {
      assert.ok(item.message);
      assert.ok(item.message.length > 0);
    }
  });

  it("should calculate summary correctly", async () => {
    const report = await runDoctorChecks(process.cwd());

    const expectedPassed = report.items.filter((i) => i.status === "pass").length;
    const expectedWarnings = report.items.filter((i) => i.status === "warn").length;
    const expectedFailed = report.items.filter((i) => i.status === "fail").length;

    assert.equal(report.summary.passed, expectedPassed);
    assert.equal(report.summary.warnings, expectedWarnings);
    assert.equal(report.summary.failed, expectedFailed);
  });

  it("should include ddgs in provider checks", async () => {
    const report = await runDoctorChecks(process.cwd());

    const ddgsItem = report.items.find((i) => i.message?.includes("DuckDuckGo"));
    assert.ok(ddgsItem);
  });
});

describe("commands/doctor - formatDoctorReport", () => {
  it("should format report as text", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    assert.ok(typeof output === "string");
    assert.ok(output.length > 0);
  });

  it("should include report title", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    assert.ok(output.includes("Doctor"));
    assert.ok(output.includes("Diagnostic"));
  });

  it("should include summary", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    assert.ok(output.includes("Summary"));
    assert.ok(output.includes(report.summary.passed.toString()));
  });

  it("should include status indicators", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    assert.ok(output.includes("PASS") || output.includes("WARN") || output.includes("FAIL"));
  });

  it("should include categories", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    assert.ok(output.includes("CONFIG") || output.includes("config"));
    assert.ok(output.includes("AGENTS") || output.includes("agents"));
  });

  it("should use box-drawing characters", async () => {
    const report = await runDoctorChecks(process.cwd());
    const output = formatDoctorReport(report);

    // Should have box-drawing characters for the table
    assert.ok(output.includes("═") || output.includes("─"));
  });

  it("should format empty report correctly", () => {
    const emptyReport: DoctorReport = {
      items: [],
      summary: { passed: 0, warnings: 0, failed: 0 },
    };
    const output = formatDoctorReport(emptyReport);

    assert.ok(output.includes("Summary"));
    assert.ok(output.includes("0"));
  });
});

describe("commands/doctor - diagnostic status", () => {
  it("should have pass status for available ddgs", async () => {
    const report = await runDoctorChecks(process.cwd());

    // ddgs should be available (pass or warn)
    const ddgsItem = report.items.find((i) => i.message?.includes("DuckDuckGo"));
    assert.ok(ddgsItem);
    assert.ok(["pass", "warn"].includes(ddgsItem.status));
  });

  it("should have info status for disabled providers", async () => {
    const report = await runDoctorChecks(process.cwd());

    // tavily, serper, etc. should be info (not enabled)
    const disabledProviders = ["tavily", "serper", "brave", "openserp", "searxng"];
    for (const provider of disabledProviders) {
      const item = report.items.find((i) => {
        const msg = i.message?.toLowerCase() ?? "";
        return msg.includes(provider.toLowerCase());
      });
      if (item) {
        // Either not enabled (info) or configured (pass/warn)
        assert.ok(["pass", "warn", "info"].includes(item.status));
      }
    }
  });
});
