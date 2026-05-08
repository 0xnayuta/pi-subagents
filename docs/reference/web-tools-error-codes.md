---
status: current
audience: user
last_verified: 2026-05-08
---

# Web Tools 错误码

本文定义内置 web tools（`web_search` / `fetch_content` / `get_search_content`）返回的结构化错误码。

错误返回统一结构：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

> 说明：`message` 是面向调用方的可操作提示，可能随版本优化；自动化逻辑应优先使用 `code`。

## 通用错误码

| Code | 触发场景 | 常见处理建议 |
|---|---|---|
| `INVALID_INPUT` | 缺少必要参数或参数不合法 | 检查必填参数与参数类型 |
| `NOT_FOUND` | `responseId`、query/url selector 未命中 | 检查 `responseId` 是否正确，或改用可用 selector |
| `SUBAGENT_TIMEOUT` | 请求超时或被取消（包括父信号取消） | 缩小输入规模、减少 URL/query 数量、提高 `webTools.timeoutMs` |

## `fetch_content` 错误码

| Code | 触发场景 |
|---|---|
| `INVALID_INPUT` | 未提供 `url` 或 `urls` |
| `SUBAGENT_TIMEOUT` | 抓取过程超时/取消 |
| `FETCH_CONTENT_FAILED` | 其他抓取失败（协议不支持、SSRF 拒绝、HTTP 错误、内容类型不支持等） |

补充说明：

- 协议限制：仅 `http:` / `https:`
- 安全限制：阻止 `localhost`、私网地址等
- 内容限制：默认仅 `text/html` / `text/plain`

## `web_search` 错误码

| Code | 触发场景 |
|---|---|
| `INVALID_INPUT` | 缺少 `query/queries`，或 provider 非当前支持值 |
| `SUBAGENT_TIMEOUT` | 搜索请求超时/取消 |
| `WEB_SEARCH_AUTH_REQUIRED` | 缺少或无效 `BRAVE_SEARCH_API_KEY`（含 HTTP 401/403） |
| `WEB_SEARCH_RATE_LIMIT` | provider 触发限流（HTTP 429） |
| `WEB_SEARCH_PROVIDER_ERROR` | provider 5xx 临时错误 |
| `WEB_SEARCH_NETWORK_ERROR` | 网络/DNS/连接层错误 |
| `WEB_SEARCH_FAILED` | 其他未分类搜索错误 |

## `get_search_content` 错误码

| Code | 触发场景 |
|---|---|
| `INVALID_INPUT` | 缺少 `responseId` |
| `NOT_FOUND` | `responseId` 不存在，或 `query/queryIndex/url/urlIndex` 未命中 |

补充说明：

- 当 selector 未命中时，错误信息会包含可用项提示（available hints）
- 返回内容仍受 `webTools.maxContentChars` 限制
