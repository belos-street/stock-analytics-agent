# 决策记录（Decisions）

> 追加式决策日志，格式见 `.agents/rules/memory.md`。承接涉及既有约定的任务前先读本文件。

## D1 · 3.0 引入 LangChain.js（而非 Python）

- **结论**：agent 层使用 LangChain.js 1.0+（TypeScript / Bun 技术栈）；skill-kit 的 langchain skill 为 Python 口径不引入，按需核查官方文档 <https://docs.langchain.com/llms.txt>
- **理由**：与现有 Bun/TS 代码栈一致，避免双语言维护
- **日期**：2026-10-16

## D2 · Agent 双模式并存

- **结论**：模式 1 = harness 用法（Codex/WorkBuddy 等直读 `AGENTS.md` + `.agents/skills`，现有工作流不动）；模式 2 = 独立 CLI 用法（langchainjs 对话入口，`.env` 配置 LLM API key）。CLI 能力 + skill 统一封装为 agent tools，两种模式共享 `src/` 数据层
- **理由**：兼顾"download 即用"与"命令行直跑"两类用户；agent 改造不得破坏模式 1
- **日期**：2026-10-16

## D3 · 3.0 优先级：规范与工具链先行

- **结论**：P0 = skill-kit 引入 + business skill + oxclint/oxcfmt 工具链 → P1 = LangChain.js Agent → P2 = skills 全量 review + README + 改名
- **理由**：编码规范与 lint/format 先就位，agent 编码时直接遵循，避免返工
- **日期**：2026-10-16

## D4 · 开发类 skill 放 `.agents/dev/`，不与 business 合并

- **结论**：`.agents/` 三层结构：`skills/`（投资分析技能）+ `business/`（交付生产技能）+ `dev/`（编码规范与开发流程：belos-street、bun、grill-me）
- **理由**：用途与触发场景不同（交付 vs 开发），合并会增加 agent 检索噪音；`AGENTS.md` 已对 business 有明确定义
- **日期**：2026-10-16

## D5 · 项目改名 stock-analytics-agent（全面改名）

- **结论**：GitHub 仓库、本地目录、package.json name 统一改为 `stock-analytics-agent`；bin 名 `stock-analytics` 保留；执行时机放 P2 收尾
- **理由**：3.0 后 agent 是核心定位，"skill" 后缀滞后；保留 analytics 辨识度成本最低
- **日期**：2026-10-16

## D6 · 采纳轻量版 ai-collab 体系

- **结论**：引入 `.agents/rules/`（memory + project_rules）与 `.agents/memory/decisions.md`；不引入 workflows/doc 分层/L6 机器校验闸门等企业级部分
- **理由**：本项目为个人投资工具非企业级；仓库内决策记忆对所有 harness 可见，补足本机 memory 无法跨工具的缺口
- **日期**：2026-10-16

## D7 · oxcfmt 排除 Markdown 研究文档

- **结论**：`.oxfmtrc.jsonc` 的 `ignorePatterns` 加入 `**/*.md`，格式化只覆盖代码文件；研究文档（strategy/watchlist/reports 的 md）由内容作者控制排版
- **理由**：oxfmt 会改动 md 列表空行/换行，churn 污染研究文档 diff 与 review 视线；代码与文档的格式化诉求不同
- **日期**：2026-10-16

## D8 · LLM 走 OpenAI 兼容接口（DeepSeek）

- **结论**：模式 2 agent 的模型接入统一走 **OpenAI 兼容接口**（`@langchain/openai` + 可配 `OPENAI_BASE_URL`），默认接 DeepSeek。`.env.example` 定义 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `DEFAULT_MODEL` 三变量，用户填 `.env` 即可跑。`.env` 必须在 `.gitignore` 中
- **理由**：一套代码通吃 OpenAI / DeepSeek / MoonShot / 月之暗面等兼容端点，无需多 provider 抽象；用户已确认 DeepSeek 为默认
- **日期**：2026-10-19
