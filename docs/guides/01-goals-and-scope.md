# 目标与范围

## 项目目标

将 `pi-subagents` 简化为一个面向 pi 的轻量扩展：

```text
1 个主代理
+ 1 个 subagent 工具
+ 5 个内置子代理
+ foreground 单次执行
+ max depth = 1
```

目标不是完整多代理框架，而是让主代理可以在需要时委托一个专职子代理完成聚焦任务。

## MVP 包含

- 注册 `subagent` 工具
- 支持参数：`agent`、`task`
- 支持 5 个内置 agents：`explorer`、`researcher`、`reviewer`、`implementer`、`tester`
- 支持 markdown frontmatter agent 定义
- foreground 同步执行
- 递归保护：子代理不能再调用子代理
- 默认 readonly
- 简单配置、简单错误处理、简单结果返回

## MVP 不包含

- background/async jobs
- chain workflow
- parallel execution
- intercom
- worktree 管理
- TUI widget
- slash bridge
- complex artifact system
- fallback model chain
- 多代理编排引擎
