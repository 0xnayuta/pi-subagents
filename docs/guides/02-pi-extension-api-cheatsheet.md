# Pi Extension API Cheatsheet

## 注册扩展
```typescript
export default function registerMyExtension(pi: ExtensionAPI): void {
  pi.registerTool({ name, label, description, parameters, execute });
  pi.on("session_start", handler);
  pi.on("session_shutdown", handler);
}
```

## 工具定义
```typescript
interface ToolDefinition<TParams, TDetails, TState> {
  name: string;           // LLM 调用名称
  label: string;          // UI 显示名称
  description: string;    // LLM 描述
  parameters: TSchema;    // TypeBox schema
  execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<TDetails>>;
  renderCall?(args, theme, ctx): Component;
  renderResult?(result, options, theme, ctx): Component;
}
```

## 工具执行签名
```typescript
async execute(
  toolCallId: string,
  params: Static<TParams>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext
): Promise<AgentToolResult<TDetails>>
```

## 返回结果
```typescript
// 成功
{ content: [{ type: "text", text: "result" }], details: {} }

// 流式更新
onUpdate?.({ content: [{ type: "text", text: "partial" }], details: {} });
```

## 事件
```
session_start      - 会话启动
session_shutdown   - 会话关闭
tool_execution_start  - 工具开始
tool_execution_end    - 工具结束
tool_result           - 工具结果（可用于 UI 更新）
```

## 关键导入
```typescript
import { type ExtensionAPI, type ExtensionContext, type ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, Static } from "typebox";
```