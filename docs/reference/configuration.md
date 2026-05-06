# 配置参考

## 默认配置

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false,
  "allowBashInReadonlySubagents": false,
  "subagents": {
    "explorer": { "enabled": true, "readonly": true },
    "researcher": { "enabled": true, "readonly": true },
    "reviewer": { "enabled": true, "readonly": true },
    "implementer": { "enabled": true, "readonly": true },
    "tester": { "enabled": true, "readonly": true }
  }
}
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 是否启用 subagent 工具 |
| `maxSubagentDepth` | number | `1` | 子代理递归深度。固定为 1，子代理不能再调子代理 |
| `timeoutMs` | number | `120000` | 子代理执行超时（毫秒） |
| `allowWriteSubagents` | boolean | `false` | 是否允许子代理写文件。第一版默认 false |
| `allowBashInReadonlySubagents` | boolean | `false` | 是否允许 readonly agents 使用 bash。第一版默认 false |
| `subagents` | object | 见上 | 每个 agent 的启用和权限配置 |

## 约束

- 第一版固定 `maxSubagentDepth = 1`
- 默认继承当前 pi 模型
- 第一版不实现 fallback model chain
- 第一版不支持 per-agent model override
- 第一版不实现 skills 注入
- 第一版不实现 `/subagents` 命令

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
