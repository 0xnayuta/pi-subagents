---
status: current
audience: maintainer
last_verified: 2026-05-08
---

# 类型兼容性问题 (Type Compatibility Issues)

本文档记录 pi 生态类型定义与 pi-subagents 实际使用之间的已知差异。

## 概述

pi-subagents 在开发过程中使用了 pi 生态的类型定义，但发现了一些类型定义不完整或不匹配的情况。这些问题不影响运行时行为，但会导致 TypeScript 类型检查错误。

---

## 已知的类型差异

### 1. `AgentToolResult` 不应使用 `isError` 返回错误状态

**位置**：
- `src/extension/index.ts` - `renderResult` 函数
- `src/runtime/foreground/subagent-executor.ts` - 管理层错误返回

**调查结论**：
pi 的 `tool_execution_end` 事件、`ToolResultMessage`、`ToolRenderContext` 和 `tool_result` hook 中确实存在 `isError`，但 **`AgentToolResult<T>` 返回值中的 `isError` 不会被 pi-agent-core 解释**。

pi 上游已有相关 issue：

- https://github.com/earendil-works/pi/issues/1881
- https://github.com/earendil-works/pi/issues/374

维护者结论：工具错误应通过 `throw` 表达；`isError` 从未设计为由 tool `execute()` 的普通返回值解释。

因此，下面这种返回方式是错误/误导性的：

```typescript
return {
    content: [...],
    details: {...},
    isError: true, // 不会使 tool_execution_end.isError 变为 true
};
```

pi-agent-core 会把正常 resolve 的工具结果视为成功；只有工具抛错或 hook 显式覆盖时，顶层 `tool_execution_end.isError` 才会为 `true`。

**当前方案**：
pi-subagents 不再从 `execute()` 返回 `isError`。子代理的可恢复/管理层错误统一编码到 `details.error`：

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

**原则**：
- 参数缺失、未知 agent、depth exceeded、子进程非零退出、timeout：返回 `details.error`
- 代码 bug、不可恢复内部异常、需要 pi 协议级失败：抛出异常

---

### 2. TypeBox `TObject` 不满足 `TSchema` 约束

**位置**：
- `src/extension/index.ts` - `tool.parameters`
- `src/extension/schemas.ts` - `SubagentParams` 定义
- `src/web/index.ts` / `src/web/schemas.ts` - web tools 参数 schema

**调查结论**：
该问题真实存在于旧版依赖组合：`@mariozechner/pi-*` 0.65.x 的 `ToolDefinition` 使用 `@sinclair/typebox` 的 `TSchema`，而 pi-subagents 使用 `typebox` 1.x 的 `Type.Object()`。两套 TypeBox 类型不兼容，因此 `typebox` 1.x 的 `TObject` 无法满足旧 pi 类型定义中的 `TSchema` 约束。

pi 0.74.0 更换包名为 `@earendil-works/pi-*` 后，pi 上游已经统一改用 `typebox` 1.x：

```typescript
import type { Static, TSchema } from "typebox";
```

因此根因不是 `Type.Object()` 构造方式错误，而是旧依赖组合中 schema 类型来源不一致。

**当前解决方案**：
已迁移到 `@earendil-works/pi-*` 0.74.x，并保留 `typebox` 1.x。`SubagentParams` 与 web tools schema 现在可直接赋给 `ToolDefinition.parameters`，相关 `parameters: ... as any` 已移除。

```typescript
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SubagentParams = Type.Object({ ... });

const tool = defineTool({
  parameters: SubagentParams,
  async execute(_id, params) {
    // params 由 Static<typeof SubagentParams> 推导
  },
});
```

**状态**：
已修复。

---

### 3. 事件处理器类型签名差异

**位置**：
- `src/runtime/shared/subagent-prompt-runtime.ts` - `pi.on("context", ...)`

**描述**：
pi 的 `ExtensionAPI.on()` 方法对 `"context"` 事件的类型定义可能不完整或与实际 API 不匹配。

```typescript
// 当前代码
pi.on("context" as any, (event: any) => {
    // ...
});
```

**当前解决方案**：
使用 `as any` 绕过事件类型检查。

**建议**：
- 验证 pi 的事件类型定义
- 报告缺失的类型定义

---

## 处理原则

1. **遵循 pi 上游语义**：工具协议级错误通过 `throw` 表达，不从 `AgentToolResult` 返回 `isError`
2. **管理层错误结构化**：子代理可恢复错误使用 `details.error` 和错误码表达
3. **谨慎使用 `as any`**：仅用于已确认的 TypeBox/事件类型兼容问题
4. **记录跟踪**：每个问题都应记录以便后续跟进

---

## 更新日志

| 日期 | 问题 | 状态 |
|------|------|------|
| 2026-05-08 | `AgentToolResult` / `isError` 语义 | 已按上游结论改为 `details.error` |
| 2026-05-09 | TypeBox TObject 不满足 TSchema | 已通过迁移到 @earendil-works/pi-* 0.74.x + typebox 1.x 修复 |
| 2026-05-08 | 事件处理器类型差异 | 待调查 |
