# 安全模型

## 默认策略

- 默认 readonly
- 默认 `maxSubagentDepth = 1`
- 子代理不继承 `subagent` 工具
- 子代理只处理被委托的 task
- 子代理不应扩大任务范围

## 输出清理

结果中不应暴露：

- API key
- npm token
- Authorization header
- 环境变量值
- 完整 stack trace
- 绝对路径
- 完整系统 prompt

## 写入能力

第一版建议不开放写入。即使是 `implementer` 和 `tester`，也优先返回 patch plan 或测试建议。

后续如需写入，应通过显式配置开启：

```json
{
  "allowWriteSubagents": true,
  "subagents": {
    "implementer": { "readonly": false },
    "tester": { "readonly": false }
  }
}
```
