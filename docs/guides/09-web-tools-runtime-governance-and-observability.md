---
status: current
audience: maintainer
last_verified: 2026-05-08
---

# Web Tools 运行时治理与可观测性

本文说明内置 web tools（`web_search` / `fetch_content` / `get_search_content`）在 P2 引入的运行时治理策略与轻量可观测机制。

目标：

- 控制内存占用与单条结果大小
- 强化 SSRF 防护细节
- 提供最小调试能力（默认关闭）

---

## 1. 内存与存储治理

相关代码：`src/web/storage.ts`

### 1.1 条目上限（FIFO 淘汰）

配置：`webTools.maxStoredResults`（默认 `100`）

- 每次 `storeResult` 后会检查缓存条目数
- 超限时按插入顺序淘汰最旧条目（FIFO）
- 会话恢复（`restoreResultsFromSession`）同样应用该限制

效果：

- 防止长会话无限增长导致内存膨胀

### 1.2 单条内容上限（存储阶段截断）

配置：`webTools.maxStoredContentChars`（默认 `200000`）

- 写入缓存前会对 `content` 做存储级截断
- 截断后 `truncated` 标记会被保留为 `true`
- 对 fetch/search（含 search result 内嵌 content）都生效

效果：

- 防止极端页面内容导致单条记录过大

### 1.3 与返回级截断的关系

- 存储级：`maxStoredContentChars`
- 响应级：`maxContentChars`

即使存储级未触发，`get_search_content` 与 tool 直接返回仍会受 `maxContentChars` 限制。

---

## 2. SSRF 防护加强

相关代码：`src/web/security.ts`

### 2.1 主机名拦截

额外拒绝：

- `localhost` / `*.localhost`
- `*.local`
- `*.internal`

### 2.2 IPv6 细节

- 支持 bracket host 规范化（如 `[::1]`）后再进行 IP 判定
- 拒绝 loopback/link-local/ULA
- 处理 IPv4-mapped IPv6（`::ffff:x.x.x.x`）并复用 IPv4 私网判定

### 2.3 重定向链复验

- 每一次 30x 跳转都重新执行 URL 安全校验
- 避免通过中间跳转绕过限制

---

## 3. 轻量可观测性（会话内）

相关代码：`src/web/observability.ts`

### 3.1 开关

配置：`webTools.debug`（默认 `false`）

- `false`：不输出调试日志
- `true`：输出最小 debug 日志（`[web-tools] ...`）

### 3.2 统计维度

当前在内存中维护：

- `search`：calls/success/failure
- `fetch`：calls/success/failure
- `providers`：按 provider 统计 calls/success/failure/latencyMsTotal
- `errorCodes`：按错误码计数

### 3.3 生命周期

- `session_start`：重置统计
- `session_shutdown`：重置统计

> 统计为会话内临时状态，不落盘。

---

## 4. 配置示例

```json
{
  "webTools": {
    "enabled": true,
    "provider": "brave",
    "timeoutMs": 10000,
    "maxResponseBytes": 1048576,
    "maxContentChars": 30000,
    "maxResults": 5,
    "enableJinaFallback": false,
    "jinaTimeoutMs": 8000,
    "maxStoredResults": 100,
    "maxStoredContentChars": 200000,
    "debug": false
  }
}
```

---

## 5. 维护建议

1. 优先调整 `maxStoredResults` 与 `maxStoredContentChars`，再考虑改代码
2. 出现抓取异常时先短期开启 `debug`，问题定位后关闭
3. 新增 provider 前，先复用当前 observability 计数维度
4. 不要把调试日志变为默认输出，保持主路径简洁
