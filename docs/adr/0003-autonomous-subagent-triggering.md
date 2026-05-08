---
status: proposed
audience: maintainer
last_verified: 2026-05-08
---

# ADR 0003：自主触发子代理的改进方案

## 状态

Proposed

## 背景

当前设计中，主代理是否使用 `subagent` 完全取决于模型的自由判断，没有任何机制引导其行为。实际使用中，主代理倾向于自己直接用 `read`、`bash` 等工具完成任务，而非委托给更专业的子代理。

根本原因：

| 当前状态 | 问题 |
|----------|------|
| 工具 description 只描述"做什么" | 没有说"什么时候该用" |
| `before_agent_start` 只处理子代理的 prompt | 没有向主代理注入委托策略 |
| 完全靠模型自觉 | 模型倾向于自己直接做 |

## 方案

### 方案 A：增强工具 Description

在 `subagent` 工具的 `description` 中加入委托触发指引，例如：

```
IMPORTANT: Prefer this tool when the user's request involves:
- "find" / "search" / "locate" / "where is" → use explorer
- "research" / "compare" / "investigate" / "pros and cons" → use researcher
- "review" / "audit" / "check" / "diff" → use reviewer
- "plan" / "design" / "how to implement" → use implementer
- "test" / "coverage" / "edge cases" → use tester
```

- **优点**：改动最小，零架构侵入
- **缺点**：description 权重低于 system prompt，模型可能仍然忽略

### 方案 B：通过 `before_agent_start` 注入委托策略

利用已有的 `before_agent_start` hook，向主代理的 system prompt 追加一段"委托策略"指引：

```typescript
pi.on("before_agent_start", async (event) => {
  // ... 现有子代理 prompt 处理逻辑 ...

  const delegationPolicy = `
## Subagent Delegation Policy
When the user's request matches a subagent's specialty, prefer delegating:
- Code search/navigation → explorer
- Web research → researcher
- Code review → reviewer
- Implementation planning → implementer
- Test planning → tester
`;
  // 追加到 system prompt
});
```

- **优点**：system prompt 权重高，模型更容易遵循
- **缺点**：更侵入式，可能与用户自定义 system prompt 冲突；建议做成可配置项（如 `injectDelegationPolicy: true`）

## 决策

采用**方案 A + B 分层推进**：

| 阶段 | 方案 | 说明 |
|------|------|------|
| 近期 | A | 增强 tool description，改动最小，立即可做 |
| 中期 | B | 通过 hook 注入委托策略，做成可配置项 |

## 影响

- 方案 A 仅修改 `src/extension/index.ts` 中工具描述文本
- 方案 B 需修改 `src/runtime/shared/subagent-prompt-runtime.ts` 和 `src/shared/types.ts`（新增配置项）
- 后续实施需新增 ADR 记录最终决策
