---
status: current
audience: maintainer
last_verified: 2026-05-09
---

# 问题记录 (Issue Log)

本文件记录 `pi-subagents` 开发过程中发现的问题、根因、修复方案和当前状态。

## 当前未解决问题

当前无已知未解决问题。

## 已解决问题

### KI-001: `renderResult` 渲染结果输出为 `[object Object]`

**状态**：✅ 已修复  
**发现时间**：2026-05-08  
**严重程度**：中  
**影响范围**：子代理结果在 TUI 中的显示

#### 症状

主代理调用子代理后，TUI 中显示的结果类似：

```text
[object Object]
 ✓ {"type":"session","version":3,"id":"019e03c4-bef9-71cd-b783-b7c3debbc4c5","timestamp":"2026-05-07T18:48:06.137Z","cwd":"~/repos/pi-subagents"}
```

- `[object Object]` 表明某个 JavaScript 对象被调用了 `.toString()` 而非正确序列化。
- `✓` 后面跟的是 session 元数据 JSON，而非子代理的实际执行结果。

#### 根因

`src/extension/index.ts` 中的 `renderResult` 返回了自定义对象，而不是 pi TUI 的 `Component`：

```typescript
return {
    type: "text" as const,
    text: `${prefix} ${content}`,
    render: () => [`${prefix} ${content}`],
};
```

pi 的渲染系统无法识别该对象结构，最终将其显示为 `[object Object]`。

#### 修复

- `renderResult` 改为返回 `@earendil-works/pi-tui` 的 `Text` 组件。
- `renderCall` 同步使用 `Text` 组件。
- 对 `result.content` 做防御性提取。
- 当 content 为空时使用 `details.error` 或 `(no output)` 作为 fallback。

相关文件：

- `src/extension/index.ts`
- `docs/guides/03-extension-api.md`
- `docs/reference/result-schema.md`

---

### KI-002: 子代理返回原始 JSONL 而不是最终回答

**状态**：✅ 已修复  
**发现时间**：2026-05-08  
**严重程度**：高  
**影响范围**：`subagent` 工具结果、TUI 显示、调用方消费子代理输出

#### 症状

调用子代理后，工具结果不是 explorer/reviewer 等子代理的最终回答，而是大量 `pi --mode json` 事件流，例如：

```jsonl
{"type":"session","version":3,"id":"...","cwd":"G:\\source\\repos\\pi-subagents"}
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":[{"type":"text","text":"Task: ..."}]}}
{"type":"tool_execution_start",...}
{"type":"tool_execution_end",...}
```

这会导致：

- 子代理结果非常大，甚至被截断。
- 主代理无法直接读取子代理最终结论。
- TUI/工具结果显示被 JSONL 事件噪声淹没。

#### 根因

`src/runtime/foreground/execution.ts` 中的 `runSync()` 曾直接返回子进程 stdout。由于子进程使用 pi JSON 模式，stdout 是 JSONL 事件流，不是最终文本。

旧输出提取逻辑只兼容 mock/legacy 格式，无法从真实 pi 事件中的 `turn_end.message.content[].text` 或 `message_end.message.content[].text` 提取最终 assistant 文本。

#### 修复

- `runSync()` 接入 `collectOutput()`。
- `collectOutput()` 支持真实 pi JSONL 事件格式。
- 优先从以下事件提取最终 assistant 文本：
  - `turn_end.message.content[].text`
  - `message_end.message.content[].text`
  - legacy `result.output`
- 如果 JSONL 中没有可提取的最终文本，返回短诊断信息，而不是完整原始事件流。
- 增加 `tests/unit/collect-output.test.ts` 回归测试。

相关文件：

- `src/runtime/foreground/execution.ts`
- `src/runtime/foreground/collect-output.ts`
- `tests/unit/collect-output.test.ts`

---

### TC-001: `AgentToolResult` 不应使用 `isError` 返回错误状态

**状态**：✅ 已修复  
**发现时间**：2026-05-08  
**类别**：类型/协议语义兼容

#### 背景

pi 的 `tool_execution_end` 事件、`ToolResultMessage`、`ToolRenderContext` 和 `tool_result` hook 中确实存在 `isError`，但 `AgentToolResult<T>` 返回值中的 `isError` 不会被 pi-agent-core 解释。

pi 上游相关 issue：

- <https://github.com/earendil-works/pi/issues/1881>
- <https://github.com/earendil-works/pi/issues/374>

维护者结论：工具错误应通过 `throw` 表达；`isError` 从未设计为由 tool `execute()` 的普通返回值解释。

因此，下面这种返回方式是错误/误导性的：

```typescript
return {
    content: [...],
    details: {...},
    isError: true, // 不会使 tool_execution_end.isError 变为 true
};
```

#### 修复

`pi-subagents` 不再从 `execute()` 返回 `isError`。子代理的可恢复/管理层错误统一编码到 `details.error`：

```typescript
return {
    content: [{ type: "text", text: message }],
    details: {
        mode: "single",
        results: [],
        error: { code, message },
    },
};
```

TUI 渲染根据 `context.isError`（pi 协议级错误）或 `details.error` / 非零 `results[].exitCode`（子代理管理层错误）显示失败状态。

#### 处理原则

- 参数缺失、未知 agent、depth exceeded、子进程非零退出、timeout：返回 `details.error`。
- 代码 bug、不可恢复内部异常、需要 pi 协议级失败：抛出异常。
- 不从 `AgentToolResult` 返回 `isError`。

相关文件：

- `src/extension/index.ts`
- `src/runtime/foreground/subagent-executor.ts`

---

### TC-002: TypeBox `TObject` 不满足 `TSchema` 约束

**状态**：✅ 已修复  
**发现时间**：2026-05-09  
**类别**：类型兼容

#### 根因

该问题存在于旧版依赖组合：`@mariozechner/pi-*` 0.65.x 的 `ToolDefinition` 使用 `@sinclair/typebox` 的 `TSchema`，而 `pi-subagents` 使用 `typebox` 1.x 的 `Type.Object()`。

两套 TypeBox 类型不兼容，因此 `typebox` 1.x 的 `TObject` 无法满足旧 pi 类型定义中的 `TSchema` 约束。

#### 修复

项目已迁移到 `@earendil-works/pi-*` 0.74.x。pi 上游已经统一改用 `typebox` 1.x：

```typescript
import type { Static, TSchema } from "typebox";
```

因此 `SubagentParams` 与 web tools schema 现在可直接赋给 `ToolDefinition.parameters`，相关 `parameters: ... as any` 已移除。

相关文件：

- `src/extension/index.ts`
- `src/extension/schemas.ts`
- `src/web/index.ts`
- `src/web/schemas.ts`

---

### TC-003: 事件处理器类型签名差异

**状态**：✅ 已修复  
**发现时间**：2026-05-09  
**类别**：类型兼容

#### 根因

旧记录认为 pi 的 `ExtensionAPI.on()` 方法对 `"context"` 事件的类型定义可能不完整或与实际 API 不匹配，因此代码曾使用：

```typescript
pi.on("context" as any, (event: any) => {
    // ...
});
```

在当前依赖组合 `@earendil-works/pi-coding-agent` 0.74.x 中，`ExtensionAPI.on()` 已经包含 `"context"` 事件重载：

```typescript
on(event: "context", handler: ExtensionHandler<ContextEvent, ContextEventResult>): void;
```

`ContextEvent` 和 `ContextEventResult` 也已在 pi 上游类型中定义。

#### 修复

已移除事件名和事件对象上的 `any` 绕过，直接使用上游类型推导：

```typescript
pi.on("context", (event) => {
  const messages = stripParentOnlySubagentMessages(event.messages) as typeof event.messages;
  if (messages === event.messages) return undefined;
  return { messages };
});
```

`stripParentOnlySubagentMessages()` 仍保持 `unknown[]` 输入/输出，以便复用在测试和宽松消息形状处理场景中；在 `context` hook 返回前，将结果收窄为 `typeof event.messages`。该断言表示过滤逻辑只删除或浅复制消息，不构造新的非消息结构。

相关文件：

- `src/runtime/shared/subagent-prompt-runtime.ts`

## 维护原则

1. 遵循 pi 上游语义：工具协议级错误通过 `throw` 表达，不从 `AgentToolResult` 返回 `isError`。
2. 管理层错误结构化：子代理可恢复错误使用 `details.error` 和错误码表达。
3. 谨慎使用类型断言：仅在运行时逻辑已验证但 TypeScript 无法表达时使用窄范围断言，避免用 `as any` 绕过上游类型。
4. 新问题先记录状态、根因和验证方式；修复后保留问题记录作为回归参考。

## 更新日志

| 日期 | 问题 | 状态 |
|------|------|------|
| 2026-05-08 | KI-001 `renderResult` 渲染结果输出为 `[object Object]` | 已修复 |
| 2026-05-08 | KI-002 子代理返回原始 JSONL 而不是最终回答 | 已修复 |
| 2026-05-08 | TC-001 `AgentToolResult` / `isError` 语义 | 已按上游结论改为 `details.error` |
| 2026-05-09 | TC-002 TypeBox TObject 不满足 TSchema | 已通过迁移到 @earendil-works/pi-* 0.74.x + typebox 1.x 修复 |
| 2026-05-09 | TC-003 事件处理器类型差异 | 已通过 @earendil-works/pi-coding-agent 0.74.x 的 `context` 事件重载修复，移除 `as any` |
