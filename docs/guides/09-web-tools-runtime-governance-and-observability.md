---
status: current
audience: maintainer
last_verified: 2026-05-08
---

# Web Tools 运行时治理与可观测性

本文说明内置 web tools 在 P2 后的运行时治理策略与最小可观测能力。

适用范围：

- `web_search`
- `fetch_content`
- `get_search_content`

---

## 1. 存储治理（Storage Governance）

### 1.1 条目数量上限

配置项：`webTools.maxStoredResults`（默认 `100`）

行为：

- 每次 `storeResult` 写入后执行容量检查
- 超出上限时按 FIFO 淘汰最早条目
- 会话恢复（`restoreResultsFromSession`）时同样应用上限

影响：

- 限制长会话内存增长
- 极长会话下旧 `responseId` 可能被淘汰

### 1.2 单条内容大小上限

配置项：`webTools.maxStoredContentChars`（默认 `200000`）

行为：

- 在存储阶段裁剪过长 `content`
- 被裁剪条目会标记 `truncated: true`
- fetch/search 内嵌 content 都适用

影响：

- 降低单条异常页面占用过大内存风险
- `get_search_content` 读取到的是治理后内容

### 1.3 与输出截断的关系

- 存储治理：控制“存多少”（`maxStoredContentChars`）
- 输出治理：控制“返回多少”（`maxContentChars`）

二者独立生效：

1. 先存储治理（可能截断并标记）
2. 再响应输出治理（按 tool 输出上限再次截断）

---

## 2. SSRF 与地址安全增强

P2 增强点：

- 支持 bracket IPv6 host 的规范化检查（如 `[::1]`）
- 拒绝 `localhost`/`.localhost`、`.local`、`.internal`
- 重定向链每一跳都重新执行 URL 安全校验

仍保持：

- 仅允许 `http:` / `https:`
- 拒绝私网、loopback、link-local 地址

---

## 3. 可观测性（Minimal Observability）

### 3.1 调试日志开关

配置项：`webTools.debug`（默认 `false`）

行为：

- `false`：不输出 web tools 调试日志
- `true`：输出前缀为 `[web-tools]` 的轻量日志

日志目标：

- 方便维护者排障
- 默认不污染用户常规输出

### 3.2 会话内统计项

当前统计维度（会话内内存统计）：

- search/fetch：调用次数、成功数、失败数
- provider（当前主要是 brave）：调用次数、成功数、失败数、累计延迟
- error code：各错误码计数

说明：

- 统计在 `session_start` / `session_shutdown` 会重置
- 统计不做跨会话持久化

---

## 4. Abort/Timeout 一致性模型

统一策略：

- 使用 `AbortSignal.timeout(...)` 生成超时信号
- 使用 `AbortSignal.any([...])` 合并父 signal 与超时 signal

收益：

- `web_search` 与 `fetch_content` 的取消/超时语义一致
- 错误分类更稳定（统一映射为 `SUBAGENT_TIMEOUT`）

---

## 5. 推荐配置模板

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

## 6. 运维建议

- 若出现 `responseId` 频繁失效：
  - 提高 `maxStoredResults`
- 若内存压力偏高：
  - 降低 `maxStoredResults` 与 `maxStoredContentChars`
- 若排障需要：
  - 临时启用 `webTools.debug: true`，问题定位后关闭
- 若超时较多：
  - 先减小查询规模，再视情况上调 `timeoutMs`
