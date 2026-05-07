# 配置参考

## 配置文件位置

`~/.pi/agent/extensions/subagent/config.json`

## MVP 配置字段

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false
}
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 是否启用 subagent 工具 |
| `maxSubagentDepth` | number | `1` | 子代理递归深度。固定为 1，子代理不能再调子代理 |
| `timeoutMs` | number | `120000` | 子代理执行超时（毫秒） |
| `allowWriteSubagents` | boolean | `false` | 是否允许子代理写文件。MVP 默认 false |

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

researcher 可额外使用：

```text
web_search, fetch_content, get_search_content
```

不允许使用 `bash`、`edit`、`write` 等可能修改文件系统的工具。
