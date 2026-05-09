import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mergeConfig } from "../../src/config/load-config.ts";
import { webSearch } from "../../src/web/search.ts";
import { clearResults, getSearchContent } from "../../src/web/storage.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.BRAVE_SEARCH_API_KEY;
const originalOpenSerpApiKey = process.env.OPENSERP_API_KEY;
const originalTavilyApiKey = process.env.TAVILY_API_KEY;
const originalSerperApiKey = process.env.SERPER_API_KEY;

function braveResponse(urls = ["https://example.com/a", "https://example.com/b"]): Response {
  return new Response(
    JSON.stringify({
      web: {
        results: urls.map((url, i) => ({
          title: `Result ${i + 1}`,
          url,
          description: `Snippet ${i + 1}`,
          ...(i === 0 ? { profile: { name: "Example" } } : {}),
        })),
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

    if (originalOpenSerpApiKey === undefined) {
      delete process.env.OPENSERP_API_KEY;
    } else {
      process.env.OPENSERP_API_KEY = originalOpenSerpApiKey;
    }

    if (originalTavilyApiKey === undefined) {
      delete process.env.TAVILY_API_KEY;
    } else {
      process.env.TAVILY_API_KEY = originalTavilyApiKey;
    }

    if (originalSerperApiKey === undefined) {
      delete process.env.SERPER_API_KEY;
    } else {
      process.env.SERPER_API_KEY = originalSerperApiKey;
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

  it("rejects unsupported provider values at runtime", async () => {
    const config = mergeConfig({});
    const result = await webSearch(
      { query: "typescript" },
      {
        ...config,
        webTools: {
          ...config.webTools,
          provider: "duckduckgo" as any,
        },
      }
    );
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "INVALID_INPUT");
      assert.match(result.error.message, /Unsupported web_search provider/);
    }
  });

  it("requires BRAVE_SEARCH_API_KEY for brave provider", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const result = await webSearch(
      { query: "typescript" },
      mergeConfig({ webTools: { provider: "brave" } })
    );
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "WEB_SEARCH_AUTH_REQUIRED");
      assert.match(result.error.message, /BRAVE_SEARCH_API_KEY/);
    }
  });

  it("uses ddgs fallback in auto mode when BRAVE_SEARCH_API_KEY is missing", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    const calls: string[] = [];
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.resolve(
        new Response(
          `<html><body>
            <a href="/settings">Settings</a>
            <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Result A</a>
            <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fb">Result B</a>
          </body></html>`,
          { status: 200, headers: { "content-type": "text/html" } }
        )
      );
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 2 },
      mergeConfig({ webTools: { provider: "auto" } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(calls.length, 1);
      assert.match(calls[0], /lite\.duckduckgo\.com\/lite\//);
      assert.equal(result.queries[0].results.length, 2);
      assert.equal(result.queries[0].results[0].url, "https://example.com/a");
      assert.equal(result.queries[0].results[0].source, "duckduckgo-lite");
    }
  });

  it("prefers brave in auto mode when BRAVE_SEARCH_API_KEY is present", async () => {
    const calls: string[] = [];
    mockBraveFetch(calls);

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "auto" } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(calls.length, 1);
      assert.match(calls[0], /api\.search\.brave\.com/);
    }
  });

  it("supports explicit openserp provider", async () => {
    process.env.OPENSERP_API_KEY = "openserp-test-key";

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            organic_results: [
              {
                title: "OpenSERP Result",
                link: "https://example.com/openserp",
                snippet: "OpenSERP Snippet",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "openserp", openserp: { enabled: true } } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries[0].results[0].url, "https://example.com/openserp");
      assert.equal(result.queries[0].results[0].source, "openserp");
    }

    delete process.env.OPENSERP_API_KEY;
  });

  it("supports explicit searxng provider", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "SearXNG Result",
                url: "https://example.com/searxng",
                content: "SearXNG Snippet",
                engine: "google",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "searxng", searxng: { enabled: true } } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries[0].results[0].url, "https://example.com/searxng");
      assert.equal(result.queries[0].results[0].source, "google");
    }
  });

  it("supports explicit tavily provider", async () => {
    process.env.TAVILY_API_KEY = "tavily-test-key";

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      assert.match(String(input), /api\.tavily\.com\/search/);
      assert.equal(init?.method, "POST");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Tavily Result",
                url: "https://example.com/tavily",
                content: "Tavily Snippet",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "tavily", tavily: { enabled: true } } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries[0].results[0].url, "https://example.com/tavily");
      assert.equal(result.queries[0].results[0].source, "tavily");
    }
  });

  it("supports explicit serper provider", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      assert.match(String(input), /google\.serper\.dev\/search/);
      assert.equal(init?.method, "POST");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            organic: [
              {
                title: "Serper Result",
                link: "https://example.com/serper",
                snippet: "Serper Snippet",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "serper", serper: { enabled: true } } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.queries[0].results[0].url, "https://example.com/serper");
      assert.equal(result.queries[0].results[0].source, "serper");
    }
  });

  it("classifies commercial provider missing key as auth required", async () => {
    delete process.env.TAVILY_API_KEY;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "tavily", tavily: { enabled: true } } })
    );

    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "WEB_SEARCH_AUTH_REQUIRED");
      assert.match(result.error.message, /credentials/i);
    }
  });

  it("returns actionable error when explicit provider is unavailable", async () => {
    delete process.env.OPENSERP_API_KEY;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({ webTools: { provider: "openserp" } })
    );

    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "INVALID_INPUT");
      assert.match(result.error.message, /unavailable/i);
    }
  });

  it("respects auto providerPriority order", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    const calls: string[] = [];
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input).includes("127.0.0.1:8080")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [{ title: "SearXNG", url: "https://example.com/priority", content: "ok" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("not found", { status: 404 }));
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 1 },
      mergeConfig({
        webTools: {
          provider: "auto",
          providerPriority: ["searxng", "ddgs"],
          searxng: { enabled: true, baseUrl: "http://127.0.0.1:8080" },
        },
      })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.match(calls[0], /127\.0\.0\.1:8080/);
      assert.equal(result.queries[0].results[0].url, "https://example.com/priority");
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

  it("classifies provider rate limit errors", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Too Many Requests", { status: 429, statusText: "Too Many Requests" }))) as typeof fetch;

    const result = await webSearch({ query: "typescript" }, mergeConfig({}));
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "WEB_SEARCH_RATE_LIMIT");
      assert.match(result.error.message, /429/);
    }
  });

  it("classifies timeout/abort with actionable guidance", async () => {
    globalThis.fetch = (() =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new DOMException("The operation was aborted", "AbortError")), 5);
      })) as typeof fetch;

    const result = await webSearch({ query: "typescript" }, mergeConfig({ webTools: { timeoutMs: 1 } }));
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.error.code, "SUBAGENT_TIMEOUT");
      assert.match(result.error.message, /fewer queries|timeoutMs/i);
    }
  });

  it("limits includeContent fetch concurrency", async () => {
    let active = 0;
    let maxActive = 0;

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.search.brave.com/")) {
        return Promise.resolve(
          braveResponse([
            "https://93.184.216.34/a",
            "https://93.184.216.34/b",
            "https://93.184.216.34/c",
            "https://93.184.216.34/d",
            "https://93.184.216.34/e",
          ])
        );
      }

      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        setTimeout(() => {
          active -= 1;
          resolve(
            new Response("<html><body>content</body></html>", {
              status: 200,
              headers: { "content-type": "text/html" },
            })
          );
        }, 15);
      });
    }) as typeof fetch;

    const result = await webSearch(
      { query: "typescript", numResults: 5, includeContent: true },
      mergeConfig({})
    );

    assert.equal("responseId" in result, true);
    assert.equal(maxActive <= 3, true);
    assert.equal(maxActive >= 2, true);
  });
});
