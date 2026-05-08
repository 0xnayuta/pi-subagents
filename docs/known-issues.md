---
status: current
audience: maintainer
last_verified: 2026-05-08
---

# 已知问题

> ⚠️ **重要**：部分已知问题与 pi 生态的类型定义不完整有关。详见 [docs/type-compatibility.md](./type-compatibility.md)。

## KI-001: `renderResult` 渲染结果输出为 `[object Object]` — ✅ 已修复

**发现时间**: 2026-05-08
**严重程度**: 中
**影响范围**: 子代理结果在 TUI 中的显示

### 症状

主代理调用子代理后，TUI 中显示的结果类似：

```
[object Object]
 ✓ {"type":"session","version":3,"id":"019e03c4-bef9-71cd-b783-b7c3debbc4c5","timestamp":"2026-05-07T18:48:06.137Z","cwd":"~/repos/pi-subagents"}
```

- `[object Object]` 表明某个 JavaScript 对象被调用了 `.toString()` 而非正确序列化
- `✓` 后面跟的是 session 元数据 JSON，而非子代理的实际执行结果

### 根因分析

**文件**: `src/extension/index.ts`，`renderResult` 函数

```typescript
renderResult(result, options, theme, context) {
    const content = result.content
        .map((item) => item.type === "text" ? item.text : "")
        .join("\n");

    const hasManagedError = Boolean(result.details?.error);
    const prefix = context?.isError || hasManagedError
        ? theme.fg("error", "✗")
        : theme.fg("success", "✓");

    return {
        type: "text" as const,
        text: `${prefix} ${content}`,
        render: () => [`${prefix} ${content}`],
    };
},
```

存在两个问题：

1. **返回对象格式不符合 pi `Component` 接口**

   `renderResult` 应返回 pi 定义的 `Component` 类型，但当前返回的是自定义对象 `{ type: "text", text, render }`。pi 的渲染系统无法识别这个结构，对其调用 `.toString()` 导致 `[object Object]`。

2. **`result.content` 可能为空或结构异常**

   当子代理进程失败或未正常返回时，`result.content` 可能为空数组，或包含非 `{ type: "text", text }` 格式的对象。此时 `.map()` 会返回空字符串，导致实际内容丢失。

### 复现步骤

1. 安装 pi-subagents 扩展
2. 在 pi 中调用 `subagent({ agent: "explorer", task: "找一下项目结构" })`
3. 观察 TUI 输出

### 修复方向

1. **正确实现 `Component` 接口**

   需要查阅 pi 的 `Component` 类型定义（来自 `@mariozechner/pi-tui`），确保 `renderResult` 返回符合接口的对象。

2. **增加 `result.content` 的防御性处理**

   - 处理空 content 数组的情况
   - 处理 content item 缺少 `text` 字段的情况
   - 考虑 `details.error` 作为 fallback 信息源

3. **参考 `renderCall` 的实现**

   `renderCall` 当前使用相同的对象格式，可能也存在类似问题，需一并检查。

### 相关文件

- `src/extension/index.ts` — `renderResult` 和 `renderCall` 实现
- `docs/guides/03-extension-api.md` — pi 扩展 API 中 `Component` 类型定义
- `docs/reference/result-schema.md` — 子代理结果 schema

### 修复说明 (2026-05-08)

**问题已修复**，修复内容：

1. **返回 `Text` 组件而非自定义对象**
   ```typescript
   import { Text } from "@mariozechner/pi-tui";
   
   renderResult(result, _options, theme, context) {
       // 安全提取文本内容
       const content = result.content
           .filter((item): item is { type: "text"; text: string } => item.type === "text")
           .map((item) => item.text)
           .join("\n");
       
       const hasManagedError = Boolean(result.details?.error);
       const prefix = context?.isError || hasManagedError
           ? theme.fg("error", "✗")
           : theme.fg("success", "✓");
       
       return new Text(`${prefix} ${content || "(no output)"}`, 0, 0);
   }
   ```

2. **防御性内容提取**：使用类型守卫确保安全

3. **`renderCall` 同步修复**：使用相同模式

## KI-002: 子代理返回原始 JSONL 而不是最终回答 — ✅ 已修复

**发现时间**: 2026-05-08
**严重程度**: 高
**影响范围**: `subagent` 工具结果、TUI 显示、调用方消费子代理输出

### 症状

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

- 子代理结果非常大，甚至被截断
- 主代理无法直接读取子代理最终结论
- TUI/工具结果显示被 JSONL 事件噪声淹没

### 根因分析

**文件**: `src/runtime/foreground/execution.ts`、`src/runtime/foreground/collect-output.ts`

`runSync()` 直接返回子进程 stdout：

```typescript
resolve({
    exitCode,
    output: output.trim(),
});
```

但子进程使用的是 pi JSON 模式，stdout 是 JSONL 事件流，不是最终文本。原有 `collect-output.ts` 虽然存在，但没有接入 `runSync()`；同时旧的 `extractFinalOutput()` 只支持 mock/legacy 格式：

```typescript
message.type === "result" && typeof message.output === "string"
```

真实 pi 事件流中的最终 assistant 内容位于 `turn_end` 或 `message_end` 的 `message.content[].text` 中，因此无法被提取。

### 修复说明 (2026-05-08)

**问题已修复**，修复内容：

1. **在执行层接入输出收集**

   `src/runtime/foreground/execution.ts` 在子进程关闭后调用 `collectOutput(output)`，返回清洗后的最终文本和 usage：

   ```typescript
   const collected = collectOutput(output);
   let finalOutput = collected.output;
   ```

2. **支持真实 pi JSONL 事件格式**

   `src/runtime/foreground/collect-output.ts` 现在会优先从以下事件提取最终 assistant 文本：

   - `turn_end.message.content[].text`
   - `message_end.message.content[].text`
   - 兼容旧格式 `result.output`

3. **避免再次返回整段 JSONL**

   如果 JSONL 中没有可提取的最终 assistant 文本，返回短诊断信息，而不是完整原始事件流。

4. **补充单元测试**

   新增 `test/unit/collect-output.test.ts`，覆盖：

   - 从 `turn_end` 提取最终文本
   - legacy `result.output` fallback
   - 无最终文本时返回短诊断
   - 非 JSON 输出保持原样
   - usage 提取与归一化

### 验证

已通过：

```bash
npx tsc --noEmit
npx biome check src/runtime/foreground/collect-output.ts src/runtime/foreground/execution.ts
node --experimental-strip-types --test test/unit/collect-output.test.ts
find test/unit -name "*.test.ts" -print0 | xargs -0 node --experimental-strip-types --test
```

重启 pi 后实际调用 `explorer` 搜索 authentication 相关代码，结果已返回干净的最终回答，不再输出原始 JSONL。

### 相关文件

- `src/runtime/foreground/execution.ts` — 接入 `collectOutput()`
- `src/runtime/foreground/collect-output.ts` — JSONL 解析、最终文本提取、usage 提取
- `test/unit/collect-output.test.ts` — 回归测试
