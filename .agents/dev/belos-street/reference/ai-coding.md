---
name: ai-coding
description: AI 增强开发工作流：使用边界、工具原理、上下文工程（完整且最小）、产物验收三关（typecheck/lint/test）、常见反模式、AI review（code-review-dimensions 模板 + 人工复核红线）、多 Agent 协作流水线。用 AI 写码/AI review/搭 AI 工作流时调用。
---

# AI Coding（AI 增强开发工作流）

个人编码习惯 - 用 Agent 写代码的实战工作流

> **边界**：本文件管「怎么把 Agent 工具和工作流用对」；[llm-coding-guidelines](llm-coding-guidelines.md) 管「生成代码的行为准则」（Karpathy 教训：不过度设计、不做无关改动、不静默假设）。两者互补不重叠——本文是流程与工具，那篇是行为规范。

## 1. 使用边界

| 场景 | 适合度 | 说明 |
|------|--------|------|
| 生成骨架 / CRUD / 样板代码 | 高 | AI 输出框架，人来填业务细节 |
| 重构 / 迁移 | 高 | 机械变换交给 AI，行为不变由测试兜底 |
| 解释陌生代码 / 文档 | 高 | 提问式学习，快速建立全局感 |
| 写测试 | 高 | 补用例与边界，自己确认覆盖点 |
| Code Review | 中高 | 拿 [code-review-dimensions](code-review-dimensions.md) 当模板走查（见 §6） |
| 关键业务逻辑（并发 / 支付 / 复杂异步） | 低 | 人主导，AI 只辅助出草稿、出方案 |

**AI 是协作者不是替代者**：AI 负责提速，你负责意图、验收与最终判断。不 review 不信任，不验证不提交。

## 2. 工具与原理

IDE 内助手与 Agent CLI 的共性架构（了解原理才能对症下药）：

- **检索与上下文构建**：Agent 靠项目文件 / 索引 / 你贴的上下文理解代码库；上下文给全，正确率才高（见 §3）
- **权限沙箱**：文件读写 / 命令执行都在受控权限内，危险操作有审计
- **工具调用**：读写文件、跑命令、搜索代码都以工具形式暴露，工具边界 ≈ Agent 能力边界
- **MCP 集成**：统一协议挂外部数据源（数据库 / API / 文档）——本 skill-kit 即挂载了多个 MCP 服务

主流工具一句话定位（不吹不黑，不写版本断言）：

| 工具形态 | 定位 |
|----------|------|
| IDE 内助手（Copilot / Cursor / Trae 等） | 跟在光标旁，贴着代码上下文做补全 / 对话，适合边写边改 |
| Agent CLI（Claude Code / Codex 等） | 终端里独立执行多步任务，能自主跑命令做验收，适合「拆任务 → 执行 → 验证」式工作流 |

选型看习惯；差异主要在上下文管理、工具集与权限模型，不在宣传话术。

## 3. 上下文工程（喂给 Agent 的上下文：完整且最小）

原则：**完整且最小**——够它做对，又不淹没重点。

| 类别 | 给什么 | 示例 |
|------|--------|------|
| 项目导航 | AGENTS.md / README / 目录结构 | 「项目是 Bun + TS + zod，约定见 AGENTS.md」 |
| 相关文件路径 | 直接给具体文件，别让它全库找 | `src/auth/login.ts` |
| 失败复现 | 报错信息 / 复现步骤 / 期望 vs 实际 | 「调用 X 报 TypeError，期望返回数组」 |
| 验收标准 | 怎么算对（命令 + 行为对照点） | 「`bun run typecheck` 通过；测试覆盖手机号登录；错误沿用 `{ code, message }`」 |

```markdown
# ❌ 只丢一句模糊需求（弱验收标准，Agent 只能猜）
帮我把登录做好

# ✅ 完整最小上下文
项目：agent-fullstack 0x 客户服务（Bun + TS + zod，规范见 AGENTS.md）
要改：src/auth/login.ts 增加手机号登录，复用已有 verifySms(code) 工具
已有：src/auth/login.ts、src/utils/sms.ts
验收：bun run typecheck 通过；bun test 新增手机号登录用例；错误响应沿用 { code, message } 结构
```

禁止只丢一句模糊需求（呼应 [llm-coding-guidelines](llm-coding-guidelines.md) 的 weak success criteria）。

## 4. 产物验收流程（生成代码必过三关）

AI 生成的代码，合入前必过：

1. **typecheck**：`bun run typecheck`（`tsc --noEmit`）
2. **lint + format**：`bun run lint` + `bun run format:check`（oxlint / oxfmt，见 [code-style](code-style.md)）
3. **test**：`bun test`，相关用例全绿
4. 按 [code-review-dimensions](code-review-dimensions.md) 逐项复核（重点：正确性 / 健壮性 / 安全 / 耦合）
5. 「先验证后信任」：**不 review 不 commit**

```bash
bun run typecheck && bun run lint && bun run format:check && bun test
```

## 5. 常见坑与反模式（AI 协作场景）

与 [llm-coding-guidelines](llm-coding-guidelines.md) 的 Karpathy 教训同源，这里侧重 AI 协作实操：

| 反模式 | 表现 | 对策 |
|--------|------|------|
| 过度工程设计 | 一次性需求生成抽象类 / 一堆可配置项 | 让它先出最小实现；用测试兜底后删「以防万一」代码 |
| 静默假设不澄清 | 需求有歧义，它直接挑一种实现 | 明确要求先列假设，你确认后再动 |
| 无关改动顺手修 | 修 A 连带改 B 的格式 / 重构 C | 合入前 `git diff` 检查，剔无关改动（呼应 [git-workflow](git-workflow.md) 原子提交） |
| 弱验收标准 | 「make it work」式提示词，无从验证 | 写具体验收：命令 + 期望行为（§3） |
| 一次生成 500 行不拆步 | 单次输出过多，review 无从下手，错误难定位 | 拆成多次小步：骨架 → 实现 → 测试 → review |

## 6. AI Code Review

- 把 [code-review-dimensions](code-review-dimensions.md) 当**输入模板**直接交给 LLM 走查（该文件本就是给「人肉或 LLM 按清单走查」设计的：八维清单 + 输出表格）
- **红线结论必须人工复核**：注入 / 硬编码密钥 / 静默吞错 / 循环内阻塞 I/O 四条红线，AI 说「安全」不等于真的安全，逐条人工确认（呼应「先验证后信任」）
- 让 AI 给证据位置（文件 + 行号），按 P0/P1/P2 定级，人抽查降噪；AI 漏报比误报更常见，重点维度（正确性 / 健壮性）过一遍

## 7. 多 Agent 协作模式

复杂任务拆成「规划 → 执行 → 审查」三阶段流水线：

| 阶段 | 谁 | 做什么 |
|------|-----|--------|
| 规划 | 主 Agent（**人确认**） | 拆任务、定每步输入输出与验收标准 |
| 执行 | 多个 subagent 并行 | 每人一个独立子任务，互不共享可变状态 |
| 审查 | 独立 reviewer | 按 [code-review-dimensions](code-review-dimensions.md) 走查 + 回归验证（§4 三关） |

要点：

- 子任务规格要独立可验收：每步有输入、输出、验收命令（呼应 §3 上下文工程）
- 并行任务之间不共享可变状态（各自独立文件 / 模块），避免互相踩
- 合入前跑全套 typecheck + lint + test 回归（呼应「先验证后信任」）
- 概念参考 skill-kit `superpowers/`（`writing-plans` / `executing-plans` / `dispatching-parallel-agents` / `subagent-driven-development` / `requesting-code-review`），本文件不重复实现流程细节

## 速查：一次 AI 写码的标准流程

1. **写上下文**：项目导航 + 文件路径 + 验收标准（§3）
2. **拆步**：每步小、可验收，不一次生成 500 行（§5）
3. **生成 → 自跑三关**：typecheck / lint / test（§4）
4. **复核**：按 code-review-dimensions 走查，红线结论人工确认（§6）
5. **自查**：`git diff` 确认无夹带，按 [git-workflow](git-workflow.md) 原子提交