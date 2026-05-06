# Agent 定义格式

Agent 使用 markdown frontmatter + prompt 正文定义。

## 当前支持的 frontmatter 格式

当前 parser 只支持简单 `key: value`，不是完整 YAML parser。因此列表字段使用逗号分隔。

## 示例

```md
---
name: explorer
description: Read-only codebase navigator.
readonly: true
tools: read, grep, find, ls
---

You are the explorer subagent.

Your job:
- Find relevant files.
- Trace code paths.
- Summarize where logic lives.
- Do not modify files.
```

## 必需字段

- `name`
- `description`

## 建议字段

- `readonly`
- `tools`

## 子代理边界

每个 agent prompt 都应说明：

- 自己是 child subagent
- 只处理被委托任务
- 不调用或建议额外 subagents
- 信息不足时明确说明 uncertainty 或 blocked reason
