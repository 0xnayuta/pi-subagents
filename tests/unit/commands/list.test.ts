/**
 * List Command Tests
 * Phase 3: Test Framework - /subagents list tests
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAgentList, formatAgentListJson, getAgentList } from "../../../src/extension/commands/list.ts";

describe("commands/list - getAgentList", () => {
  it("should return agent list structure", () => {
    // Use the project root as cwd
    const report = getAgentList(process.cwd());

    assert.ok(Array.isArray(report.builtin));
    assert.ok(Array.isArray(report.user));
    assert.ok(Array.isArray(report.project));
    assert.equal(typeof report.total, "number");
  });

  it("should include builtin agents", () => {
    const report = getAgentList(process.cwd());

    // Should have at least 5 builtin agents
    assert.ok(report.builtin.length >= 5);

    // Should have explorer
    const explorer = report.builtin.find((a) => a.name === "explorer");
    assert.ok(explorer);
    assert.equal(explorer.source, "builtin");
  });

  it("should have correct agent properties", () => {
    const report = getAgentList(process.cwd());
    const explorer = report.builtin.find((a) => a.name === "explorer");

    assert.ok(explorer);
    assert.equal(typeof explorer.name, "string");
    assert.equal(typeof explorer.description, "string");
    assert.equal(typeof explorer.readonly, "boolean");
    assert.ok(["builtin", "user", "project"].includes(explorer.source));
  });

  it("should calculate total correctly", () => {
    const report = getAgentList(process.cwd());
    const expected = report.builtin.length + report.user.length + report.project.length;
    assert.equal(report.total, expected);
  });
});

describe("commands/list - formatAgentList", () => {
  it("should format agent list as text", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    assert.ok(output.includes("Available Agents"));
    assert.ok(output.includes(report.total.toString()));
  });

  it("should include builtin section", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    assert.ok(output.includes("[builtin]"));
  });

  it("should include agent names", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    // Should have explorer and researcher
    assert.ok(output.includes("explorer"));
    assert.ok(output.includes("researcher"));
  });

  it("should include readonly tag", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    assert.ok(output.includes("(readonly)"));
  });

  it("should include usage example", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    assert.ok(output.includes("subagent({"));
  });

  it("should truncate long descriptions", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentList(report);

    // Check that lines don't exceed reasonable length
    const lines = output.split("\n");
    for (const line of lines) {
      if (!line.includes("...")) {
        assert.ok(line.length <= 100, `Line too long: ${line}`);
      }
    }
  });
});

describe("commands/list - formatAgentListJson", () => {
  it("should format as valid JSON", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentListJson(report);

    assert.doesNotThrow(() => JSON.parse(output));
  });

  it("should include all fields in JSON", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentListJson(report);
    const parsed = JSON.parse(output);

    assert.ok(parsed.builtin);
    assert.ok(parsed.user);
    assert.ok(parsed.project);
    assert.ok(parsed.total);
  });

  it("should have same data as report", () => {
    const report = getAgentList(process.cwd());
    const output = formatAgentListJson(report);
    const parsed = JSON.parse(output);

    assert.equal(parsed.total, report.total);
    assert.equal(parsed.builtin.length, report.builtin.length);
    assert.equal(parsed.user.length, report.user.length);
    assert.equal(parsed.project.length, report.project.length);
  });
});
