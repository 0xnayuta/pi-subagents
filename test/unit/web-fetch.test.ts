import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeConfig } from "../../src/config/load-config.ts";
import { fetchContent } from "../../src/web/fetch.ts";

const config = mergeConfig({});

describe("fetch_content", () => {
  it("returns a structured error when URL is missing", async () => {
    const result = await fetchContent({}, config);
    assert.deepEqual(result, {
      error: {
        code: "INVALID_INPUT",
        message: "fetch_content requires url or urls",
      },
    });
  });

  it("rejects non-http URLs", async () => {
    const result = await fetchContent({ url: "file:///etc/passwd" }, config);
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "FETCH_CONTENT_FAILED");
      assert.match(result.error.message, /Unsupported URL protocol/);
    }
  });

  it("rejects localhost URLs before fetching", async () => {
    const result = await fetchContent({ url: "http://localhost:3000" }, config);
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "FETCH_CONTENT_FAILED");
      assert.match(result.error.message, /Blocked private hostname/);
    }
  });
});
