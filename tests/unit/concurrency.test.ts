/**
 * Concurrency Module Tests
 * Phase 4: Performance Optimization - Throttler tests
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  RequestThrottler,
  QueueFullError,
  initializeRequestThrottler,
  getRequestThrottler,
  resetRequestThrottler,
} from "../../src/web/concurrency.ts";

describe("concurrency - RequestThrottler", () => {
  it("should have default configuration", () => {
    const defaultThrottler = new RequestThrottler();
    const config = defaultThrottler.getConfig();

    assert.equal(config.maxConcurrent, 3);
    assert.equal(config.maxQueueSize, 10);
  });

  it("should execute immediately when below limit", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, maxQueueSize: 10 });
    let executed = false;
    await throttler.execute(async () => {
      executed = true;
    });

    assert.equal(executed, true);
    throttler.reset();
  });

  it("should track active count", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 1, maxQueueSize: 5 });

    let resolver: () => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    const p1 = throttler.execute(async () => {
      await promise;
    });

    assert.equal(throttler.getStats().active, 1);

    resolver!();
    await p1;
    assert.equal(throttler.getStats().active, 0);
    throttler.reset();
  });

  it("should execute multiple in parallel up to limit", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, maxQueueSize: 10 });

    const results = await Promise.all([
      throttler.execute(async () => "a"),
      throttler.execute(async () => "b"),
      throttler.execute(async () => "c"),
    ]);

    assert.deepEqual(results, ["a", "b", "c"]);
    throttler.reset();
  });

  it("should reject when queue is full", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 1, maxQueueSize: 2 });

    // Fill active (1) - use sync mock
    let resolveActive: () => void;
    const activePromise = new Promise<void>((r) => {
      resolveActive = r;
    });
    throttler.execute(async () => {
      await activePromise;
    });

    // Fill queue (2)
    throttler.execute(async () => {});
    throttler.execute(async () => {});

    // Next should throw
    await assert.rejects(
      throttler.execute(async () => {}),
      (err: Error) => err instanceof QueueFullError
    );

    // Clean up
    resolveActive!();
    await throttler.waitForIdle();
    throttler.reset();
  });

  it("should track total processed", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, maxQueueSize: 10 });

    await throttler.execute(async () => {});
    await throttler.execute(async () => {});
    await throttler.execute(async () => {});

    assert.equal(throttler.getStats().totalProcessed, 3);
    throttler.reset();
  });

  it("should reset stats", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, maxQueueSize: 10 });

    await throttler.execute(async () => {});
    throttler.reset();

    const stats = throttler.getStats();
    assert.equal(stats.totalProcessed, 0);
    assert.equal(stats.active, 0);
  });

  it("should update config", () => {
    const throttler = new RequestThrottler();
    throttler.updateConfig({ maxConcurrent: 5, maxQueueSize: 20 });

    const config = throttler.getConfig();
    assert.equal(config.maxConcurrent, 5);
    assert.equal(config.maxQueueSize, 20);
  });

  it("should wait for idle", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 1, maxQueueSize: 5 });

    let resolver: () => void;
    const promise = new Promise<void>((r) => {
      resolver = r;
    });

    throttler.execute(async () => {
      await promise;
    });

    // Should not be idle yet
    assert.equal(throttler.getStats().active, 1);

    resolver!();

    // Wait for idle
    await throttler.waitForIdle();

    assert.equal(throttler.getStats().active, 0);
    throttler.reset();
  });
});

describe("concurrency - global instance", () => {
  afterEach(() => {
    resetRequestThrottler();
  });

  it("should return global instance", () => {
    const t1 = getRequestThrottler();
    const t2 = getRequestThrottler();
    assert.equal(t1, t2);
  });

  it("should initialize with config", () => {
    initializeRequestThrottler({ maxConcurrent: 5 });
    const t = getRequestThrottler();
    assert.equal(t.getConfig().maxConcurrent, 5);
  });
});
