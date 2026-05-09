/**
 * Cache Module Tests
 * Phase 4: Performance Optimization - Cache tests
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  SearchResultCache,
  initializeSearchCache,
  getSearchCache,
  resetSearchCache,
} from "../../src/web/cache.ts";

describe("cache - SearchResultCache", () => {
  let cache: SearchResultCache;

  beforeEach(() => {
    resetSearchCache();
    cache = new SearchResultCache({ enabled: true, maxEntries: 10, ttlMs: 60000 });
  });

  afterEach(() => {
    cache.clear();
  });

  it("should be disabled by default", () => {
    const defaultCache = new SearchResultCache();
    assert.equal(defaultCache.getConfig().enabled, false);
  });

  it("should store and retrieve results", () => {
    const results = [{ query: "test", results: [] }];
    cache.set("test", "ddgs", 5, results);

    const cached = cache.get("test", "ddgs", 5);
    assert.ok(cached);
    assert.equal(cached.length, 1);
    assert.equal(cached[0].query, "test");
  });

  it("should return null for cache miss", () => {
    const cached = cache.get("nonexistent", "ddgs", 5);
    assert.equal(cached, null);
  });

  it("should differentiate by provider", () => {
    const ddgsResults = [{ query: "test", results: [{ title: "DDGS" }] }];
    const tavilyResults = [{ query: "test", results: [{ title: "Tavily" }] }];

    cache.set("test", "ddgs", 5, ddgsResults);
    cache.set("test", "tavily", 5, tavilyResults);

    const ddgsCached = cache.get("test", "ddgs", 5);
    const tavilyCached = cache.get("test", "tavily", 5);

    assert.ok(ddgsCached);
    assert.ok(tavilyCached);
    assert.equal(ddgsCached[0].results[0].title, "DDGS");
    assert.equal(tavilyCached[0].results[0].title, "Tavily");
  });

  it("should differentiate by numResults", () => {
    const results5 = [{ query: "test", results: [] }];
    const results10 = [{ query: "test", results: [] }];

    cache.set("test", "ddgs", 5, results5);
    cache.set("test", "ddgs", 10, results10);

    assert.ok(cache.get("test", "ddgs", 5));
    assert.ok(cache.get("test", "ddgs", 10));
  });

  it("should normalize query case", () => {
    const results = [{ query: "test", results: [] }];
    cache.set("TEST", "ddgs", 5, results);

    const cached = cache.get("test", "ddgs", 5);
    assert.ok(cached);
  });

  it("should evict LRU entry when full", () => {
    const cache2 = new SearchResultCache({ enabled: true, maxEntries: 3, ttlMs: 60000 });

    cache2.set("a", "ddgs", 5, [{ query: "a", results: [] }]);
    cache2.set("b", "ddgs", 5, [{ query: "b", results: [] }]);
    cache2.set("c", "ddgs", 5, [{ query: "c", results: [] }]);

    // This should evict "a"
    cache2.set("d", "ddgs", 5, [{ query: "d", results: [] }]);

    assert.equal(cache2.get("a", "ddgs", 5), null); // Evicted
    assert.ok(cache2.get("b", "ddgs", 5));
    assert.ok(cache2.get("c", "ddgs", 5));
    assert.ok(cache2.get("d", "ddgs", 5));
  });

  it("should track hits and misses", () => {
    const results = [{ query: "test", results: [] }];
    cache.set("test", "ddgs", 5, results);

    cache.get("test", "ddgs", 5); // Hit
    cache.get("test", "ddgs", 5); // Hit
    cache.get("missing", "ddgs", 5); // Miss

    const stats = cache.getStats();
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
    assert.ok(stats.hitRate > 0.5);
  });

  it("should clear cache", () => {
    // Use a fresh cache to avoid state pollution
    const freshCache = new SearchResultCache({ enabled: true, maxEntries: 10, ttlMs: 60000 });
    freshCache.set("test", "ddgs", 5, [{ query: "test", results: [] }]);
    
    // Verify it's cached
    const before = freshCache.get("test", "ddgs", 5);
    assert.ok(before);
    
    freshCache.clear();
    
    // Verify it's cleared
    const after = freshCache.get("test", "ddgs", 5);
    assert.equal(after, null);
  });

  it("should invalidate specific entry", () => {
    cache.set("test", "ddgs", 5, [{ query: "test", results: [] }]);
    assert.ok(cache.get("test", "ddgs", 5));

    cache.invalidate("test", "ddgs", 5);
    assert.equal(cache.get("test", "ddgs", 5), null);
  });

  it("should not cache when disabled", () => {
    const disabledCache = new SearchResultCache({ enabled: false });
    disabledCache.set("test", "ddgs", 5, [{ query: "test", results: [] }]);

    assert.equal(disabledCache.get("test", "ddgs", 5), null);
  });
});

describe("cache - global instance", () => {
  beforeEach(() => {
    resetSearchCache();
  });

  afterEach(() => {
    resetSearchCache();
  });

  it("should return global cache instance", () => {
    const cache1 = getSearchCache();
    const cache2 = getSearchCache();
    assert.equal(cache1, cache2);
  });

  it("should initialize with config", () => {
    initializeSearchCache({ enabled: true, maxEntries: 100 });
    const cache = getSearchCache();
    assert.equal(cache.getConfig().enabled, true);
    assert.equal(cache.getConfig().maxEntries, 100);
  });
});
