# 已知问题

## KI-001: `renderResult` 渲染结果输出为 `[object Object]`

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
renderResult(result, options, theme) {
    const content = result.content
        .map((item) => item.type === "text" ? item.text : "")
        .join("\n");

    const prefix = result.isError
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
