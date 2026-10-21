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

## D9 · skills 量化口径统一（S1–S4）

- **结论**：25 个投资 skill 量化口径统一——① 阈值按**标的自身**历史分位/区间校准（禁全市场一刀切绝对阈值），附校准注释（DPS 口径、阈值调整原因、DPS 增长→价格锚上/下移）；② 估值分位 = 近 10 年**月频**收盘 PE-TTM（整体法，负 PE 剔除）分位，标数据基准日，"年内最高价/回撤"用 monthly 完整周期；③ 股息率统一标 `yield_basis`（默认近 12 个月 DPS 年度化；单期×4 须显式注明，警惕第三方单期分红失真）；④ 各 skill 附「数据获取与口径」小节（CLI 优先 + 官方口径优先 + 禁止编造 + 基准日）
- **理由**：回撤大≠估值低、单期股息率失真、局部窗口漏年内最高价等教训表明口径不统一会误导决策；统一口径 + 基准日使输出可核验
- **日期**：2026-10-20
- **来源**：`upgrade/v3.0/skills_review.md` S1–S4

## D10 · 投资输出合规口径（空方 + 仓位 + 红线）

- **结论**：① 输出必填「空方论点 / 看空情景 / 证伪条件」+ 估值陷阱检查（低 PE=盈利顶部、回撤大≠估值低、概念辨真伪、高股息可持续性、增长质量）；② 仓位三层约束：单只个股 ≤ 总资金 10%、单只高风险/行业 ETF ≤ 总资金 5%、高弹性组合避免同一成长风格重复暴露（三者为不同层级约束，分别校验）；③ 红线措辞禁令：禁收益承诺 / 盈利概率 / 无口径精确预测 / 买卖指令，边界声明统一为「预期差方向 + 正反双方论点 + 配置参考」
- **理由**：多 skill 单边多头、收益承诺（如"盈利概率>99%、年化12-15%"）与边界自相矛盾；须客观中立、可证伪、不误导下单
- **日期**：2026-10-20
- **来源**：`upgrade/v3.0/skills_review.md` S5–S6 + 红线措辞

## D11 · 关键事实口径基准（防再错）

- **结论**：review 中确立的事实基准，后续分析/修订须对齐——① 债券收益率曲线：牛平=长端下更多（利差收窄）、熊陡=长端上更多（利差走阔）、熊平=短端上更多（利差收窄）；② 公募 REITs 强制分红 = 年度**可供分配金额**的 90%（非"收入"）；③ 港股最小价格变动按 HKEX《附表二 價位表》分档；④ 中证A500 基日 2004-12-31，短样本分位须标注；⑤ 社融/信贷为月度发布
- **理由**：这些事实此前在 skill 中写错（曲线释义反向、REITs 收入口径、价位表、信贷频率），会直接误导做陡做平/分红测算/下单
- **日期**：2026-10-20
- **来源**：`upgrade/v3.0/skills_review.md` P0-a 事实硬伤（外部事实已回主源核验）
