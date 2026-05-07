# 简化改造实施计划

本文档基于对当前代码的实际阅读结果修订，作为 `pi-subagents` 简化改造的可执行计划。

## 当前代码事实

当前项目不是一个简单工具，而是一个完整度较高的多代理编排扩展。主要事实：

- 扩展入口在 `src/extension/index.ts`，目前同时注册：
  - `subagent` tool
  - async result watcher
  - async job tracker
  - slash bridge
  - prompt template bridge
  - TUI renderers
  - notify renderer
  - control notice renderer
- tool schema 在 `src/extension/schemas.ts`，当前支持大量参数：`action`、`tasks`、`chain`、`concurrency`、`worktree`、`async`、`model`、`fallback` 相关控制、`clarify`、`share`、`sessionDir`、`output` 等。
- 主执行器在 `src/runs/foreground/subagent-executor.ts`，当前混合处理：
  - management action
  - foreground single
  - foreground parallel
  - foreground chain
  - async/background
  - resume/interrupt/status
  - intercom
  - worktree
  - fork context
  - clarify TUI
- 真正启动 child pi 的核心逻辑在 `src/runs/foreground/execution.ts`。
- pi 参数构造在 `src/runs/shared/pi-args.ts`。
- pi 命令解析在 `src/runs/shared/pi-spawn.ts`。
- 子代理 prompt runtime 在 `src/runs/shared/subagent-prompt-runtime.ts`，已经有可复用的 child boundary 和父消息过滤逻辑。
- agent discovery 在 `src/agents/agents.ts`，当前包含 builtins、user agents、project agents、chains、settings overrides、management 等能力。
- frontmatter 解析器 `src/agents/frontmatter.ts` 不是完整 YAML 解析器，只支持简单 `key: value`。因此当前 markdown 示例中的列表应使用逗号形式，例如 `tools: read, grep, find, ls`，除非先重写 parser。

## 总目标

最终形态：

```text
simple pi subagents
= 一个 pi 扩展包
+ 一个 subagent 工具
+ 五个内置子代理
+ foreground 单次执行
+ maxSubagentDepth = 1
+ 默认 readonly
```

核心原则：

- 主代理是唯一 orchestrator。
- `subagent` 工具每次只启动一个子代理。
- 子代理不能再调用子代理。
- 第一版不支持 background、parallel、chain、intercom、worktree、TUI widget、slash bridge、复杂 artifact/session 管理。

---

## Phase 0：建立基线与裁剪清单 ✅ 已完成

### 目标

在改代码前确认所有旧能力入口，避免只删文件但仍有 import、schema、README 或测试残留。

### 已完成

- [x] 删除目录：`src/runs/background/`, `src/intercom/`, `src/slash/`, `src/tui/`, `prompts/`, `skills/`
- [x] 删除旧文件：chain-clarify.ts, chain-execution.ts, parallel-utils.ts, model-fallback.ts, worktree.ts 等
- [x] 重写 schemas.ts：仅保留 `agent` 和 `task` 参数
- [x] 创建 5 个内置 agents：explorer, researcher, reviewer, implementer, tester
- [x] 更新 package.json
- [x] 清理旧测试，创建 MVP 测试
- [x] 验证清理结果：`rg "chain|parallel|background|intercom|worktree|slash|tui" src` 仅 3 个文件含误报（注释/环境变量）

### 验收标准 ✅

- [x] 明确每个旧模块的去留
- [x] 先提交文档/计划，不混入代码大改
- [x] MVP 测试全部通过 (86 unit + 27 test)

---

## Phase 1：重建最小类型、配置与结果模型

### 目标

先替换复杂类型，否则后续代码会被旧 `Details`、`SingleResult`、`AsyncStatus`、`ControlEvent` 等类型拖住。

### 主要任务

1. 重写 `src/shared/types.ts`，只保留 MVP 类型：

```ts
export type BuiltinSubagentName = "explorer" | "researcher" | "reviewer" | "implementer" | "tester";

export interface SubagentToolInput {
  agent: string;
  task: string;
}

export interface AgentDefinition {
  name: string;
  description: string;
  readonly: boolean;
  tools: string[];
  prompt: string;
  source: "builtin" | "user" | "project";
  filePath: string;
}

export interface SubagentsConfig {
  enabled: boolean;
  maxSubagentDepth: 1;
  timeoutMs: number;
  allowWriteSubagents: boolean;
  subagents: Record<string, { enabled: boolean; readonly: boolean }>;
}

export type SubagentResult = SubagentSuccessResult | SubagentErrorResult;
```

2. 新增 `src/config/load-config.ts`：
   - 读取 `~/.pi/agent/extensions/subagent/config.json`。
   - 失败时返回默认配置。
   - 第一版只接受 MVP 字段。
3. 固定默认值：

```ts
{
  enabled: true,
  maxSubagentDepth: 1,
  timeoutMs: 120000,
  allowWriteSubagents: false
}
```

4. 删除旧类型中的以下概念：
   - async job/status
   - progress watcher
   - chain/parallel mode
   - intercom payload
   - control events
   - worktree/fork context
   - artifact tree
   - model fallback attempts

### 注意事项

- 当前 `DEFAULT_SUBAGENT_MAX_DEPTH` 是 `2`，必须改为 `1` 或不再使用旧常量。
- 当前错误结果依赖 `AgentToolResult<Details>`，简化后仍可返回 pi tool result，但 `details` 应只包含 `SubagentResult` 或最小对象。

### 验收标准

- `src/shared/types.ts` 中不再出现 `AsyncStatus`、`SubagentRunMode = "parallel" | "chain"`、`Intercom`、`Worktree` 等 MVP 外类型。
- 配置加载单测覆盖：默认配置、非法 JSON、局部覆盖、disabled agent。

---

## Phase 2：重建 agent 定义与加载

### 目标

将内置 agents 收敛为 5 个 markdown 文件，并让加载逻辑简单可测。

### 目标 agents

```text
agents/
├─ explorer.md
├─ researcher.md
├─ reviewer.md
├─ implementer.md
└─ tester.md
```

### 当前代码约束

`src/agents/frontmatter.ts` 只支持：

```md
---
name: explorer
description: Read-only codebase navigator.
readonly: true
tools: read, grep, find, ls
---
```

它不支持真正 YAML 列表：

```yaml
tools:
  - read
  - grep
```

因此本 Phase 二选一：

- 推荐 MVP：继续使用简单 parser，文档和 agents 全部使用逗号格式。
- 可选增强：重写 parser 支持基本 YAML array，但不要引入重型依赖。

### 主要任务

1. 删除旧内置 agents：

```text
agents/context-builder.md
agents/delegate.md
agents/oracle.md
agents/planner.md
agents/scout.md
agents/worker.md
```

2. 改写/保留：

```text
agents/researcher.md
agents/reviewer.md
```

3. 新增：

```text
agents/explorer.md
agents/implementer.md
agents/tester.md
```

4. 每个 agent 必须包含：

```text
readonly: true
```

5. 每个 agent prompt 必须包含边界约束：
   - 是 child subagent，不是主代理。
   - 只处理 delegated task。
   - 不调用、不建议额外 subagents。
   - 不扩大范围。
   - 信息不足时明确说明 uncertainty/blocked reason。

6. 重写 `src/agents/load-agents.ts` 或裁剪 `src/agents/agents.ts`：
   - 加载 builtins。
   - 可选加载 user/project agents。
   - 校验 name/description。
   - 校验 name 唯一。
   - 应用 enabled/readonly 配置。
   - 不加载 chains。
   - 不处理 management overrides。

### 验收标准

- `discover/loadAgents` 只返回 enabled agents。
- 内置 agents 只有 5 个。
- unknown agent 进入稳定错误 `UNKNOWN_AGENT`。
- frontmatter 单测覆盖逗号工具列表与 readonly。

---

## Phase 3：重写扩展入口与最小 `subagent` schema

### 目标

把 `src/extension/index.ts` 从大型 orchestrator 入口重写为最小 tool 注册入口。

### 当前入口问题

当前 `src/extension/index.ts` 直接 import 并启动了很多旧能力：

- `createResultWatcher`
- `createAsyncJobTracker`
- `registerSlashCommands`
- `registerPromptTemplateDelegationBridge`
- `registerSlashSubagentBridge`
- `registerSubagentNotify`
- TUI renderers
- control notice renderers
- artifact cleanup
- chain cleanup

这些都必须从入口移除，否则即使删除 schema，旧能力仍会启动。

### 主要任务

1. 重写 `src/extension/schemas.ts`：

```ts
import { Type } from "typebox";

export const SubagentParams = Type.Object({
  agent: Type.String({ minLength: 1 }),
  task: Type.String({ minLength: 1 })
}, { additionalProperties: false });
```

2. 重写 `src/extension/index.ts`：
   - 保留默认导出 `registerSubagentExtension(pi)`。
   - 如果 `PI_SUBAGENT_CHILD === "1"`，直接 return，防止子代理注册 `subagent`。
   - 加载 config。
   - 注册一个 tool：`subagent`。
   - 不注册 message renderer。
   - 不注册 slash command。
   - 不注册 async watcher。
   - 不注册 TUI widget。

3. 新增 `src/extension/register-tool.ts`，让入口更小。

4. 工具描述只说明 5 个 agents 和使用边界。

### 验收标准

- `rg "registerSlash|registerMessageRenderer|ResultWatcher|AsyncJob|renderWidget" src/extension` 无命中。
- `SubagentParams` 不包含 `action`、`tasks`、`chain`、`async`、`worktree`、`model`。
- 子进程因 `PI_SUBAGENT_CHILD=1` 不注册该扩展。

---

## Phase 4：实现 foreground single runtime

### 目标

保留“启动一个 child pi，等待完成，收集最终输出”的核心路径，但删除并行、链式、异步、intercom、artifact、fallback model 等分支。

### 可复用代码

优先从以下文件抽取/裁剪，而不是重写所有细节：

```text
src/runs/foreground/execution.ts    # runSync + stdout JSON 解析 + usage + final output
src/runs/shared/pi-args.ts          # buildPiArgs + PI_SUBAGENT_CHILD env
src/runs/shared/pi-spawn.ts         # Windows/pi CLI spawn 兼容
src/runs/shared/subagent-prompt-runtime.ts # child boundary + strip parent subagent messages
src/shared/post-exit-stdio-guard.ts # 子进程退出保护，可保留
```

### 建议新文件

```text
src/runtime/run-subagent.ts
src/runtime/spawn-pi.ts
src/runtime/build-prompt.ts
src/runtime/collect-output.ts
src/runtime/sanitize.ts
```

如果选择复用旧文件，也可以保留旧路径，但必须保证文件内容已经裁剪到 MVP。

### 最小运行流程

```text
validate input
→ load config
→ check enabled/depth
→ load selected agent
→ build child prompt
→ spawn pi --mode json -p
→ collect JSON stdout messages
→ extract final assistant text
→ sanitize
→ return SubagentResult
```

### 必删分支

从执行路径中删除：

- `runParallelPath`
- `runChainPath`
- `runAsyncPath`
- `resumeAsyncRun`
- `interrupt/status`
- `clarify` TUI
- `fork context`
- `intercom bridge`
- `worktree`
- `output file instructions`
- `artifact tree`
- `model fallback`
- `skills injection`（第一版建议不支持）

### Timeout

当前 `runSync` 主要依赖 `AbortSignal`，没有独立 timeout 配置。简化版必须在 tool handler 或 runtime 中实现：

```text
AbortController + setTimeout(config.timeoutMs)
```

超时返回：

```json
{
  "ok": false,
  "error": { "code": "SUBAGENT_TIMEOUT", "message": "Subagent timed out." }
}
```

### 验收标准

- `subagent({ agent: "explorer", task: "..." })` 可以完成一次 foreground 调用。
- timeout 会终止 child pi。
- child 失败不会抛未处理异常，而是返回 `ok:false`。
- 执行路径中没有 chain/parallel/background 分支。

---

## Phase 5：递归保护、readonly 与 sanitize

### 目标

保证默认安全，尤其是防止递归和敏感信息泄漏。

### 递归保护

当前代码已有：

- `PI_SUBAGENT_CHILD`
- `PI_SUBAGENT_DEPTH`
- `PI_SUBAGENT_MAX_DEPTH`
- `checkSubagentDepth()`
- `getSubagentDepthEnv()`

但默认深度当前是 2。简化版要求：

```text
maxSubagentDepth = 1
```

执行策略：

1. 父进程 tool handler 调用前检查 depth。
2. child spawn env 设置：

```text
PI_SUBAGENT_CHILD=1
PI_SUBAGENT_DEPTH=1
PI_SUBAGENT_MAX_DEPTH=1
```

3. extension entry 遇到 `PI_SUBAGENT_CHILD=1` 直接 return。
4. `subagent-prompt-runtime.ts` 继续注入 child boundary，并过滤父会话里的 subagent tool call/result。

### Readonly

第一版策略：

- 全部 builtins 默认 `readonly: true`。
- `allowWriteSubagents: false` 时，即使 agent frontmatter 写了写工具，也要过滤掉 mutating tools。
- readonly agent 的 tools 只能包含安全工具。

建议只允许：

```text
read, grep, find, ls, bash, web_search, fetch_content, get_search_content
```

其中 `bash` 只能通过 prompt 约束“read-only inspection commands”，无法技术上完全限制。若要更安全，第一版可先不给 readonly agent `bash`。

### Sanitize

新增 `src/runtime/sanitize.ts`，清理：

- API key/token 常见格式
- `Authorization:` header
- `.env` dump
- 完整 stack trace
- 绝对路径前缀
- 完整 system prompt

### 稳定错误码

只允许以下错误码进入结果：

```text
INVALID_INPUT
SUBAGENTS_DISABLED
UNKNOWN_AGENT
SUBAGENT_DISABLED
SUBAGENT_DEPTH_EXCEEDED
SUBAGENT_TIMEOUT
SUBAGENT_FAILED
SUBAGENT_OUTPUT_TRUNCATED
```

### 验收标准

- 子代理中不能看到 `subagent` 工具。
- depth 超限返回 `SUBAGENT_DEPTH_EXCEEDED`。
- 模拟 token/header/stack trace 会被清理。
- readonly agent 不会获得 `edit`、`write` 等写工具。

---

## Phase 6：删除高级模块并修复包元数据

### 目标

不是“隐藏”高级功能，而是移除维护面。

### 删除目录

```text
src/runs/background/
src/intercom/
src/slash/
src/tui/
prompts/
```

`prompts/` 当前全部是 parallel/chain 相关模板，MVP 不需要。

### 删除或裁剪文件

```text
src/runs/foreground/chain-clarify.ts
src/runs/foreground/chain-execution.ts
src/runs/shared/parallel-utils.ts
src/runs/shared/model-fallback.ts
src/runs/shared/worktree.ts
src/shared/fork-context.ts
src/shared/artifacts.ts
src/shared/jsonl-writer.ts
src/shared/model-info.ts
src/shared/session-tokens.ts
src/shared/status-format.ts
src/agents/chain-serializer.ts
src/agents/agent-management.ts
```

### 更新 `package.json`

当前 package 描述仍是：

```text
Pi extension for delegating tasks to subagents with chains, parallel execution, and TUI clarification
```

必须改为轻量定位。

同时检查依赖：

- `typebox` 可保留，用于 tool schema。
- `@mariozechner/pi-tui` 如果不再使用，应从 peer/dev dependencies 移除。
- `prompts/**/*` 应从 `files` 与 `pi.prompts` 移除。
- `skills` 是否保留要单独决定；MVP 不依赖 `pi-subagents` skill 可删除。

### 验收标准

- `rg "chain|parallel|background|intercom|worktree|slash|tui" src` 不命中可执行路径。少量文档字符串或测试 fixture 也应尽量清理。
- `pnpm test` 使用新测试集通过。
- package 描述、files、pi 配置与 MVP 一致。

---

## Phase 7：测试重组

### 目标

删除旧平台能力测试，建立 MVP 测试矩阵。

### 当前测试中应删除/改写的类别

```text
test/integration/async-*.test.ts
test/integration/chain-*.test.ts
test/integration/parallel-*.test.ts
test/integration/intercom-*.test.ts
test/integration/fork-context-*.test.ts
test/integration/render-*.test.ts
test/integration/slash-*.test.ts
test/integration/result-watcher.test.ts
test/integration/top-level-async.test.ts

test/unit/async-*.test.ts
test/unit/chain-*.test.ts
test/unit/intercom-*.test.ts
test/unit/model-fallback.test.ts
test/unit/parallel-utils.test.ts
test/unit/render-*.test.ts
test/unit/slash-*.test.ts
test/unit/worktree.test.ts
test/unit/status-format.test.ts
test/unit/session-tokens.test.ts
```

### 新测试建议

```text
test/unit/frontmatter.test.ts
test/unit/load-agents.test.ts
test/unit/load-config.test.ts
test/unit/subagent-tool-schema.test.ts
test/unit/recursion-guard.test.ts
test/unit/readonly-tools.test.ts
test/unit/sanitize.test.ts
test/unit/result-schema.test.ts

test/integration/subagent-foreground.test.ts
test/integration/subagent-unknown-agent.test.ts
test/integration/subagent-depth.test.ts
test/integration/subagent-timeout.test.ts
test/integration/subagent-sanitize.test.ts
```

### 测试辅助

当前已有：

```text
test/support/mock-pi.ts
test/support/mock-pi-script.mjs
test/support/register-loader.mjs
test/support/ts-loader.mjs
```

可以继续复用，但要删除 async/chain/parallel 特定 mock 行为。

### 验收标准

- `pnpm test:unit` 通过。
- `pnpm test:integration` 通过。
- 测试不再依赖 TUI、slash、async watcher、intercom、worktree。

---

## Phase 8：README、参考文档与安装器更新

### 目标

让用户看到的能力与代码一致。

### 必改文件

```text
README.md
CHANGELOG.md
install.mjs
docs/README.md
docs/reference/subagent-tool.md
docs/reference/agent-definition.md
docs/reference/configuration.md
docs/reference/result-schema.md
```

### 注意事项

- `install.mjs` 当前文案仍是 “Delegate tasks to agents and inspect run status”，需要移除 status/management 暗示。
- README 不应再提 chain、parallel、async、TUI clarification。
- agent definition 文档要使用当前 parser 可接受的逗号 frontmatter，除非 Phase 2 已实现 YAML array parser。

### 验收标准

- README 示例只有：

```ts
subagent({ agent: "explorer", task: "Find where auth is implemented" })
```

- 文档明确第一版不支持：background、chain、parallel、intercom、worktree、slash workflow、TUI widget。

---

## Phase 9：最终验证与发布准备

### 功能验证

- [ ] 主代理能看到 `subagent` 工具。
- [ ] tool schema 只接受 `agent` 和 `task`。
- [ ] 5 个内置 agents 都能加载。
- [ ] `explorer` foreground 调用成功。
- [ ] unknown agent 返回 `UNKNOWN_AGENT`。
- [ ] timeout 返回 `SUBAGENT_TIMEOUT`。
- [ ] disabled config 生效。

### 边界验证

- [ ] 子代理 session 不注册 `subagent` 工具。
- [ ] 子代理 prompt 包含 child boundary。
- [ ] 不存在可执行的 chain 路径。
- [ ] 不存在可执行的 parallel 路径。
- [ ] 不存在可执行的 background 路径。
- [ ] 不存在 intercom/worktree/slash/TUI 入口。

### 安全验证

- [ ] 默认 readonly。
- [ ] readonly agent 不包含 `edit`/`write` 工具。
- [ ] token/header 被 sanitize。
- [ ] stack trace 被压缩。
- [ ] 绝对路径不直接暴露给主代理结果。

### 维护验证

- [ ] `pnpm test:all` 通过。
- [ ] `package.json` 元数据准确。
- [ ] docs 与代码一致。
- [ ] `rg` 检查无旧功能入口残留。

---

## 推荐提交顺序

1. `docs: audit current code and update simplification plan`
2. `refactor: replace shared types and config with mvp model`
3. `refactor: replace builtin agents with five readonly agents`
4. `feat: register minimal subagent tool`
5. `feat: add foreground single subagent runtime`
6. `feat: add depth guard readonly tools and sanitizer`
7. `refactor: remove orchestration modules`
8. `test: replace legacy tests with mvp tests`
9. `docs: update readme and references for simple subagents`
10. `chore: update package metadata and installer text`

---

## 非目标清单

MVP 中不要实现：

- agent management actions（create/update/delete）
- `/subagents` 命令（包括所有 slash bridge、slash live state、TUI 渲染）
- `bash` 工具在 readonly agents 中
- `skills` 目录 / skills 注入
- `implementer` / `tester` 写文件能力
- background jobs
- async status/resume/interrupt
- chain workflow
- parallel tasks
- intercom/contact_supervisor
- worktree/fork context
- artifact tree
- complex session/artifact 管理（metadata、progress file、watcher、cleanup manager）
- per-agent model override
- fallback model chain
- TUI clarification UI
- output file workflow

未来如果恢复任何能力，必须新增 ADR，并说明为什么它值得增加维护成本。
