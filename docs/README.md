---
status: current
audience: all
last_verified: 2026-05-08
---

# pi-subagents 文档索引

本目录用于支撑 `pi-subagents` 的使用与长期维护。核心原则：文档围绕一个轻量 `subagent` 工具展开，避免把项目重新推向复杂多代理编排平台。

## 用户文档

适合安装、配置和使用扩展时阅读。

1. [目标与范围](./guides/01-goals-and-scope.md)
2. [Subagent 工具 API](./reference/subagent-tool.md)
3. [Agent 定义格式](./reference/agent-definition.md)
4. [配置参考](./reference/configuration.md)
5. [结果 Schema](./reference/result-schema.md)
6. [已知问题列表](./known-issues.md)

## 维护者文档

适合修改代码、验证行为和准备发布时阅读。

1. [架构总览](./guides/02-architecture.md)
2. [扩展 API 参考](./guides/03-extension-api.md)
3. [安全模型](./guides/05-security-model.md)
4. [测试策略](./guides/06-testing.md)
5. [类型兼容说明](./type-compatibility.md)
6. [发布前检查清单](./guides/release-checklist.md)

## 决策记录

- [ADR 0001：采用轻量 foreground subagent 设计](./adr/0001-lightweight-foreground-subagents.md)
- [ADR 0002：MVP 边界决策](./adr/0002-mvp-boundary-decisions.md)
- [ADR 0003：自主触发子代理的改进方案（Proposed）](./adr/0003-autonomous-subagent-triggering.md)

## 历史与审计

这些文档记录简化改造过程，不作为当前代码结构的 source of truth。

- [Phase 0 审计](./audits/phase-0-audit.md)
- [简化改造实施记录](./audits/simplification-implementation-history.md)
- [删除清单审计](./audits/deletion-audit.md)
- [pi-subagents 简化改造参考文档](./pi-subagents-simplification-guide.md)
