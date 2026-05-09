# MVP 测试指南

## 测试策略

### 保留旧测试到 Phase 7

按照简化策略，我们**不边删边修**旧测试，而是：
1. **Phase 1-6**: 开发 MVP 功能，编写新测试覆盖 MVP 行为
2. **Phase 7**: 批量删除旧测试目录

这样做的好处：
- 旧测试作为功能迁移的参照
- 新测试独立验证 MVP 行为
- 避免修改旧测试引入回归风险

## 运行测试

### MVP 单元测试
```bash
pnpm test:mvp
```

### MVP 集成测试
```bash
pnpm test:mvp:integration
```

### 全部测试（包括旧测试）
```bash
pnpm test:all
```

## 测试覆盖范围

### MVP 包含功能

| 模块 | 测试文件 | 描述 |
|------|----------|------|
| Tool Registration | `tool-registration.test.ts` | subagent 工具注册和 schema |
| Built-in Agents | `builtin-agents.test.ts` | 5 个内置 agents 发现和属性 |
| Recursion Guard | `recursion-guard.test.ts` | maxSubagentDepth=1 保护 |
| Readonly Scope | `readonly-scope.test.ts` | 所有 agents 只读，安全工具 |
| Frontmatter | `frontmatter.test.ts` | markdown frontmatter 解析 |
| Child Session | `child-session.test.ts` | 最小 session 文件生成 |
| Extension | `extension-registration.test.ts` | 扩展注册和生命周期 |
| Single Execution | `single-execution.test.ts` | 同步执行流程 |

### MVP 排除功能（Phase 7 删除）

| 旧功能 | 测试文件 | 说明 |
|--------|----------|------|
| Async execution | `async-*.test.ts` | 背景作业已移除 |
| Chain workflow | `chain-*.test.ts` | 链式执行已移除 |
| Parallel execution | `parallel-*.test.ts` | 并行执行已移除 |
| Intercom | `intercom-*.test.ts` | 进程间通信已移除 |
| Slash commands | `slash-*.test.ts` | slash 命令已移除 |
| Agent management | `agent-management.test.ts` | 创建/更新/删除已移除 |
| Skills | `skills-fallback.test.ts` | skills 注入已移除 |
| Worktree | `worktree.test.ts` | worktree 管理已移除 |

## Phase 7 删除命令

```bash
# 删除旧的集成测试
rm test/integration/async*.test.ts
rm test/integration/chain*.test.ts
rm test/integration/slash*.test.ts
rm test/integration/intercom*.test.ts
rm test/integration/parallel*.test.ts
rm test/integration/render*.test.ts
rm test/integration/result-watcher.test.ts

# 删除旧的单元测试
rm test/unit/agent-management.test.ts
rm test/unit/agent-overrides.test.ts
rm test/unit/async-resume.test.ts
rm test/unit/intercom-bridge.test.ts
rm test/unit/pi-spawn.test.ts
rm test/unit/skills-fallback.test.ts
rm test/unit/worktree.test.ts
rm test/unit/slash-*.test.ts
rm test/unit/background-*.test.ts

# 清理 support 文件夹（如需要）
rm test/support/register-loader.mjs
```

## 测试编写原则

1. **专注于 MVP 行为**：每个测试验证 MVP 定义的一个具体行为
2. **使用真实代码路径**：尽量导入实际模块而非 mock
3. **清晰的测试命名**：`it("describes expected behavior")` 格式
4. **独立的测试**：每个测试可独立运行，不依赖其他测试
5. **有意义的断言**：`assert.equal(actual, expected)` 而非模糊断言