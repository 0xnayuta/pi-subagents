/**
 * Activity Panel Tests
 * Phase 6: UI Integration - Activity panel component tests
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ActivityPanel,
  createActivityPanel,
  type ActivityPanelOptions,
} from "../../src/extension/commands/activity.ts";
import {
  clearActivityLog,
  recordSearchActivity,
  resetWebToolStats,
} from "../../src/web/observability.ts";

describe("activity panel - ActivityPanel", () => {
  let panel: ActivityPanel;

  beforeEach(() => {
    clearActivityLog();
    resetWebToolStats();
    panel = new ActivityPanel({ maxEntries: 10 });
  });

  afterEach(() => {
    panel.dispose();
  });

  it("should create with default options", () => {
    const defaultPanel = new ActivityPanel();
    assert.ok(defaultPanel);
    defaultPanel.dispose();
  });

  it("should create with custom options", () => {
    const options: ActivityPanelOptions = {
      maxEntries: 20,
      showStats: true,
      autoRefresh: false,
    };
    const customPanel = new ActivityPanel(options);
    assert.ok(customPanel);
    customPanel.dispose();
  });

  it("should render header", () => {
    const lines = panel.render(80);
    assert.ok(lines.length > 0);
    assert.ok(lines[0]!.includes("Web Tool Activity"));
  });

  it("should render stats bar", () => {
    const lines = panel.render(80);
    assert.ok(lines.some((line) => line.includes("total:")));
    assert.ok(lines.some((line) => line.includes("success:")));
  });

  it("should render empty state", () => {
    const lines = panel.render(80);
    assert.ok(lines.some((line) => line.includes("no recent activity")));
  });

  it("should render activity entries", () => {
    // Add some activity
    recordSearchActivity({
      requestId: "test-1",
      type: "search",
      status: "success",
      duration: 100,
      provider: "ddgs",
    });

    // Refresh the panel to pick up new activity
    panel.refresh();

    const lines = panel.render(80);

    // Should show entries
    assert.ok(lines.some((line) => line.includes("SEARCH")));
  });

  it("should render help bar", () => {
    const lines = panel.render(80);
    assert.ok(lines.some((line) => line.includes("navigate")));
    assert.ok(lines.some((line) => line.includes("refresh")));
    assert.ok(lines.some((line) => line.includes("close")));
  });

  it("should handle escape key to close", () => {
    let closed = false;
    panel.setOnClose(() => {
      closed = true;
    });

    panel.handleInput("escape");
    assert.equal(closed, true);
  });

  it("should handle 'r' key to refresh", () => {
    // Add activity
    recordSearchActivity({
      requestId: "test-r",
      type: "search",
      status: "success",
      duration: 50,
    });

    // This should not throw
    panel.handleInput("r");
  });

  it("should handle 'c' key to clear logs", () => {
    // Add activity
    recordSearchActivity({
      requestId: "test-c",
      type: "search",
      status: "success",
      duration: 50,
    });

    panel.handleInput("c");

    // Log should be cleared
    const lines = panel.render(80);
    assert.ok(lines.some((line) => line.includes("no recent activity")));
  });

  it("should handle 's' key to reset stats", () => {
    // Add activity
    recordSearchActivity({
      requestId: "test-s",
      type: "search",
      status: "success",
      duration: 50,
    });

    panel.handleInput("s");

    // Stats should be reset
    const lines = panel.render(80);
    assert.ok(lines.some((line) => line.includes("total:0")));
  });

  it("should handle up arrow key navigation", () => {
    // Add multiple entries
    for (let i = 0; i < 5; i++) {
      recordSearchActivity({
        requestId: `test-up-${i}`,
        type: "search",
        status: "success",
        duration: 50,
      });
    }

    panel.refresh();

    // Navigate up - should not crash
    panel.handleInput("\x1b[A");
    panel.handleInput("\x1b[A");
  });

  it("should handle down arrow key navigation", () => {
    panel.handleInput("\x1b[B");
  });

  it("should invalidate cached lines", () => {
    // Render once
    panel.render(80);

    // Invalidate
    panel.invalidate();

    // Should be able to render again
    const lines = panel.render(80);
    assert.ok(lines.length > 0);
  });

  it("should cache lines by width", () => {
    // Render with width 80
    const lines1 = panel.render(80);

    // Same width should return cached result
    const lines2 = panel.render(80);
    assert.deepEqual(lines1, lines2);

    // Different width should recalculate
    const lines3 = panel.render(60);
    assert.ok(lines3.length > 0);
  });
});

describe("activity panel - createActivityPanel factory", () => {
  afterEach(() => {
    clearActivityLog();
    resetWebToolStats();
  });

  it("should create panel with default options", () => {
    const panel = createActivityPanel();
    assert.ok(panel);
    panel.dispose();
  });

  it("should create panel with custom options", () => {
    const panel = createActivityPanel({
      maxEntries: 25,
      autoRefresh: true,
    });
    assert.ok(panel);
    panel.dispose();
  });
});
