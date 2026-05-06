# 结果 Schema

## 成功结果

```json
{
  "schemaVersion": 1,
  "ok": true,
  "agent": "explorer",
  "summary": "Found auth middleware in src/server/auth.ts.",
  "result": "...",
  "files": ["src/server/auth.ts"],
  "warnings": []
}
```

## 错误结果

```json
{
  "schemaVersion": 1,
  "ok": false,
  "agent": "explorer",
  "error": {
    "code": "SUBAGENT_FAILED",
    "message": "Subagent exited unsuccessfully."
  },
  "warnings": []
}
```

## 输出要求

- 结构稳定
- 错误信息简短
- 不暴露敏感信息
- 不暴露完整 stack trace
