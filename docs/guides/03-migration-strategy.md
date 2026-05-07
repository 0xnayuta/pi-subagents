# MVP 迁移策略

## 核心原则

- **直接重写**：入口、schema、核心类型
- **选择性复用**：runtime 逻辑按需抽取
- **批量删除**：高级功能模块统一移除

## 执行顺序

```
Phase 1: 重写核心（入口 + 类型）
Phase 2: 重建 agents（5 个内置）
Phase 3: 简化 runtime（保留核心）
Phase 4: 删除旧模块
Phase 5: 测试验证
Phase 6: 清理
Phase 7: 删除旧测试
```

---

## Phase 1: 重写核心

### 1.1 创建 MVP agents 定义

**目标文件**: `agents/` 目录

```bash
agents/
├── explorer.md      # read, grep, find, ls
├── researcher.md    # read, grep, find, ls + web search
├── reviewer.md     # read, grep
├── implementer.md  # readonly，返回 plan（无 bash/edit/write）
└── tester.md       # readonly，返回 test plan（无 bash/edit/write）
```

**共同属性**:
- `readonly: true`
- `maxSubagentDepth: 1`
- `source: builtin`

### 1.2 重写 schemas.ts

**目标文件**: `src/extension/schemas.ts`

```typescript
// MVP: 极简 schema
const SubagentParams = Type.Object({
  agent: Type.String(),                              // 必填
  task: Type.Optional(Type.String()),                // 可选（self-contained agents）
  sessionDir: Type.Optional(Type.String()),
  // 以下参数已移除（不在 MVP）:
  // async, chain, tasks, parallel, worktree, share
});
```

**已移除参数**:
- `async` - background jobs
- `chain` - chain workflow
- `tasks` - parallel execution
- `worktree` - worktree management
- `share` - session sharing
- `control` - 简化控制

### 1.3 重写 types.ts

**目标文件**: `src/shared/types.ts`

**保留类型**:
- `AgentProgress` - 执行进度
- `SingleResult` - 执行结果
- `Usage` - token 使用统计

**移除类型**:
- `AsyncJobState` - async jobs
- `ChainResult` - chain workflow
- `IntercomMessage` - intercom
- `ParallelResult` - parallel execution

**新增类型**:
- `MVPDetails` - MVP 结果详情

### 1.4 重写 extension/index.ts

**目标文件**: `src/extension/index.ts`

**最小功能**:
1. `pi.registerTool(subagentTool)` - 注册工具
2. `pi.on("session_start")` - session 生命周期
3. `pi.on("session_shutdown")` - 清理

**已移除功能**:
- slash commands（`/subagents`）
- async job tracker
- result watcher
- TUI widget rendering
- intercom bridge

---

## Phase 2: 重建 agents

### 2.1 简化 agents.ts

**目标文件**: `src/agents/agents.ts`

**保留函数**:
- `discoverAgents(cwd, scope)` - 发现 agents
- `getBuiltinAgents()` - 内置 agents

**移除功能**:
- chain 发现（`discoverChains`）
- packaged agents（`package.*` 前缀）
- 复杂继承逻辑（`inheritSkills`, `defaultContext`）

### 2.2 简化 frontmatter.ts

**目标文件**: `src/agents/frontmatter.ts`

**保留字段**:
- `name`
- `description`
- `readonly`
- `tools`（逗号分隔）
- `systemPrompt`（body 部分）

**移除字段**:
- `package`
- `inheritSkills`
- `defaultContext`
- `fallbackModels`

### 2.3 简化 agent-serializer.ts

**目标文件**: `src/agents/agent-serializer.ts`

**保留函数**:
- `serializeAgent(agent)` - 序列化单个 agent

**移除功能**:
- chain 序列化
- packaged agent 序列化

---

## Phase 3: 简化 runtime

### 3.1 简化 execution.ts

**目标文件**: `src/runs/foreground/execution.ts`

**保留核心**:
- `runSync()` - 单 agent 同步执行
- 模型回退逻辑
- session 文件写入

**移除逻辑**:
- chain 执行（`runChain`）
- parallel 执行（`runParallel`）
- async 逻辑

### 3.2 简化 subagent-executor.ts

**目标文件**: `src/runs/foreground/subagent-executor.ts`

**保留**:
- 单 agent 执行逻辑
- 工具调用解析

**移除**:
- async/slash/intercom 相关代码
- 多任务协调

### 3.3 保留共享模块

| 文件 | 决策 | 理由 |
|------|------|------|
| `pi-args.ts` | 保留 | 子进程参数构建 |
| `single-output.ts` | 保留 | 输出处理 |
| `pi-spawn.ts` | 保留 | 子进程生成 |
| `completion-guard.ts` | 保留 | 有用 |
| `model-fallback.ts` | 保留 | 有用 |

---

## Phase 4: 删除旧模块

### 删除目录

```bash
rm -rf src/background/          # async execution
rm -rf src/intercom/           # intercom bridge
rm -rf src/slash/              # slash commands
rm -rf src/tui/                # widget rendering
```

### 删除文件

```bash
# src/agents/
rm src/agents/chain-serializer.ts
rm src/agents/agent-management.ts
rm src/agents/skills.ts
rm src/agents/identity.ts

# src/shared/
rm src/shared/artifacts.ts
rm src/shared/jsonl-writer.ts
rm src/shared/post-exit-stdio-guard.ts

# src/extension/
rm src/extension/control-notices.ts

# src/runs/foreground/
rm src/runs/foreground/chain-*.ts

# src/runs/background/
# （整个目录删除）

# src/runs/shared/
rm src/runs/shared/long-running-guard.ts
rm src/runs/shared/subagent-control.ts
```

### 删除配置

```json
// package.json
{
  "pi": {
    "skills": [],      // 删除
    "prompts": []       // 删除
  }
}
```

---

## Phase 7: 删除旧测试

```bash
# 集成测试
rm test/integration/async*.test.ts
rm test/integration/chain*.test.ts
rm test/integration/slash*.test.ts
rm test/integration/intercom*.test.ts
rm test/integration/parallel*.test.ts
rm test/integration/render*.test.ts
rm test/integration/result-watcher.test.ts
rm test/integration/top-level-async.test.ts

# 单元测试
rm test/unit/agent-management.test.ts
rm test/unit/agent-overrides.test.ts
rm test/unit/async-resume.test.ts
rm test/unit/chain-serializer.test.ts
rm test/unit/intercom-bridge.test.ts
rm test/unit/pi-spawn.test.ts
rm test/unit/skills-fallback.test.ts
rm test/unit/worktree.test.ts
rm test/unit/slash-*.test.ts
rm test/unit/background-*.test.ts
rm test/unit/close-grace-timer.test.ts
rm test/unit/completion-dedupe.test.ts
rm test/unit/notify.test.ts
rm test/unit/stale-run-reconciler.test.ts
```

---

## 验证清单

每个 Phase 完成后运行：

```bash
pnpm test:mvp              # MVP 单元测试
pnpm test:mvp:integration  # MVP 集成测试
pnpm test                   # 原有测试（应该失败，因为功能已移除）
```

### Phase 1 验证
- [ ] 5 个 MVP agents 定义存在
- [ ] schema 只包含 agent, task, sessionDir
- [ ] types.ts 无 async/chain/intercom 类型

### Phase 2 验证
- [ ] `discoverAgents` 返回 5 个内置 agents
- [ ] frontmatter 解析 name, description, readonly, tools

### Phase 3 验证
- [ ] `runSync` 执行单个 agent
- [ ] 递归保护生效（maxSubagentDepth=1）

### Phase 4 验证
- [ ] 无 slash commands
- [ ] 无 async jobs
- [ ] 无 TUI widget

---

## 文件变更摘要

| 类别 | 操作 | 文件数 |
|------|------|--------|
| 新建 | MVP agents | 5 |
| 重写 | 入口 + schema | 3 |
| 简化 | agents 模块 | 3 |
| 保留 | runtime 核心 | 4 |
| 删除 | 旧模块 | ~25 |