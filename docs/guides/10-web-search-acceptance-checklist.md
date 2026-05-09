---
status: current
audience: maintainer
last_verified: 2026-05-08
---

# Web Search 验收清单（上线前）

用于验证内置 `web_search` / `fetch_content` / `get_search_content` 的可用性、稳定性与边界符合预期。

> 建议按顺序执行，所有条目通过后再发布。

---

## A. 基础功能（必过）

- [ ] **单 query 可用**
  - 执行：`web_search({ query: "TypeScript 5.7 release notes" })`
  - 期望：返回 `responseId`，且至少 1 条结果包含 `title/url`

- [ ] **多 query 规范化**
  - 执行：`web_search({ query: "typescript", queries: ["typescript", "node", "node"], numResults: 2 })`
  - 期望：重复 query 被去重；每个 query 结果数量不超过 `numResults`

- [ ] **includeContent 抓取正文**
  - 执行：`web_search({ query: "Brave Search API docs", numResults: 1, includeContent: true })`
  - 期望：结果中可见 `content`（至少部分命中）

- [ ] **responseId 回读（search）**
  - 执行：`get_search_content({ responseId: "...", queryIndex: 0 })`
  - 期望：能按 query 取回对应结果

- [ ] **responseId 回读（fetch）**
  - 执行：`fetch_content({ url: "https://example.com" })` 后 `get_search_content({ responseId: "...", urlIndex: 0 })`
  - 期望：能按 URL 取回内容

---

## B. 错误分类与提示（必过）

- [ ] **缺少 query 输入**
  - 执行：`web_search({})`
  - 期望：`error.code = INVALID_INPUT`

- [ ] **缺少 API key**
  - 前置：移除 `BRAVE_SEARCH_API_KEY`
  - 执行：`web_search({ query: "typescript" })`
  - 期望：`error.code = WEB_SEARCH_AUTH_REQUIRED`

- [ ] **限流错误分类**
  - 前置：通过 mock 或受控环境触发 provider 429
  - 期望：`error.code = WEB_SEARCH_RATE_LIMIT`

- [ ] **超时/取消错误分类**
  - 前置：将 `webTools.timeoutMs` 设为极小值
  - 执行：`web_search(...)` 或 `fetch_content(...)`
  - 期望：`error.code = SUBAGENT_TIMEOUT`，message 包含可操作建议

- [ ] **selector 未命中提示可操作**
  - 执行：`get_search_content({ responseId: "...", query: "not-exist" })`
  - 期望：`NOT_FOUND` 且提示 available selector

---

## C. 安全与边界（必过）

- [ ] **协议限制**
  - 执行：`fetch_content({ url: "file:///etc/passwd" })`
  - 期望：拒绝，`FETCH_CONTENT_FAILED`

- [ ] **私网/本地域名限制**
  - 执行：`fetch_content({ url: "http://localhost:3000" })`
  - 期望：拒绝

- [ ] **IPv6 loopback 限制**
  - 执行：`fetch_content({ url: "http://[::1]/" })`
  - 期望：拒绝

- [ ] **内容类型限制**
  - 执行：请求非文本资源
  - 期望：拒绝并返回结构化错误

---

## D. 治理与可观测（推荐）

- [ ] **存储条目上限生效**
  - 前置：`webTools.maxStoredResults` 设小值（如 2）
  - 期望：旧 `responseId` 被 FIFO 淘汰

- [ ] **单条存储上限生效**
  - 前置：`webTools.maxStoredContentChars` 设小值
  - 期望：存储内容被截断并标记 `truncated`

- [ ] **debug 日志开关生效**
  - 前置：`webTools.debug = true`
  - 期望：出现 `[web-tools]` 调试日志；关闭后不再输出

---

## E. 进程注册语义（必过）

- [ ] **parent 进程注册集合正确**
  - 期望：`web_search` / `fetch_content` / `get_search_content` + `subagent`

- [ ] **child 进程注册集合正确**
  - 期望：仅 `web_search` / `fetch_content` / `get_search_content`，不含 `subagent`

---

## F. 自动化回归（必过）

发布前至少执行：

```bash
pnpm test:unit
pnpm test:mvp
pnpm lint
pnpm typecheck
pnpm docs:check
```

要求：全部通过。

---

## 备注

- 若仅上线最小能力，可跳过 D 组的推荐项，但 A/B/C/E/F 必须全部通过。
- 若启用 `enableJinaFallback`，建议额外做一次 JS-heavy 页面抓取验证。
