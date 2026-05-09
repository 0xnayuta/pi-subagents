import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import registerSubagentExtension from "../../src/extension/index.ts";
import { PI_SUBAGENT_CHILD } from "../../src/shared/types.ts";

const originalHome = process.env.HOME;
const originalChild = process.env[PI_SUBAGENT_CHILD];
let tempHome: string;

function createFakePi() {
  const tools: string[] = [];
  return {
    tools,
    registerTool(tool: { name: string }) {
      tools.push(tool.name);
    },
    on() {},
  };
}

describe("web tool extension registration", () => {
  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-home-"));
    process.env.HOME = tempHome;
    delete process.env[PI_SUBAGENT_CHILD];
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;

    if (originalChild === undefined) delete process.env[PI_SUBAGENT_CHILD];
    else process.env[PI_SUBAGENT_CHILD] = originalChild;

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("registers web tools and subagent in the parent process", () => {
    const pi = createFakePi();
    registerSubagentExtension(pi as any);

    assert.deepEqual(pi.tools, ["web_search", "fetch_content", "get_search_content", "subagent"]);
  });

  it("registers only web tools in child processes", () => {
    process.env[PI_SUBAGENT_CHILD] = "1";
    const pi = createFakePi();
    registerSubagentExtension(pi as any);

    assert.deepEqual(pi.tools, ["web_search", "fetch_content", "get_search_content"]);
  });

  it("honors webTools.enabled=false", () => {
    const configDir = path.join(tempHome, ".pi", "agent", "extensions", "subagent");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify({ webTools: { enabled: false } }),
      "utf-8"
    );

    const pi = createFakePi();
    registerSubagentExtension(pi as any);

    assert.deepEqual(pi.tools, ["subagent"]);
  });
});
