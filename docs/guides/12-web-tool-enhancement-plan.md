---
status: proposed
audience: all
last_verified: 2026-05-09
---

# Web 工具增强计划

## 概述

当前 `pi-subagents` 的 web 工具（`web_search`、`fetch_content`、`get_search_content`）已具备基础功能。本计划为这些工具添加：

1. **可观测性** - 实时 activity 日志、请求统计、debug 分级
2. **开发者工具** - 诊断检查、agent 列表、执行日志
3. **测试覆盖** - 单元测试、provider mock、集成测试
4. **性能优化** - 搜索结果缓存、并发限制、连接池
5. **错误码扩展** - 结构化错误、recovery 建议

```
┌──────────────────────────────────────────────────────────────────┐
│                        增强后的能力                               │
├──────────────────────────────────────────────────────────────────┤
│  可观测性                                                          │
│  ├── 实时 activity 日志 (Ctrl+Shift+W)                            │
│  ├── 请求/响应统计                                                │
│  └── debug 日志分级 (false/minimal/verbose)                      │
│                                                                    │
│  开发者工具                                                        │
│  ├── /subagents doctor  - 配置检查                                │
│  ├── /subagents list    - agent 列表                             │
│  └── /subagents logs    - 最近执行日志                            │
│                                                                    │
│  测试覆盖                                                          │
│  ├── 单元测试 (observability, config, agent loading)              │
│  ├── Provider mock 测试                                           │
│  └── 集成测试 (spawn pi 进程)                                     │
│                                                                    │
│  性能优化                                                          │
│  ├── 搜索结果缓存 (基于 query hash)                               │
│  ├── 并发请求限制器 (semaphore)                                    │
│  └── 连接池管理 (HTTP keep-alive)                                 │
│                                                                    │
│  错误码扩展                                                        │
│  ├── WEB_SEARCH_FAILED / CONTENT_FETCH_FAILED                    │
│  ├── PROVIDER_RATE_LIMITED / INVALID_URL_FORMAT                   │
│  └── recovery 建议                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 一、可观测性增强

### 1.1 Activity 日志

参考 `pi-web-access` 的 activity widget，提供实时工具调用可视化。

#### 类型定义

```typescript
// src/web/observability.ts

export interface ActivityEntry {
  timestamp: number;
  type: "search" | "fetch" | "get_content";
  provider?: string;
  status: "pending" | "success" | "error" | "rate_limited";
  duration?: number;
  error?: string;
  requestId: string;
}

export interface WebToolStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  rateLimitedCount: number;
  averageLatencyMs: number;
  providerStats: Map<string, ProviderStats>;
}

export interface ProviderStats {
  requests: number;
  errors: number;
  rateLimited: number;
  totalLatencyMs: number;
  successRate: number;
}
```

#### UI 显示格式

```
┌─────────────────────────────────────────────────────────┐
│  Web Search Activity                         [Ctrl+Shift+W] │
├─────────────────────────────────────────────────────────┤
│  EXA   "TypeScript best practices"     200   210ms ✓  │
│  GET   docs.example.com/guide          200   85ms  ✓  │
│  TAV   "react hooks"                  429   120ms ⚠  │
│  GET   blog.example.com/post           404   30ms  ✗  │
├─────────────────────────────────────────────────────────┤
│  Requests: 127  |  Success: 118  |  Rate Limited: 5    │
│  Errors: 9  |  Avg Latency: 145ms                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Debug 日志分级

```typescript
export interface WebToolsConfig {
  // ...
  debug?: boolean | "minimal" | "verbose";
}
```

| 级别 | 输出内容 |
|------|----------|
| `false` | 仅错误 |
| `"minimal"` | 请求 + 响应状态 + timing |
| `"verbose"` | 完整请求/响应体、header、详细 timing |

---

## 二、开发者工具

### 2.1 命令设计

```text
/subagents doctor    # 检查配置、agent 加载、provider 状态
/subagents list      # 列出可用 agents（含自定义）
/subagents logs      # 查看最近执行日志（含子代理调用）
```

### 2.2 `/subagents doctor`

诊断检查项：

| 检查项 | 内容 |
|--------|------|
| config | 配置文件存在、格式正确 |
| agents | builtin/user/project agents 加载情况 |
| providers | 各 provider 可用性测试 |
| permissions | 目录权限检查 |

输出示例：

```
╔══════════════════════════════════════════════════════╗
║  Subagent Doctor - Diagnostic Report                  ║
╠══════════════════════════════════════════════════════╣
│  [PASS]  Configuration loaded from ~/.pi/agent/...    │
│  [PASS]  5 builtin agents discovered                  │
│  [WARN]  2 user agents skipped (parse error)         │
│  [PASS]  Provider ddgs responds correctly             │
│  [FAIL]  Provider tavily not configured               │
│  [PASS]  Results directory writable                  │
╠══════════════════════════════════════════════════════╣
│  Summary: 4 passed, 1 failed, 1 warnings              ║
╚══════════════════════════════════════════════════════╝
```

### 2.3 `/subagents list`

```
Available Agents (7)
────────────────────
[builtin]
  explorer      Codebase navigation and file search
  researcher    Web research and information synthesis
  reviewer      Code review and quality assessment
  implementer   Implementation planning
  tester        Test planning and strategy

[user]
  custom-review Project-specific code reviewer
  api-expert    API documentation specialist

Use: subagent({ agent: "explorer", task: "..." })
```

### 2.4 `/subagents logs`

```
Recent Activity (last 20)
─────────────────────────
14:32:15  web_search     exa        "rust async"       200  245ms ✓
14:32:08  fetch_content  ddgs       github.com/...      200  1.2s  ✓
14:31:55  web_search     tavily     "react hooks"       429  180ms ⚠
14:31:42  fetch_content  -          example.com/docs    -    -    ✗
14:31:30  subagent       explorer   "find auth module"  0    3.4s  ✓

Full logs: /tmp/pi-subagents-uid-xxx/results/
```

---

## 三、测试覆盖

### 3.1 测试策略

```
tests/
├── unit/                    # 单元测试
│   ├── observability.test.ts
│   ├── config.test.ts
│   ├── agent-loading.test.ts
│   └── errors.test.ts
├── mocks/                   # Mock 服务器和数据
│   ├── providers/
│   │   ├── ddgs.ts
│   │   ├── tavily.ts
│   │   └── searxng.ts
│   └── fixtures/
│       ├── search-results.json
│       └── html-pages/
├── integration/             # 集成测试
│   └── spawn-pi.test.ts
└── test-utils/
    ├── mock-fetch.ts
    └── mock-search.ts
```

### 3.2 单元测试覆盖

#### Observability 模块

```typescript
// tests/unit/observability.test.ts

describe("ActivityLog", () => {
  it("should record activity entries", () => {
    recordActivity({ type: "search", status: "success", duration: 100 });
    const log = getActivityLog();
    expect(log).toHaveLength(1);
  });

  it("should truncate log to max entries", () => {
    const maxEntries = 100;
    for (let i = 0; i < maxEntries + 50; i++) {
      recordActivity({ type: "search", status: "success" });
    }
    expect(getActivityLog()).toHaveLength(maxEntries);
  });

  it("should calculate stats correctly", () => {
    recordActivity({ type: "search", status: "success", duration: 100 });
    recordActivity({ type: "search", status: "error", duration: 50 });
    const stats = getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.successCount).toBe(1);
    expect(stats.errorCount).toBe(1);
  });
});
```

#### Config 模块

```typescript
// tests/unit/config.test.ts

describe("Config Loading", () => {
  it("should load config from default path", () => { ... });
  it("should merge with defaults for missing fields", () => { ... });
  it("should reject invalid values", () => { ... });
  it("should support environment variable overrides", () => { ... });
});

describe("Config Normalization", () => {
  it("should normalize provider priority", () => { ... });
  it("should filter invalid providers", () => { ... });
  it("should handle boolean string values", () => { ... });
});
```

#### Agent Loading

```typescript
// tests/unit/agent-loading.test.ts

describe("Agent Discovery", () => {
  it("should discover builtin agents from agents/ directory", () => { ... });
  it("should load user agents from ~/.pi/agent/agents/", () => { ... });
  it("should load project agents from .pi/agents/", () => { ... });
  it("should deduplicate by name (project > user > builtin)", () => { ... });
  it("should skip files without valid frontmatter", () => { ... });
});

describe("Agent Validation", () => {
  it("should require name in frontmatter", () => { ... });
  it("should parse tools from comma-separated string", () => { ... });
  it("should default readonly to true if not specified", () => { ... });
});
```

#### Error Codes

```typescript
// tests/unit/errors.test.ts

describe("Error Handling", () => {
  it("should map provider errors to correct error codes", () => { ... });
  it("should include recovery suggestions", () => { ... });
  it("should preserve original error details", () => { ... });
});
```

### 3.3 Provider Mock 测试

```typescript
// tests/mocks/providers/ddgs.ts

export function createDdgsMock() {
  return {
    search: jest.fn().mockResolvedValue({
      results: [...],
      next: "mock_cursor",
    }),
  };
}

// tests/unit/ddgs-provider.test.ts

describe("DDGS Provider", () => {
  let mock: ReturnType<typeof createDdgsMock>;

  beforeEach(() => {
    mock = createDdgsMock();
  });

  it("should parse response into normalized format", async () => {
    const result = await mock.search({ query: "test" });
    expect(result).toMatchSchema(normalizedSearchSchema);
  });

  it("should handle rate limit gracefully", async () => {
    mock.search.mockRejectedValueOnce({ status: 429 });
    // Should fallback to next provider
  });
});
```

### 3.4 集成测试

```typescript
// tests/integration/spawn-pi.test.ts

describe("Pi Spawn Integration", () => {
  it("should execute subagent and return result", async () => {
    const result = await spawnPi({
      agent: "explorer",
      task: "find files matching *.ts",
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("found");
  }, 30000);

  it("should handle timeout correctly", async () => {
    const result = await spawnPi({
      agent: "researcher",
      task: "search indefinitely",
      timeoutMs: 100,
    });

    expect(result.exitCode).toBe(124); // Timeout exit code
  });
});
```

### 3.5 测试命令

```bash
# 运行所有测试
pnpm test

# 运行单元测试
pnpm test:unit

# 运行 MVP 测试套件
pnpm test:mvp

# 运行带 coverage 的测试
pnpm test:coverage

# 运行特定 provider 测试
pnpm test:unit -- --testPathPattern="providers"
```

---

## 四、性能优化

### 4.1 搜索结果缓存

基于 query hash 的智能缓存，减少重复请求。

```typescript
// src/web/cache.ts

export interface CacheConfig {
  enabled: boolean;
  maxEntries: number;
  ttlMs: number;
  hashFn: (query: string, options?: SearchOptions) => string;
}

interface CacheEntry {
  key: string;
  results: NormalizedSearchResult[];
  timestamp: number;
  hitCount: number;
}

export class SearchResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hitStats: Map<string, number> = new Map();

  constructor(private config: CacheConfig) {}

  get(query: string, options?: SearchOptions): NormalizedSearchResult[] | null {
    const key = this.config.hashFn(query, options);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit stats
    entry.hitCount++;
    this.hitStats.set(key, (this.hitStats.get(key) || 0) + 1);

    return entry.results;
  }

  set(query: string, options: SearchOptions | undefined, results: NormalizedSearchResult[]): void {
    if (this.cache.size >= this.config.maxEntries) {
      // Evict least recently used entry
      const lruKey = this.findLRUEntry();
      this.cache.delete(lruKey);
      this.hitStats.delete(lruKey);
    }

    const key = this.config.hashFn(query, options);
    this.cache.set(key, {
      key,
      results,
      timestamp: Date.now(),
      hitCount: 1,
    });
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = Array.from(this.hitStats.values()).reduce((a, b) => a + b, 0);
    return {
      hits: total,
      misses: this.cache.size - total,
      hitRate: total / this.cache.size,
    };
  }
}
```

#### 配置

```typescript
// src/config/load-config.ts

export interface WebToolsConfig {
  cache?: {
    enabled?: boolean;
    maxEntries?: number;   // default: 50
    ttlMs?: number;        // default: 5 minutes
  };
}
```

### 4.2 并发请求限制器

使用 semaphore 模式限制并发请求数。

```typescript
// src/web/concurrency.ts

export class RequestThrottler {
  private semaphore: AsyncSemaphore;
  private queue: number = 0;
  private active: number = 0;

  constructor(
    private maxConcurrent: number = 3,
    private maxQueueSize: number = 10
  ) {
    this.semaphore = new AsyncSemaphore(maxConcurrent);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent && this.queue >= this.maxQueueSize) {
      throw new RateLimitError("Request queue full");
    }

    this.queue++;
    try {
      this.active++;
      return await this.semaphore.run(fn);
    } finally {
      this.active--;
      this.queue--;
    }
  }

  getStats() {
    return {
      active: this.active,
      queued: this.queue,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueueSize,
    };
  }
}

// 使用示例
const throttler = new RequestThrottler(3, 10);

async function fetchWithThrottle(url: string) {
  return throttler.execute(() => fetch(url));
}
```

### 4.3 连接池管理

```typescript
// src/web/http-pool.ts

export class HttpConnectionPool {
  private agent: http.Agent;
  private stats = { totalRequests: 0, failedRequests: 0 };

  constructor(maxSockets: number = 10) {
    this.agent = new http.Agent({
      keepAlive: true,
      maxSockets,
      maxFreeSockets: maxSockets / 2,
      timeout: 60000,
      scheduling: "fifo",
    });
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        ...options,
        agent: this.agent,
      });
      this.stats.totalRequests++;
      return response;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      failureRate: this.stats.failedRequests / this.stats.totalRequests,
    };
  }

  destroy() {
    this.agent.destroy();
  }
}

// 全局实例
let globalPool: HttpConnectionPool | null = null;

export function getConnectionPool(): HttpConnectionPool {
  if (!globalPool) {
    globalPool = new HttpConnectionPool(10);
  }
  return globalPool;
}
```

### 4.4 配置选项

```typescript
// src/config/load-config.ts

export interface WebToolsConfig {
  // ... existing config ...

  cache?: {
    enabled?: boolean;
    maxEntries?: number;    // default: 50
    ttlMs?: number;          // default: 300000 (5min)
  };

  concurrency?: {
    maxConcurrent?: number;  // default: 3
    maxQueueSize?: number;   // default: 10
  };

  connectionPool?: {
    maxSockets?: number;     // default: 10
  };
}
```

---

## 五、错误码扩展

### 5.1 当前错误码

```typescript
// 已有 (MVP_ERROR_CODES)
INVALID_INPUT
SUBAGENTS_DISABLED
UNKNOWN_AGENT
SUBAGENT_DISABLED
SUBAGENT_DEPTH_EXCEEDED
SUBAGENT_TIMEOUT
SUBAGENT_FAILED
SUBAGENT_OUTPUT_TRUNCATED
```

### 5.2 新增 Web 工具错误码

```typescript
// src/web/errors.ts

export const WEB_ERROR_CODES = {
  // Search 错误
  WEB_SEARCH_FAILED: "WEB_SEARCH_FAILED",
  WEB_SEARCH_TIMEOUT: "WEB_SEARCH_TIMEOUT",
  WEB_SEARCH_NO_RESULTS: "WEB_SEARCH_NO_RESULTS",
  WEB_SEARCH_INVALID_QUERY: "WEB_SEARCH_INVALID_QUERY",

  // Fetch 错误
  CONTENT_FETCH_FAILED: "CONTENT_FETCH_FAILED",
  CONTENT_FETCH_TIMEOUT: "CONTENT_FETCH_TIMEOUT",
  CONTENT_FETCH_INVALID_URL: "CONTENT_FETCH_INVALID_URL",
  CONTENT_FETCH_TOO_LARGE: "CONTENT_FETCH_TOO_LARGE",

  // Provider 错误
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_AUTH_FAILED: "PROVIDER_AUTH_FAILED",

  // 通用错误
  NETWORK_ERROR: "NETWORK_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  CACHE_ERROR: "CACHE_ERROR",
} as const;

export type WebErrorCode = typeof WEB_ERROR_CODES[keyof typeof WEB_ERROR_CODES];
```

### 5.3 错误结构与 Recovery

```typescript
// src/web/errors.ts

export interface WebError {
  code: WebErrorCode;
  message: string;
  provider?: string;
  originalError?: Error;
  recovery?: RecoverySuggestion;
  retryable: boolean;
}

export interface RecoverySuggestion {
  action: "retry" | "fallback" | "skip" | "abort";
  nextProvider?: string;
  waitMs?: number;
  description: string;
}

export const ERROR_RECOVERY_MAP: Record<WebErrorCode, RecoverySuggestion> = {
  WEB_SEARCH_FAILED: {
    action: "fallback",
    nextProvider: "auto",
    description: "Fallback to next available provider",
  },
  PROVIDER_RATE_LIMITED: {
    action: "retry",
    waitMs: 5000,
    description: "Rate limit hit, waiting before retry",
  },
  PROVIDER_AUTH_FAILED: {
    action: "abort",
    description: "Check API key configuration",
  },
  CONTENT_FETCH_TIMEOUT: {
    action: "fallback",
    nextProvider: "jina",
    description: "Fetch timed out, try Jina Reader fallback",
  },
  NETWORK_ERROR: {
    action: "retry",
    waitMs: 1000,
    description: "Network error, retry with backoff",
  },
  // ... more mappings
};
```

### 5.4 错误处理示例

```typescript
// src/web/search.ts

async function executeSearch(query: string, config: ResolvedWebToolsConfig) {
  for (const providerName of config.providerPriority) {
    const provider = getProvider(providerName);

    try {
      return await provider.search(query);
    } catch (error) {
      const webError = mapErrorToWebError(error, providerName);

      // 记录到 activity
      recordActivity({
        type: "search",
        provider: providerName,
        status: "error",
        error: webError.message,
      });

      const recovery = ERROR_RECOVERY_MAP[webError.code];

      if (recovery.action === "abort") {
        throw webError;
      }

      if (recovery.action === "retry" && recovery.waitMs) {
        await sleep(recovery.waitMs);
        continue;
      }

      // Fallback to next provider
      continue;
    }
  }

  throw {
    code: WEB_ERROR_CODES.WEB_SEARCH_FAILED,
    message: "All providers failed",
    retryable: false,
    recovery: { action: "abort", description: "No providers available" },
  };
}
```

### 5.5 错误日志格式

```typescript
// 结构化错误日志，便于诊断
interface ErrorLogEntry {
  timestamp: number;
  requestId: string;
  operation: "search" | "fetch";
  provider: string;
  error: WebError;
  context: {
    query?: string;
    url?: string;
    attempt: number;
    durationMs: number;
  };
}
```

---

## 六、实施计划

### Phase 1: 可观测性核心 (1-2 天)

```
src/web/
├── observability.ts       # 新增：Activity 日志、统计追踪
├── providers/
│   └── ddgs.ts            # 集成 activity 记录
└── index.ts              # 导出 observability API
```

实现步骤：
- [ ] 创建 `src/web/observability.ts`
- [ ] 定义 `ActivityEntry`、`WebToolStats` 类型
- [ ] 实现 `recordActivity()`、`getStats()`、`resetStats()`
- [ ] 在 `fetch.ts`、`search.ts` 中集成 activity 记录
- [ ] 添加 debug 配置选项和分级日志

### Phase 2: 开发者工具 (1 天)

```
src/extension/
├── commands/
│   ├── doctor.ts          # 新增：诊断检查
│   ├── list.ts            # 新增：agent 列表
│   └── logs.ts            # 新增：执行日志
└── index.ts              # 注册命令
```

实现步骤：
- [ ] 创建 `src/extension/commands/` 目录
- [ ] 实现 `doctor.ts`：配置检查、agent 验证、provider 测试
- [ ] 实现 `list.ts`：格式化 agent 列表输出
- [ ] 实现 `logs.ts`：读取并展示 activity 日志
- [ ] 在 `index.ts` 中注册命令

### Phase 3: 测试框架 (1.5 天)

```
tests/
├── unit/
│   ├── observability.test.ts
│   ├── config.test.ts
│   ├── agent-loading.test.ts
│   └── errors.test.ts
├── mocks/
│   └── providers/
│       └── ddgs.ts
└── integration/
    └── spawn-pi.test.ts
```

实现步骤：
- [ ] 设置 Vitest 测试框架
- [ ] 创建 mock utilities
- [ ] 实现 observability 单元测试
- [ ] 实现 config 单元测试
- [ ] 实现 agent loading 单元测试
- [ ] 实现 provider mock 测试
- [ ] 实现集成测试
- [ ] 添加 npm scripts

### Phase 4: 性能优化 (1-2 天)

```
src/web/
├── cache.ts              # 新增：搜索结果缓存
├── concurrency.ts        # 新增：并发限制器
└── http-pool.ts          # 新增：连接池管理
```

实现步骤：
- [ ] 实现 `SearchResultCache` 类
- [ ] 实现 `RequestThrottler` 类
- [ ] 实现 `HttpConnectionPool` 类
- [ ] 在 provider 中集成缓存
- [ ] 在 fetch 中集成 throttler
- [ ] 添加配置选项

### Phase 5: 错误码扩展 (0.5 天)

```
src/web/
├── errors.ts             # 新增：错误码定义
└── errors.ts             # 修改：更新 search.ts、fetch.ts
```

实现步骤：
- [ ] 定义 `WEB_ERROR_CODES` 常量
- [ ] 定义 `WebError` 和 `RecoverySuggestion` 接口
- [ ] 实现 `ERROR_RECOVERY_MAP`
- [ ] 实现 `mapErrorToWebError()` 函数
- [ ] 更新 `search.ts` 使用新的错误处理
- [ ] 更新 `fetch.ts` 使用新的错误处理

### Phase 6: UI 集成与收尾 (0.5 天)

- [ ] 添加键盘快捷键支持（`Ctrl+Shift+W`）
- [ ] 实现简单的 TUI 显示层
- [ ] 添加 session 生命周期清理
- [ ] 更新 `docs/guides/09-web-tools-runtime-governance-and-observability.md`

---

## 七、文件变更摘要

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/web/observability.ts` | 新增 | Activity 日志与统计追踪 |
| `src/web/cache.ts` | 新增 | 搜索结果缓存 |
| `src/web/concurrency.ts` | 新增 | 并发请求限制器 |
| `src/web/http-pool.ts` | 新增 | HTTP 连接池 |
| `src/web/errors.ts` | 新增 | 错误码定义与 recovery |
| `src/web/fetch.ts` | 修改 | 集成 activity、throttler、error 处理 |
| `src/web/search.ts` | 修改 | 集成 activity、cache、error 处理 |
| `src/extension/commands/doctor.ts` | 新增 | 诊断检查命令 |
| `src/extension/commands/list.ts` | 新增 | agent 列表命令 |
| `src/extension/commands/logs.ts` | 新增 | 执行日志命令 |
| `src/extension/index.ts` | 修改 | 注册快捷键和命令 |
| `src/shared/types.ts` | 修改 | 添加相关类型 |
| `src/config/load-config.ts` | 修改 | 添加缓存、并发、连接池配置 |
| `tests/unit/*.test.ts` | 新增 | 各类单元测试 |
| `tests/mocks/providers/*.ts` | 新增 | Provider mocks |
| `tests/integration/*.test.ts` | 新增 | 集成测试 |

---

## 八、向后兼容性

- 所有新增功能默认启用，可通过配置关闭
- 现有工具行为不变
- 新错误码仅在使用新功能时触发
- 不会引入新的外部依赖（使用原生 `node:http` 和已有测试框架）

---

## 九、验收标准

| 功能 | 验收条件 |
|------|----------|
| Activity 日志 | Ctrl+Shift+W 显示最近 20 条调用记录 |
| 统计信息 | 显示 success/error/rate_limited 数量、平均延迟 |
| debug 分级 | `debug: "verbose"` 时输出完整请求详情 |
| `/subagents doctor` | 输出配置、agent、provider 诊断结果 |
| `/subagents list` | 列出所有 builtin/user/project agents |
| `/subagents logs` | 显示最近工具调用历史 |
| 单元测试覆盖 | observability、config、agent-loading、errors > 80% |
| Provider mock | ddgs、tavily、searxng 可 mock |
| 集成测试 | spawn-pi 可执行并返回结果 |
| 缓存 | 相同 query 不触发重复请求 |
| 并发限制 | 同时不超过 3 个请求 |
| 连接池 | keep-alive 复用连接 |
| 错误码 | 包含 WEB_SEARCH_FAILED、CONTENT_FETCH_FAILED 等 12 个 |
| Recovery | 每个错误码有对应的 recovery 建议 |