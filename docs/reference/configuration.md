# 配置参考

## 推荐默认配置

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false,
  "subagents": {
    "explorer": { "enabled": true, "readonly": true },
    "researcher": { "enabled": true, "readonly": true },
    "reviewer": { "enabled": true, "readonly": true },
    "implementer": { "enabled": true, "readonly": true },
    "tester": { "enabled": true, "readonly": true }
  }
}
```

## 约束

- 第一版固定 `maxSubagentDepth = 1`
- 默认继承当前 pi 模型
- 第一版不实现 fallback model chain
- 第一版不建议 per-agent model override
