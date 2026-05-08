import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearResults, getSearchContent, storeResult } from "../../src/web/storage.ts";

const fetchResult = {
  type: "fetch" as const,
  urls: [
    {
      url: "https://example.com/a",
      title: "A",
      content: "alpha content",
      truncated: false,
      contentType: "text/html",
    },
    {
      url: "https://example.com/b",
      title: "B",
      content: "beta content",
      truncated: false,
      contentType: "text/plain",
    },
  ],
};

const searchResult = {
  type: "search" as const,
  queries: [
    {
      query: "alpha",
      results: [
        {
          title: "Alpha",
          url: "https://example.com/a",
          snippet: "snippet",
          source: "test",
          content: fetchResult.urls[0],
        },
      ],
    },
  ],
};

describe("web storage get_search_content", () => {
  beforeEach(() => clearResults());

  it("returns a clear error for unknown responseId", () => {
    const result = getSearchContent({ responseId: "missing" }, 30_000);
    assert.deepEqual(result, {
      error: {
        code: "NOT_FOUND",
        message: "No stored web result found for responseId: missing",
      },
    });
  });

  it("retrieves fetch content by urlIndex", () => {
    const responseId = storeResult(fetchResult);
    const result = getSearchContent({ responseId, urlIndex: 1 }, 30_000);
    assert.equal("result" in result, true);
    if ("result" in result) {
      assert.equal(result.result.type, undefined);
      assert.equal(result.result.url, "https://example.com/b");
    }
  });

  it("retrieves fetch content by url", () => {
    const responseId = storeResult(fetchResult);
    const result = getSearchContent({ responseId, url: "https://example.com/a" }, 30_000);
    assert.equal("result" in result, true);
    if ("result" in result) {
      assert.equal(result.result.url, "https://example.com/a");
    }
  });

  it("retrieves search content by queryIndex", () => {
    const responseId = storeResult(searchResult);
    const result = getSearchContent({ responseId, queryIndex: 0 }, 30_000);
    assert.equal("result" in result, true);
    if ("result" in result) {
      assert.equal(result.result.query, "alpha");
    }
  });

  it("retrieves search content by query", () => {
    const responseId = storeResult(searchResult);
    const result = getSearchContent({ responseId, query: "alpha" }, 30_000);
    assert.equal("result" in result, true);
    if ("result" in result) {
      assert.equal(result.result.query, "alpha");
    }
  });

  it("truncates returned content without mutating stored content", () => {
    const responseId = storeResult({
      type: "fetch",
      urls: [{ url: "https://example.com", content: "0123456789", truncated: false }],
    });

    const truncated = getSearchContent({ responseId, urlIndex: 0 }, 5);
    const full = getSearchContent({ responseId, urlIndex: 0 }, 30_000);

    assert.equal("result" in truncated, true);
    assert.equal("result" in full, true);
    if ("result" in truncated && "result" in full) {
      assert.equal(truncated.result.content, "01234");
      assert.equal(truncated.result.truncated, true);
      assert.equal(full.result.content, "0123456789");
      assert.equal(full.result.truncated, false);
    }
  });
});
