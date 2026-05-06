# 架构总览

## 简化后模块

```text
src/
├─ extension/      # pi 扩展入口、工具注册、可选命令
├─ agents/         # agent 加载、frontmatter 解析、内置 agent
├─ runtime/        # 构造 prompt、启动 pi、收集输出、sanitize
├─ config/         # 配置加载与默认值
└─ shared/         # 类型、路径、通用工具
```

## 核心调用链

```text
主代理
  ↓ 调用 tool: subagent({ agent, task })
工具处理器
  ↓ 校验 agent/task/config/depth
加载 agent 定义
  ↓ 构造 child prompt
启动 foreground child pi session
  ↓ 收集输出
sanitize + normalize result
  ↓
返回给主代理
```

## 设计边界

- 主代理是唯一 orchestrator。
- `subagent` 工具每次只启动一个子代理。
- 子代理 session 不注册 `subagent` 工具。
- 工具内部不实现 chain、parallel 或 workflow engine。
