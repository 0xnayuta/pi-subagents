## 项目概述

`pi-subagents` 是一个面向 pi 的轻量扩展：

```
1 个主代理 + 1 个 subagent 工具 + 5 个内置子代理
+ foreground 单次执行 + maxDepth = 1 + 默认 readonly
```

不是完整多代理框架，而是让主代理可以委托专职子代理完成聚焦任务。

---

## 目录结构

```
src/
├─ extension/    # 扩展入口、工具注册
├─ agents/       # agent 加载、frontmatter 解析
├─ runtime/      # 启动 pi、收集输出、sanitize
├─ config/       # 配置加载
└─ shared/       # 类型、通用工具

agents/           # 5 个内置 agent 定义
```

### 设计边界

- 主代理是唯一 orchestrator
- `subagent` 工具每次只启动一个子代理
- 子代理 session 不注册 `subagent` 工具

---

## 核心原则

1. **轻量化优先**：宁可功能少，也要简单清晰
2. **主代理编排**：子代理不能调度其他子代理
3. **安全默认**：readonly、depth=1、敏感信息清理
4. **单一执行路径**：不支持后台、并行、链式执行

### 内置 Agent 职责

| Agent | 职责 | 权限 |
|-------|------|------|
| `explorer` | 代码导航、文件搜索 | readonly |
| `researcher` | 文档/API 研究 | readonly |
| `reviewer` | 代码/架构审查 | readonly |
| `implementer` | 实现规划 | readonly（默认） |
| `tester` | 测试规划 | readonly（默认） |

### 子代理约束

每个子代理 prompt 必须包含：只处理 delegated task、不调用额外 subagents、信息不足时报告 uncertainty。

---

## 开发命令

```bash
# 构建与类型检查
pnpm build && pnpm typecheck

# 测试
pnpm test
pnpm test:unit
pnpm test:integration

# 代码质量
pnpm lint && pnpm format
```

### 验证命令

```bash
# 验证无旧功能入口
rg "chain|parallel|background|intercom|worktree|slash|tui" src

# 验证 schema 极简
rg "Type.Object" src/extension/schemas.ts
```

---

## 错误码

`INVALID_INPUT` | `SUBAGENTS_DISABLED` | `UNKNOWN_AGENT` | `SUBAGENT_DISABLED` | `SUBAGENT_DEPTH_EXCEEDED` | `SUBAGENT_TIMEOUT` | `SUBAGENT_FAILED` | `SUBAGENT_OUTPUT_TRUNCATED`

---

## 文档

- `docs/guides/01-goals-and-scope.md` - 目标与范围
- `docs/guides/03-extension-api.md` - 扩展 API 参考
- `docs/adr/` - 架构决策记录

如需恢复任何删除的功能，必须新增 ADR。
