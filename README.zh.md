# pi-subagents

[English](./README.md) | 中文

一个轻量级的 pi 扩展，用于将任务委派给专门的子代理。

## 安装

```bash
pi install npm:pi-subagents
```

## 快速开始

安装后，直接用自然语言请求子代理：

```
用 explorer 帮我找一下认证相关的代码在哪里
```

```
用 reviewer 审查一下这个 diff
```

```
用 researcher 调研一下 REST vs GraphQL 的优缺点
```

## 使用方式

主代理通过 `subagent` 工具调用子代理：

```ts
subagent({ agent: "explorer", task: "Find authentication related code" })
```

参数：

- `agent`: 子代理名称
- `task`: 任务描述

## 内置子代理

| Agent | 用途 | 工具 |
|-------|------|------|
| `explorer` | 代码导航、文件搜索、架构分析 | read, grep, find, ls |
| `researcher` | 文档/API 调研、网络搜索 | web_search, fetch_content, get_search_content |
| `reviewer` | 代码审查、diff 检查 | read, grep, find, ls |
| `implementer` | 实现规划、patch 计划 | read, grep, find, ls |
| `tester` | 测试策略、测试用例设计 | read, grep, find, ls |

所有内置代理默认 **只读** (`readonly: true`)，不会执行写操作。

## 自定义子代理

在 `~/.pi/agent/agents/` 或项目 `.pi/agents/` 目录下创建 markdown 文件：

```markdown
---
name: custom-reviewer
description: Project-specific reviewer
readonly: true
tools: read, grep, find, ls
---

You are a custom review subagent for this project.
```

## 开发者命令

使用 `/subagents` 前缀访问内置的诊断和监控命令：

### `/subagents doctor`

运行配置、代理和 providers 的诊断检查：

```bash
/subagents doctor
```

检查项：
- 配置验证
- Agent 发现（内置/用户/项目）
- Web 工具 provider 可用性

### `/subagents list`

列出所有可用的子代理：

```bash
/subagents list
```

显示来自：内置（`agents/`）、用户（`~/.pi/agent/agents/`）、项目（`.pi/agents/`）目录的 agents。

### `/subagents logs`

显示最近的 web 工具活动日志：

```bash
/subagents logs                    # 显示最近 20 条
/subagents logs --search          # 按搜索筛选
/subagents logs --fetch           # 按获取筛选
/subagents logs --limit 50        # 自定义条数
```

### `/subagents activity`

交互式 TUI 面板，用于实时活动监控：

```bash
/subagents activity
```

功能：
- 实时统计显示（总数、成功、错误、限流、平均延迟）
- 键盘导航（↑↓、PageUp/PageDown、Home/End）
- 快捷操作：`r` 刷新、`c` 清除日志、`s` 重置统计
- 按 `Esc` 或 `Ctrl+C` 关闭

## 内置 Web Tools

本扩展内置极简 readonly web tools，供主代理和 `researcher` 子代理使用：

```ts
web_search({ query: "TypeScript 5.7 release notes" })
fetch_content({ url: "https://example.com/docs" })
get_search_content({ responseId: "...", urlIndex: 0 })
```

### Provider 策略

**零配置开箱即用**：默认使用 DDGS，无需任何 API key。

**auto 模式分层选择**（`provider: "auto"`）：

```
商业 keyed（质量优先）  →  tavily → serper → brave
OpenSERP / SearXNG     →  openserp → searxng
DDGS 兜底（可用性优先） →  ddgs
```

auto 模式按此顺序尝试 provider，失败后自动降级，直到找到可用的。

**显式指定 provider**（`provider: "ddgs"`）：只走指定 provider，不降级。

### Provider 对比

| Provider | 类型 | Key 要求 | 说明 |
|----------|------|----------|------|
| `ddgs` | 零配置 | ❌ | HTML 解析，结果标记为 `source: "fallback"`，最多返回 5 条 |
| `openserp` | Open/API | ✅ OPENSERP_API_KEY | 需要 `enabled: true` |
| `searxng` | 自托管 | ❌ | 需要配置 `baseUrl` endpoint |
| `tavily` | 商业 | ✅ TAVILY_API_KEY | auto 模式有 key 即纳入 |
| `serper` | 商业 | ✅ SERPER_API_KEY | auto 模式有 key 即纳入 |
| `brave` | 商业 | ✅ BRAVE_SEARCH_API_KEY | auto 模式有 key 即纳入 |

### 性能优化

**搜索结果缓存**：使用可配置 TTL 缓存搜索结果，减少重复 API 调用。

**并发限制器**：基于信号量的限流，防止 provider 过载（默认：3 个并发请求，10 个排队）。

**连接池**：HTTP keep-alive 连接池，高效利用网络资源。

### 错误码

扩展提供了带恢复建议的结构化错误码：

#### Web 工具错误

| Code | 说明 | 恢复建议 |
|------|------|----------|
| `WEB_SEARCH_FAILED` | 所有 provider 都失败了 | 尝试下一个 provider 或重试 |
| `WEB_SEARCH_TIMEOUT` | 搜索请求超时 | 退避后重试 |
| `WEB_SEARCH_NO_RESULTS` | 未返回结果 | 检查查询词或 provider |
| `WEB_SEARCH_INVALID_QUERY` | 无效的查询格式 | 修复查询后重试 |
| `PROVIDER_RATE_LIMITED` | Provider 限流 | 等待后重试（5s 退避） |
| `PROVIDER_UNAVAILABLE` | Provider 服务错误 | 尝试下一个 provider |
| `PROVIDER_AUTH_FAILED` | API key 无效/缺失 | 检查 API key 配置 |
| `CONTENT_FETCH_FAILED` | 内容获取失败 | 重试或跳过 |
| `CONTENT_FETCH_TIMEOUT` | 获取超时 | 尝试 Jina reader 兜底 |
| `CONTENT_FETCH_TOO_LARGE` | 响应过大 | 缩小范围 |
| `NETWORK_ERROR` | 网络连接错误 | 检查网络后重试 |

#### 子代理错误

| Code | 说明 |
|------|------|
| `INVALID_INPUT` | 缺少必需参数或不支持的配置值 |
| `SUBAGENTS_DISABLED` | 子代理功能已禁用 |
| `UNKNOWN_AGENT` | 未知代理名称 |
| `SUBAGENT_DISABLED` | 该代理已禁用 |
| `SUBAGENT_DEPTH_EXCEEDED` | 递归深度超限（maxSubagentDepth = 1） |
| `SUBAGENT_TIMEOUT` | 执行超时 |
| `SUBAGENT_FAILED` | 子代理执行失败 |
| `SUBAGENT_OUTPUT_TRUNCATED` | 输出被截断 |

### 边界

- `fetch_content` 仅支持 `http:` / `https:` 的 `text/html` 和 `text/plain`
- 内置 web tools 不等同于完整 `pi-web-access`
- 不支持 YouTube、PDF 专门处理、GitHub clone、登录态/browser cookie、curator UI
- 结果只保存在内存中，可通过 `responseId` 和 `get_search_content` 取回

## 配置

在 `~/.pi/agent/extensions/subagent/config.json` 中配置：

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false,
  "webTools": {
    "enabled": true,
    "provider": "ddgs",
    "providerPriority": ["tavily", "serper", "brave", "openserp", "searxng", "ddgs"],
    "timeoutMs": 10000,
    "maxResponseBytes": 1048576,
    "maxContentChars": 30000,
    "maxResults": 5,
    "debug": "false",
    "cache": {
      "enabled": false,
      "maxEntries": 50,
      "ttlMs": 300000
    },
    "concurrency": {
      "maxConcurrent": 3,
      "maxQueueSize": 10
    },
    "connectionPool": {
      "maxSockets": 10,
      "maxFreeSockets": 5,
      "timeout": 60000
    },
    "searxng": {
      "enabled": false,
      "baseUrl": ""
    },
    "openserp": {
      "enabled": false,
      "baseUrl": "https://api.openserp.com/search",
      "apiKeyEnv": "OPENSERP_API_KEY"
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

### 配置说明

**Provider 设置：**
- `provider`: `"ddgs"` | `"auto"` | `"brave"` | `"tavily"` | `"serper"` | `"openserp"` | `"searxng"`
- `providerPriority`: auto 模式时，控制同 tier 内的候选顺序
- `searxng.baseUrl`: 使用 SearXNG 时应显式配置 endpoint

**性能设置：**
- `cache.enabled`: 启用搜索结果缓存（默认：`false`）
- `cache.maxEntries`: 最大缓存条目数（默认：`50`）
- `cache.ttlMs`: 缓存 TTL，毫秒（默认：`300000` = 5 分钟）
- `concurrency.maxConcurrent`: 最大并发请求数（默认：`3`）
- `concurrency.maxQueueSize`: 最大排队请求数（默认：`10`）
- `connectionPool.maxSockets`: 每主机最大 socket 数（默认：`10`）

**调试设置：**
- `debug`: 调试级别 - `"false"`（默认，无输出）、`"minimal"`（仅错误）、`"verbose"`（所有请求）

## 限制

MVP 版本 **不支持** 以下功能：

- ❌ background/async jobs
- ❌ chain workflow
- ❌ parallel execution
- ❌ intercom/contact_supervisor
- ❌ worktree 管理
- ❌ slash commands
- ❌ skills 注入
- ❌ bash 工具在只读代理中

## 递归保护

子代理不能再调用子代理（`maxSubagentDepth = 1`）。子进程不会注册 `subagent` 工具。

## 测试

```bash
pnpm test           # 运行所有测试
pnpm test:unit      # 仅运行单元测试
```

当前测试覆盖：163 个测试，涵盖可观测性、错误处理、缓存、并发、命令和 web 工具。
