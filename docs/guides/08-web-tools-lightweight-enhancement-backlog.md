---
status: proposed
audience: maintainer
last_verified: 2026-05-08
---

# 内置 Web Tools 轻量增强清单（P0/P1/P2）

本文用于在不突破 `pi-subagents` 轻量边界的前提下，迭代 `web_search` / `fetch_content` / `get_search_content`。

约束：

- 保持 readonly
- 不引入 curator UI / browser cookie / 视频 / PDF / GitHub clone
- 不引入复杂多 provider 编排（当前以 brave-only 为主）
- 优先小步可验证改动

---

## P0（应优先完成）

目标：修复稳定性与可用性短板，不扩大能力边界。

### 1) 会话级存储恢复 + TTL

- 参考点：`pi-web-access-src/storage.ts` 的 `restoreFromSession` 与 TTL
- 建议实现：
  - `web_search` / `fetch_content` 调用后追加 session entry
  - extension 启动时恢复近 1 小时 `responseId` 缓存
  - 过期条目自动忽略
- 验收：
  - 重启同一会话后 `get_search_content` 仍可读取最近结果
  - 过期条目返回明确 `NOT_FOUND`

### 2) `get_search_content` 错误提示增强

- 建议实现：
  - query/url 不存在时给出可选项列表
  - index 越界时给出有效范围
  - 缺 selector 时给出使用示例
- 验收：
  - 错误信息可直接指导下一次正确调用

### 3) includeContent 并发限制

- 参考点：`p-limit`（可不引依赖，手写小并发池）
- 建议实现：
  - `includeContent` 抓取并发限制为 2~3
- 验收：
  - 多结果抓取时间显著优于串行
  - 不出现明显请求风暴

---

## P1（推荐后续完成）

目标：提升内容提取命中率与错误可诊断性。

### 1) HTML 提取链路增强（轻量版）

- 参考点：`pi-web-access-src/extract.ts`（Readability + fallback 思路）
- 建议实现（按顺序）：
  1. 当前基础 HTML->text
  2. 增加 Readability 提取（仅 HTML）
  3. 失败时可选 Jina Reader fallback（开关控制）
- 验收：
  - JS-heavy 页面可读内容命中率提升
  - fallback 失败时仍返回结构化错误

### 2) 搜索错误分类与引导

- 参考点：`gemini-search.ts` 错误聚合表达
- 建议实现：
  - 区分：鉴权错误、限流、超时、网络错误、provider 响应异常
  - 输出明确“下一步操作”提示（如检查 `BRAVE_SEARCH_API_KEY`）
- 验收：
  - 常见失败原因可在一次响应中定位

### 3) Abort/Timeout 统一模型

- 建议实现：
  - 内部统一使用 `AbortSignal.any([timeout, parentSignal])`
  - 减少多层超时处理分支
- 验收：
  - 超时/取消行为一致，错误码稳定

---

## P2（可选优化）

目标：在保持边界前提下优化工程质量。

### 1) 结果大小与内存治理

- 建议实现：
  - 为存储 Map 增加最大条目数（LRU 或 FIFO）
  - 单条记录存储上限（防止极端页面占满内存）
- 验收：
  - 长会话内存占用可控

### 2) 更细粒度 SSRF 防护

- 建议实现：
  - 明确拒绝 IPv6 bracket/address 变体与非常规 localhost 表达
  - 重定向链每一跳严格复验
- 验收：
  - SSRF 绕过用例覆盖率提升

### 3) 可观测性（最小化）

- 建议实现：
  - 为 web tools 增加轻量 debug 日志开关（默认关闭）
  - 记录 provider 延迟、命中率、错误类型统计（会话内）
- 验收：
  - 排障效率提升，不影响默认输出简洁性

---

## 实施顺序建议

1. 先做 P0（稳定性/可用性）
2. 再做 P1（提取质量/诊断）
3. 最后按需做 P2（治理/可观测）

每个子项建议独立 PR，附：

- 对应测试
- 文档更新
- 边界说明（明确“未引入完整 pi-web-access 能力”）
