import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mergeConfig } from "../../src/config/load-config.ts";
import { fetchContent } from "../../src/web/fetch.ts";

const originalFetch = globalThis.fetch;

describe("fetch_content extraction and limits", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("extracts text from HTML and truncates tool output", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response("<html><head><title>Hello</title></head><body><script>x</script><h1>Hello</h1><p>World</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )) as typeof fetch;

    const result = await fetchContent(
      { url: "https://93.184.216.34/page" },
      mergeConfig({ webTools: { maxContentChars: 8 } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.results[0].title, "Hello");
      assert.equal(result.results[0].content, "Hello He");
      assert.equal(result.results[0].truncated, true);
    }
  });

  it("falls back to Jina reader for JS-heavy pages when enabled", async () => {
    const calls: string[] = [];

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://r.jina.ai/")) {
        return Promise.resolve(
          new Response("Markdown Content:\n# Better Title\n\nThis is useful extracted content from Jina.", {
            status: 200,
            headers: { "content-type": "text/plain" },
          })
        );
      }

      return Promise.resolve(
        new Response(
          "<html><head><title>Stub</title></head><body><script>a</script><script>b</script><script>c</script><script>d</script><div id='app'></div></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html" },
          }
        )
      );
    }) as typeof fetch;

    const result = await fetchContent(
      { url: "https://93.184.216.34/js" },
      mergeConfig({ webTools: { enableJinaFallback: true } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.results[0].title, "Better Title");
      assert.match(result.results[0].content, /useful extracted content/i);
      assert.equal(result.results[0].contentType, "text/markdown; source=jina");
    }

    assert.equal(calls.some((c) => c.startsWith("https://r.jina.ai/")), true);
  });

  it("limits the number of response bytes read", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response("0123456789", {
          status: 200,
          headers: { "content-type": "text/plain" },
        })
      )) as typeof fetch;

    const result = await fetchContent(
      { url: "https://93.184.216.34/text" },
      mergeConfig({ webTools: { maxResponseBytes: 5, maxContentChars: 100 } })
    );

    assert.equal("responseId" in result, true);
    if ("responseId" in result) {
      assert.equal(result.results[0].content, "01234");
      assert.equal(result.results[0].truncated, true);
    }
  });
});
