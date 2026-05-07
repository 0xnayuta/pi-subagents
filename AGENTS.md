## 项目目标

将 `pi-subagents` 简化为一个面向 pi 的轻量扩展：

```
1 个主代理 + 1 个 subagent 工具 + 5 个内置子代理
+ foreground 单次执行 + maxDepth = 1 + 默认 readonly
```

目标不是完整多代理框架，而是让主代理可以委托专职子代理完成聚焦任务。

---

## MVP 范围

### 包含

- `subagent` 工具：参数为 `agent` 和 `task`
- 5 个内置 agents：`explorer`、`researcher`、`reviewer`、`implementer`、`tester`
- Markdown frontmatter agent 定义（逗号分隔 tools）
- User/project 自定义 markdown agents
- Foreground 同步执行
- 递归保护：`maxSubagentDepth = 1`
- 最小 child session file（仅用于调试）

### 不包含

| 类别 | 具体内容 |
|------|----------|
| 编排能力 | chain、parallel、background、async |
| 通信能力 | intercom、contact_supervisor |
| 隔离能力 | worktree、fork context |
| UI 能力 | slash 命令、TUI widget |
| 高级能力 | agent management、skills 注入、model fallback |
| 写入能力 | bash/edit/write 在 readonly agents 中 |

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

## 简化规则

### 删除内容

- `src/runs/background/`（async/background）
- `src/intercom/`（intercom）
- `src/slash/`（slash commands）
- `src/tui/`（TUI widget）
- `prompts/`（chain/parallel 模板）
- `skills/`（旧编排 skill）

### 保留核心

- `src/runs/shared/pi-args.ts`、`pi-spawn.ts`（CLI 参数）
- `src/runs/shared/subagent-prompt-runtime.ts`（child boundary）
- `src/agents/frontmatter.ts`（解析）

### Schema 要求

只接受 `agent` 和 `task` 两个参数。已移除：`async`、`chain`、`tasks`、`worktree`、`share`、`model`、`skills` 等。

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

## 验证清单

### 功能验证
- [ ] `subagent({ agent, task })` 可完成 foreground 调用
- [ ] 5 个内置 agents 都能加载
- [ ] unknown agent 返回 `UNKNOWN_AGENT`
- [ ] timeout 返回 `SUBAGENT_TIMEOUT`

### 边界验证
- [ ] 子代理不注册 `subagent` 工具
- [ ] 子代理 prompt 包含 child boundary
- [ ] 不存在 chain/parallel/background 可执行路径

### 安全验证
- [ ] 默认 readonly
- [ ] 敏感信息被 sanitize（token、header、stack trace）
- [ ] 绝对路径不暴露

---

## 错误码

`INVALID_INPUT` | `SUBAGENTS_DISABLED` | `UNKNOWN_AGENT` | `SUBAGENT_DISABLED` | `SUBAGENT_DEPTH_EXCEEDED` | `SUBAGENT_TIMEOUT` | `SUBAGENT_FAILED` | `SUBAGENT_OUTPUT_TRUNCATED`

---

## 文档

- `docs/guides/01-goals-and-scope.md` - 目标与范围
- `docs/guides/03-extension-api.md` - 扩展 API 参考
- `docs/adr/` - 架构决策记录

如需恢复任何删除的功能，必须新增 ADR。

---

*代码优先，如与文档冲突以代码为准。*