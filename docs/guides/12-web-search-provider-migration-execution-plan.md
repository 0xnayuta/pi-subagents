---
status: proposed
audience: maintainer
last_verified: 2026-05-08
---

# Web Search Provider 抽象迁移执行计划

本文是对《[Web Search 最小 Provider 接口与配置 Schema 设计](./11-web-search-provider-interface-and-schema.md)》的落地执行计划。

目标：

- 在不破坏当前可用性的前提下，把 `web_search` 从单 provider（brave）迁移为最小 provider 抽象
- 逐步引入 `ddgs`、`openserp`、`searxng`、`tavily`、`serper`
- 维持当前安全边界与测试通过率

---

## 1. 范围与约束

### 1.1 本计划包含

- provider 抽象接口
- provider 选择器（explicit + auto）
- 配置 schema 扩展
- 分阶段 provider 接入
- 测试与文档同步

### 1.2 本计划不包含

- curator UI
- 多 provider 并行聚合
- 后台异步任务
- 非 readonly 行为

---

## 2. 分阶段执行

## Phase 0：准备与基线锁定（0.5 天）

### 任务

1. 锁定当前基线行为（brave-only）
2. 记录关键回归命令
3. 补齐现有 web_search 行为断言（如尚有空白）

### 产出

- 基线测试报告（本地）
- 风险清单（简版）

### 验收

- `pnpm test:unit` / `pnpm test:mvp` / `pnpm lint` / `pnpm typecheck` 全通过

---

## Phase A：抽象层落地（无行为变化）（1~1.5 天）

### 任务

1. 新增 provider 类型与接口文件（建议）：
   - `src/web/providers/types.ts`
   - `src/web/providers/registry.ts`
   - `src/web/providers/select-provider.ts`
2. 将现有 brave 逻辑迁入 adapter：
   - `src/web/providers/brave.ts`
3. `src/web/search.ts` 改为调用 provider adapter，但默认仍只启用 brave
4. 保留现有错误码分类与 observability

### 受影响文件

- `src/web/search.ts`
- `src/web/providers/*`
- 可能包含：`src/web/types.ts`（少量类型抽取）

### 验收

- 对外行为不变（旧测试基本不改）
- 回归全通过

---

## Phase B：零配置兜底（ddgs）（1 天）

### 任务

1. 新增 `ddgs` adapter：
   - `src/web/providers/ddgs.ts`
2. 支持 `provider=auto` 的降级链（先 brave，后 ddgs）
3. 对 `ddgs` 结果做统一归一化
4. 对网络错误/限流做最小分类映射

### 配置变更

- 增加 `webTools.provider = "auto"` 支持（默认建议仍谨慎）
- 增加 `webTools.providerPriority`（可选）

### 验收

- 无 key 时 auto 能走 ddgs 并返回结果
- 显式 `provider: "brave"` 行为不变

---

## Phase C：开放/自托管 provider（openserp + searxng）（1.5~2 天）

### 任务

1. 新增 adapter：
   - `src/web/providers/openserp.ts`
   - `src/web/providers/searxng.ts`
2. 加入 endpoint 可用性检查（轻量）
3. 支持 provider 子配置：baseUrl/apiKeyEnv/defaultEngine
4. 扩展 auto 优先级逻辑

### 验收

- 显式 provider 调用成功
- endpoint 不可达时返回可诊断错误
- auto 能正确跳过 unavailable provider

---

## Phase D：商业增强（tavily + serper）（1~1.5 天）

### 任务

1. 新增 adapter：
   - `src/web/providers/tavily.ts`
   - `src/web/providers/serper.ts`
2. 增加 key 缺失、401/403、429 分类映射
3. 补齐 observability 统计维度（provider 粒度）

### 验收

- key 存在时商业 provider 可用
- key 缺失不影响 auto 继续降级
- 错误分类稳定

---

## 3. 配置迁移计划

### 3.1 新增字段（渐进）

- `webTools.provider`: `"auto" | "ddgs" | "openserp" | "searxng" | "tavily" | "serper" | "brave"`
- `webTools.providerPriority`: `string[]`
- `webTools.ddgs.*`
- `webTools.openserp.*`
- `webTools.searxng.*`
- `webTools.tavily.*`
- `webTools.serper.*`
- `webTools.brave.*`

### 3.2 兼容策略

- 老配置 `provider: "brave"` 必须继续可用
- 未配置新字段时使用默认值
- `provider` 非法值 fallback 到安全默认（建议 `auto` 或 `brave`）

---

## 4. 测试计划

## 4.1 单元测试新增点

1. provider 选择器
   - explicit provider
   - auto 顺序
   - unavailable 跳过
2. 各 adapter 响应归一化
3. 错误分类映射
4. auto 降级链路

### 4.2 现有测试回归

- `test/unit/web-search.test.ts`
- `test/unit/web-storage.test.ts`
- `test/unit/web-registration.test.ts`
- `test/mvp/unit/*.test.ts`

### 4.3 验证命令（每阶段必跑）

```bash
pnpm test:unit
pnpm test:mvp
pnpm lint
pnpm typecheck
pnpm docs:check
```

---

## 5. 文档更新清单

每阶段完成后更新：

- `docs/reference/configuration.md`（字段与默认值）
- `docs/reference/web-tools-error-codes.md`（新增/变更错误语义）
- `docs/guides/10-web-search-acceptance-checklist.md`（新增 provider 验收项）
- `README.md`（如默认行为变更）

---

## 6. 风险与回滚

### 6.1 主要风险

1. provider 增长导致复杂度上升
2. 免费 provider 可用性波动
3. auto 逻辑导致问题定位变难

### 6.2 控制措施

- 每阶段单独 PR，避免大爆炸
- 默认保留 brave 路径可回退
- debug 日志保留 provider 选择轨迹

### 6.3 回滚策略

- 快速回滚到 Phase A（brave adapter only）
- 保留 `provider: "brave"` 作为稳定开关

---

## 7. 里程碑与完成定义

### M1（Phase A 完成）

- provider 抽象层上线，行为无变化

### M2（Phase B 完成）

- auto + ddgs 兜底可用

### M3（Phase C 完成）

- openserp / searxng 接入完成

### M4（Phase D 完成）

- tavily / serper 接入完成，错误分类稳定

### Done 定义

- 里程碑对应功能、测试、文档全部到位
- 五项命令全通过
- 无高优先级回归缺陷
