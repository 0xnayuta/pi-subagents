---
status: proposed
audience: maintainer
last_verified: 2026-05-09
---

# 推迟合并 pi-lsp 的综合扩展计划

## 结论

`../pi-lsp` 可以合并进当前项目，而且在“个人使用、个人维护、希望形成一个综合 pi 扩展包”的前提下，合并是合理的。

但该工作 **不应立即开始**。当前项目仍需要先解决已有实现、文档、边界和测试问题。合并 LSP 会显著扩大项目目标、依赖、运行时状态和故障面；如果在现有问题未清理前直接合并，后续会更难判断问题来自 subagent、web tools、LSP hook、LSP server，还是 pi runtime 集成。

因此建议：

> 暂缓合并 `pi-lsp`。先完成当前项目的稳定化和文档同步，再以一次明确的项目定位升级来引入 LSP。

## 背景

当前 `pi-subagents` 的原始定位是轻量 subagent 扩展：

```text
1 个主代理
+ 1 个 subagent 工具
+ 5 个内置子代理
+ foreground 单次执行
+ maxDepth = 1
+ 默认 readonly
```

`pi-lsp` 则是另一类能力，包含：

- LSP tool：definition、references、hover、symbols、diagnostics、rename、codeAction 等。
- LSP hook：在 `agent_end` 或 `edit/write` 后自动诊断。
- 长生命周期语言服务器管理。
- 多语言 server 发现、启动、复用、关闭。
- 文件打开状态、诊断缓存、LRU、idle shutdown 等运行时状态。

如果项目目标扩大为个人综合 pi coding suite，那么二者可以组合为：

- subagents：任务委派与专职分析。
- web tools：搜索、网页内容获取、研究能力。
- LSP：代码智能、诊断和符号级导航。
- hooks / commands：自动反馈与开发者辅助命令。

## 为什么现在需要推迟

### 1. 当前项目边界文档仍以轻量 MVP 为 source of truth

现有文档仍明确强调轻量化、单一执行路径、readonly、非多代理框架。直接合并 LSP 会与这些文档冲突。

在合并前，需要先决定并记录：

- 项目是否正式从 `pi-subagents` 转向综合扩展包。
- 是否继续保留 `pi-subagents` 包名。
- 哪些旧边界继续有效，哪些边界废弃。
- LSP 在主代理和子代理中的权限模型。
- LSP hook 是否默认启用。

### 2. LSP 会引入新的依赖和运行时故障面

`pi-lsp` 至少会引入：

- `vscode-jsonrpc`
- `vscode-languageserver-protocol`
- 各语言服务器的外部安装要求，如 `typescript-language-server`、`pyright`、`gopls`、`rust-analyzer`、`clangd` 等。

这会让问题排查从“subagent 执行失败”扩大到：

- PATH 中找不到语言服务器。
- LSP server 启动慢或崩溃。
- 项目根目录识别错误。
- 诊断协议差异。
- C/C++ 缺少 `compile_commands.json`。
- Hook 自动诊断产生噪声。

当前项目应先稳定已有 subagent/web tools 行为，再引入这类复杂状态。

### 3. 子代理进程中的工具注册策略需要重新设计

当前项目通过 `PI_SUBAGENT_CHILD` 防止子代理再次注册 `subagent` 工具，从而避免递归委派。

合并后需要明确：

| 能力 | 主代理进程 | 子代理进程 | 建议 |
|---|---:|---:|---|
| web tools | 是 | 是 | 保留 |
| lsp tool | 是 | 是 | 允许 readonly 查询 |
| lsp hook | 可配置 | 否 | 子进程禁用 |
| subagent tool | 是 | 否 | 继续禁止递归 |
| developer commands | 是 | 可选/否 | 默认只在主进程 |

这需要调整扩展入口，而不是简单复制 `lsp.ts`、`lsp-tool.ts`。

### 4. readonly 语义需要扩展

合并 LSP 后，readonly agent 不再只是 `read/grep/find/ls`，还可能使用：

- `lsp.definition`
- `lsp.references`
- `lsp.hover`
- `lsp.signature`
- `lsp.symbols`
- `lsp.diagnostics`
- `lsp.workspace-diagnostics`

这些应被视为 readonly-safe。

但以下 action 应谨慎处理：

- `rename`
- `codeAction`
- `restart`

即使它们不一定直接写文件，也可能表示重构意图或影响全局 LSP 状态。合并前应设计配置开关和子代理权限边界。

## 推荐的最终方向

如果后续决定继续推进，建议把当前项目升级为一个模块化 single-package pi coding suite，而不是把两个项目机械拼接。

推荐原则：

1. 个人工作流优先。
2. 模块化，不做复杂框架化。
3. 默认安全，强能力显式开启。
4. 主代理仍然是唯一 orchestrator。
5. 子代理不允许调用其他子代理。
6. LSP 是代码智能层，不是 agent orchestration 层。
7. 重型功能可配置关闭。

推荐模块结构：

```text
src/
├─ extension/
│  └─ index.ts              # 统一入口，只负责组合模块
├─ subagents/
│  ├─ index.ts              # registerSubagentsModule()
│  ├─ agents/
│  ├─ runtime/
│  └─ schemas.ts
├─ lsp/
│  ├─ index.ts              # registerLspModule()
│  ├─ core.ts
│  ├─ tool.ts
│  ├─ hook.ts
│  ├─ config.ts
│  └─ schemas.ts
├─ web/
│  ├─ index.ts
│  └─ providers/
└─ shared/
   ├─ types.ts
   ├─ config.ts
   └─ errors.ts
```

推荐使用单一 pi extension 入口：

```json
{
  "pi": {
    "extensions": [
      "./src/extension/index.ts"
    ]
  }
}
```

由入口统一根据配置注册：

```ts
registerWebModule(pi, config.web);
registerLspTool(pi, config.lsp.tool);

if (!isSubagentChild) {
  registerLspHook(pi, config.lsp.hook);
  registerSubagentsModule(pi, config.subagents);
  registerDeveloperCommands(pi, config);
}
```

## 推荐默认策略

| 模块/能力 | 建议默认值 |
|---|---|
| subagents | enabled |
| web tools | enabled |
| lsp tool | enabled |
| lsp hook | disabled 或 opt-in `agent_end` |
| lsp in subagents | enabled for readonly-safe actions |
| subagent in subagents | disabled |
| write subagents | disabled |
| rename/codeAction | 主代理可配置开启，子代理默认禁用 |
| restart | 主代理可配置开启，子代理默认禁用 |

## 合并前置条件

在开始实际合并前，建议先完成以下事项。

### 必须完成

- [ ] 修复当前项目已知的类型检查、测试或文档同步问题。
- [ ] 确认 `pnpm typecheck`、`pnpm test`、`pnpm docs:check` 的目标状态。
- [ ] 更新 `docs/guides/goals-and-scope.md`，说明项目是否将从轻量 subagent 扩展升级为综合扩展包。
- [ ] 新增 ADR，正式记录项目目标扩大和 LSP 合并决策。
- [ ] 明确是否保留 `pi-subagents` 包名，或改名为更通用的 suite 名称。
- [ ] 设计统一配置 namespace：`subagents` / `web` / `lsp`。
- [ ] 明确主进程与子代理进程的工具注册矩阵。

### 建议完成

- [ ] 梳理当前 README 与 docs 中已过期的 MVP 描述。
- [ ] 为 web tools、subagent runtime、commands 建立更清晰的模块边界。
- [ ] 为 LSP tool 和 hook 准备独立测试入口。
- [ ] 准备一个小型 TypeScript fixture 项目用于 LSP smoke test。
- [ ] 在内置 agent prompt 中预留 “if lsp tool is available” 的使用规则。

## 建议实施阶段

### 阶段 0：暂缓，不改代码

仅保留本计划文档，继续修复当前项目问题。

### 阶段 1：决策与文档同步

- 新增 ADR。
- 更新目标与范围文档。
- 更新 README / README.zh.md。
- 明确配置和权限模型。

### 阶段 2：迁入 LSP tool，不启用 hook

- 将 `../pi-lsp/lsp-core.ts`、`lsp-tool.ts` 迁入 `src/lsp/`。
- 改造成 `registerLspTool()`。
- 先只注册按需 `lsp` 工具。
- 验证主代理和子代理都能使用 readonly-safe LSP 查询。

### 阶段 3：迁入 LSP hook，默认关闭

- 将 `lsp.ts` 改造成 `registerLspHook()`。
- 仅在主代理进程注册 hook。
- 默认关闭，或仅通过配置开启 `agent_end`。

### 阶段 4：模块化整理

- 将 subagent 相关代码逐步迁入 `src/subagents/`。
- 统一配置加载。
- 统一错误码和 diagnostics 输出风格。
- 更新测试和文档索引。

## 当前决策

当前不启动合并工作。

本项目先继续保持现有轻量 subagent + web tools 形态。`pi-lsp` 合并应作为后续一次明确的 scope expansion 处理，并在前置问题解决后再开始。
