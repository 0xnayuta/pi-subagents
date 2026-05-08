import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mergeConfig } from "../../src/config/load-config.ts";
import { webSearch } from "../../src/web/search.ts";
import { clearResults, getSearchContent } from "../../src/web/storage.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.BRAVE_SEARCH_API_KEY;

function braveResponse(urls = ["https://example.com/a", "https://example.com/b"]): Response {
  return new Response(
    JSON.stringify({
      web: {
        results: [
          {
            title: "Result A",
            url: urls[0],
            description: "Snippet A",
            profile: { name: "Example" },
          },
          {
            title: "Result B",
            url: urls[1],
            description: "Snippet B",
          },
        ],
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}

function mockBraveFetch(calls: string[]) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    calls.push(String(input));
    return Promise.resolve(braveResponse());
  }) as typeof fetch;
}

describe("web_search", () => {
  beforeEach(() => {
    clearResults();
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.BRAVE_SEARCH_API_KEY;
    } else {
      process.env.BRAVE_SEARCH_API_KEY = originalApiKey;
    }
  });

  it("returns a structured error when query is missing", async () => {
    const result = await webSearch({}, mergeConfig({}));
    assert.deepEqual(result, {
      error: {
        code: "INVALID_INPUT",
        message: "web_search requires query or queries",
      },
    });
  });

  it("requires BRAVE_SEARCH_API_KEY for brave provider", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const result = await webSearch({ query: "typescript" }, mergeConfig({}));
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "WEB_SEARCH_FAILED");
      assert.match(result.error.message, /BRAVE_SEARCH_API_KEY/);
    }
  });

  it("normalizes multiple queries and stores search results", async () => {
    const calls: string[] = [];
    mockBraveFetch(calls);

    const result = await webSearch(
      { query: "typescript", queries: ["typescript", "node"], numResults: 2 },
      mergeConfig({})
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries.length, 2);
      assert.equal(result.queries[0].query, "typescript");
      assert.equal(result.queries[0].results.length, 2);
      assert.equal(result.queries[0].results[0].source, "Example");
      assert.equal(calls.length, 2);

      const stored = getSearchContent({ responseId: result.responseId, query: "node" }, 30_000);
      assert.equal("result" in stored, true);
      if ("result" in stored) {
        assert.equal(stored.result.query, "node");
      }
    }
  });

  it("stores fetched content when includeContent is true", async () => {
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.search.brave.com/")) {
        return Promise.resolve(braveResponse(["https://93.184.216.34/a", "https://93.184.216.34/b"]));
      }
      return Promise.resolve(
        new Response("<html><head><title>Fetched</title></head><body>Fetched content</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1, includeContent: true },
      mergeConfig({ webTools: { maxContentChars: 7 } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries[0].results[0].content?.title, "Fetched");
      assert.equal(result.queries[0].results[0].content?.content, "Fetched");
      assert.equal(result.queries[0].results[0].content?.truncated, true);
    }
  });
});
