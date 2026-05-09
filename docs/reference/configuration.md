---
status: current
audience: user
last_verified: 2026-05-08
---

# 配置参考

## 配置文件位置

`~/.pi/agent/extensions/subagent/config.json`

## 配置字段

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false,
  "webTools": {
    "enabled": true,
    "provider": "brave",
    "providerPriority": ["brave", "tavily", "serper", "openserp", "searxng", "ddgs"],
    "timeoutMs": 10000,
    "maxResponseBytes": 1048576,
    "maxContentChars": 30000,
    "maxResults": 5,
    "enableJinaFallback": false,
    "jinaTimeoutMs": 8000,
    "maxStoredResults": 100,
    "maxStoredContentChars": 200000,
    "debug": false,
    "openserp": {
      "enabled": false,
      "baseUrl": "https://api.openserp.com/search",
      "apiKeyEnv": "OPENSERP_API_KEY"
    },
    "searxng": {
      "enabled": false,
      "baseUrl": "http://127.0.0.1:8080",
      "defaultEngine": "google"
    },
    "tavily": {
      "enabled": false,
      "baseUrl": "https://api.tavily.com/search",
      "apiKeyEnv": "TAVILY_API_KEY"
    },
    "serper": {
      "enabled": false,
      "baseUrl": "https://google.serper.dev/search",
      "apiKeyEnv": "SERPER_API_KEY"
    }
  }
}
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 是否启用 subagent 工具 |
| `maxSubagentDepth` | number | `1` | 子代理递归深度。固定为 1，子代理不能再调子代理 |
| `timeoutMs` | number | `120000` | 子代理执行超时（毫秒） |
| `allowWriteSubagents` | boolean | `false` | 是否允许子代理写文件。MVP 默认 false |
| `webTools.enabled` | boolean | `true` | 是否注册 `web_search` / `fetch_content` / `get_search_content` |
| `webTools.provider` | string | `"brave"` | 搜索 provider，支持 `brave` / `ddgs` / `openserp` / `searxng` / `tavily` / `serper` / `auto` |
| `webTools.providerPriority` | string[] | `["brave", "tavily", "serper", "openserp", "searxng", "ddgs"]` | `provider="auto"` 时的 provider 选择顺序 |
| `webTools.timeoutMs` | number | `10000` | 单次网络请求超时 |
| `webTools.maxResponseBytes` | number | `1048576` | 最大读取响应体大小 |
| `webTools.maxContentChars` | number | `30000` | 最大返回文本长度 |
| `webTools.maxResults` | number | `5` | 默认搜索结果数量 |
| `webTools.enableJinaFallback` | boolean | `false` | 是否在 HTML 提取质量较低时尝试 Jina Reader fallback |
| `webTools.jinaTimeoutMs` | number | `8000` | Jina Reader fallback 请求超时 |
| `webTools.maxStoredResults` | number | `100` | 内存缓存最多保留多少个 `responseId` 条目（超出按 FIFO 淘汰） |
| `webTools.maxStoredContentChars` | number | `200000` | 单条存储内容的最大字符数（超出会在存储阶段截断并标记 truncated） |
| `webTools.debug` | boolean | `false` | 是否输出 web tools 轻量调试日志（默认关闭） |
| `webTools.openserp.enabled` | boolean | `false` | 是否启用 OpenSERP provider（auto 模式可用性检查会参考该值） |
| `webTools.openserp.baseUrl` | string | `"https://api.openserp.com/search"` | OpenSERP 兼容搜索 API endpoint |
| `webTools.openserp.apiKeyEnv` | string | `"OPENSERP_API_KEY"` | OpenSERP API key 环境变量名 |
| `webTools.searxng.enabled` | boolean | `false` | 是否启用 SearXNG provider（通常用于自托管实例） |
| `webTools.searxng.baseUrl` | string | `"http://127.0.0.1:8080"` | SearXNG 实例地址 |
| `webTools.searxng.defaultEngine` | string | `"google"` | SearXNG 默认 engine 参数 |
| `webTools.tavily.enabled` | boolean | `false` | 是否启用 Tavily provider |
| `webTools.tavily.baseUrl` | string | `"https://api.tavily.com/search"` | Tavily Search API endpoint |
| `webTools.tavily.apiKeyEnv` | string | `"TAVILY_API_KEY"` | Tavily API key 环境变量名 |
| `webTools.serper.enabled` | boolean | `false` | 是否启用 Serper provider |
| `webTools.serper.baseUrl` | string | `"https://google.serper.dev/search"` | Serper Google Search API endpoint |
| `webTools.serper.apiKeyEnv` | string | `"SERPER_API_KEY"` | Serper API key 环境变量名 |

## MVP 不支持的配置

以下配置字段在 MVP 中会被忽略：

- `asyncByDefault` - background jobs 不支持
- `parallel` - parallel execution 不支持
- `intercomBridge` - intercom 不支持
- `worktreeSetupHook` - worktree 不支持
- `agentOverrides` - per-agent model/skill override 不支持
- `defaultSessionDir` - 复杂 session 管理不支持

## readonly agents 允许的工具

默认 readonly agents 只能使用安全工具：

```text
read, grep, find, ls
```

researcher 可使用网络研究工具：

```text
web_search, fetch_content, get_search_content
```

不允许使用 `bash`、`edit`、`write` 等可能修改文件系统的工具。
