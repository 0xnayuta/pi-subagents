# pi-subagents

A lightweight pi extension for delegating tasks to focused child agents.

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

## 内置 Web Tools

本扩展内置极简 readonly web tools，供主代理和 `researcher` 子代理使用：

```ts
web_search({ query: "TypeScript 5.7 release notes" })
fetch_content({ url: "https://example.com/docs" })
get_search_content({ responseId: "...", urlIndex: 0 })
```

边界：

- `web_search` 第一版使用 Brave Search API，需要 `BRAVE_SEARCH_API_KEY`
- `fetch_content` 仅支持 `http:` / `https:` 的 `text/html` 和 `text/plain`
- 内置 web tools 不等同于完整 `pi-web-access`
- 不支持 YouTube、PDF 专门处理、GitHub clone、登录态/browser cookie、curator UI
- 结果只保存在内存中，可通过 `responseId` 和 `get_search_content` 取回

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

## 限制

MVP 版本 **不支持** 以下功能：

- ❌ background/async jobs
- ❌ chain workflow
- ❌ parallel execution
- ❌ intercom/contact_supervisor
- ❌ worktree 管理
- ❌ TUI widget
- ❌ slash commands
- ❌ skills 注入
- ❌ bash 工具在只读代理中

## 递归保护

子代理不能再调用子代理（`maxSubagentDepth = 1`）。子进程不会注册 `subagent` 工具。

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
    "provider": "brave",
    "timeoutMs": 10000,
    "maxResponseBytes": 1048576,
    "maxContentChars": 30000,
    "maxResults": 5
  }
}
```

## 错误码

| Code | 说明 |
|------|------|
| `INVALID_INPUT` | 缺少必需参数 |
| `SUBAGENTS_DISABLED` | 子代理功能已禁用 |
| `UNKNOWN_AGENT` | 未知代理名称 |
| `SUBAGENT_DISABLED` | 该代理已禁用 |
| `SUBAGENT_DEPTH_EXCEEDED` | 递归深度超限 |
| `SUBAGENT_TIMEOUT` | 执行超时 |
| `SUBAGENT_FAILED` | 子代理执行失败 |
| `SUBAGENT_OUTPUT_TRUNCATED` | 输出被截断 |
