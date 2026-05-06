# 测试策略

## 核心测试范围

- 工具注册：`subagent` 可被主代理发现
- 参数校验：缺少 agent/task 时返回稳定错误
- agent 加载：frontmatter 解析正确
- unknown agent：返回清晰错误
- foreground 执行：能启动并返回结果
- 递归保护：子代理不能再调用 `subagent`
- readonly 默认值：写入能力默认禁用
- sanitize：敏感信息不会出现在最终结果中

## 建议测试分层

```text
test/unit/         # frontmatter、config、schema、sanitize、depth guard
test/integration/  # tool handler 到 child execution 的主路径
```

## 不再维护的测试方向

随着功能裁剪，以下测试应删除或迁移为“明确不支持”的测试：

- async/background
- chain execution
- parallel execution
- intercom
- worktree
- TUI widget
- slash bridge
