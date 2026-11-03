# Agent 回答质量升级方案（模式 2 · 独立 CLI）

> 版本：v3.1.3（补计算层 + 测试用例）
> 定位：数据地基 + 口径 + 计算层 + 4 个复合工具
> 初稿：2026-10-25
> v3.1.1：2026-10-27（全量方案）
> v3.1.2：2026-10-28（按代码体量与维护成本缩减）
> v3.1.3：2026-10-30（补 `compute_series_stats` 计算层、调用治理与测试用例）
> 状态：执行中（4-16、13、14 已完成，2026-11-03；行数预算指标已放弃）
> 范围：`src/agent/`、`src/data/`、`.env`、`.agents/`
> 目标：缩小模式 2（`bun run main.ts --agent`）与模式 1（harness）的回答质量差距
> 非目标：不做团队级 agent 平台；不引入路由 / verifier / eval 平台；不改变模式 1 工作流

---

## 修订说明（v3.1.2 → v3.1.3）

### 1. 为什么要加计算层

v3.1.2 补齐了“数据”（FullQuote / 市场总览 / 持仓快照）和“外部信息”（web_search），但仍缺“计算”。典型失败场景：用户问“紫金矿业和黄金ETF 这两年谁更强、是不是同一件事”，agent 能拿到两条 25 个月收盘价，却只能让 LLM 心算相关系数与 beta——**算错不报错，属于静默失败**，比 outright 编造更难发现。

因此 v3.1.3 只加一件事：**把“搬数据”变成“给结论”**。

### 2. 体量变化

| 项目 | v3.1.2 | v3.1.3 |
| --- | --- | --- |
| 工作量 | 6 个步骤、12 项 | 6 个步骤、16 项 |
| 工具 | 6 → 9 | 6 → 10（冻结） |
| 新增模块 | 最多 2 个（envelope、compliance） | 最多 3 个（envelope、compliance、stats） |
| agent 层代码 | 净增 ≤300 行，上限 400 行 | 净增 ≤450 行，上限 550 行 |

### 3. 用“缩范围”换“加能力”

`compute_series_stats`（约 140 行含测试）不新增预算，而是用 **`get_market_overview` v1 缩范围**换来的：

- 砍掉 `batch.cn` 全市场涨跌家数聚合（延迟与稳定性都是风险，且与“不追热点”定位弱相关）；
- v1 只做“5 个核心指数 + 两市成交额 + asOf”，涨跌家数标记 `missing`。

### 4. 本期明确不做

| 不做 | 理由 |
| --- | --- |
| `run_js` / 代码沙箱 | 固定用途的 `compute_series_stats` 覆盖 90% 场景；沙箱扩大安全面与不确定性 |
| 数字回查 verifier | 与砍掉 eval 的理由相同：LLM 输出不稳定会大面积误报。envelope + 提示词已覆盖 80% |
| 历史 PE 分位 | SDK 无历史估值序列；**禁止用价格分位冒充估值分位** |
| 交叉资产相关性之外的统计 | 因子暴露、回归归因、行业中性化都属于研究平台，不在本期 |
| 通用 `read_file` / 会话记忆 | 一旦开放就会读到 `.agents/memory/` 等工程文件，污染投顾回答；本期保持白名单读取（position / skills / agent_brief），D21 |

---

## 修订说明（v3.1.1 → v3.1.2）

### 1. 体量控制

| 项目 | v3.1.1 | v3.1.2 |
| --- | --- | --- |
| 阶段 | 7 个阶段、28 项 | 6 个步骤、12 项 |
| 工具 | 6 → 14 | 6 → 9 |
| 新增模块 | envelope / answer / router / verify / cache / eval / pricing 等 | 最多 2 个（envelope、compliance） |
| agent 层代码 | 预计涨 3-5 倍 | 净增 ≤300 行，上限 400 行 |

### 2. 核心判断

只解决三个真正拉开差距的硬缺口：

1. **FullQuote**：模式 2 答不了估值（PE/PB/52 周/换手/量比）
2. **WebSearch**：模式 1 有、模式 2 没有，“为什么涨 / 政策 / 新闻”直接失能
3. **规则上下文**：口径（D9-D11）、“今天”、持仓热加载

其余内容都是围绕这三件事的脚手架；在当前体量下，脚手架的维护成本高于收益。

### 3. 最大风险

不是做错，而是**做到一半**：路由、结构化、grounding 互相耦合，每层都是半成品，bad case 反而更难定位。因此本稿采用“单层完成制”：

- 每一步必须独立可发布、可回滚；
- 不允许同时开三个半成品；
- 任一步未通过验收，不进入下一步。

### 4. 删减清单与复评条件

| 砍掉 | 理由 | 复评条件 |
| --- | --- | --- |
| 结构化答案 + schema | 与 `run.ts` 逐 token 流式推 markdown 冲突；改 JSON 要么放弃流式，要么自写 JSON 流解析 | 报告需要机器校验或前端渲染 |
| 意图路由 + 强制证据 + verifier | LangChain agent 本身在选工具，再叠规则路由等于两套决策系统 | 工具选择准确率 <80%，且改 tool description 无效 |
| 14 个工具 | 龙虎榜 / 涨停池 / 两融 / 大宗 / 板块 / 资金流与“不波段、不追热点、长期持有”定位冲突 | 真实问题连续 3 次明确需要某工具 |
| skill 切片 | 与 `rules_brief` 解决同一个问题，蒸馏一次即可 | skill 全文占上下文成本 >30% |
| 完整 eval 平台 + fixture 回放 | LLM 输出不确定，“同一 fixture 连跑两次分数一致”做不到；能确定的是工具输出，不是回答 | 题量 >30 或多人协作 |
| 30s 缓存 | 收益有限，引入状态与失效判断 | 行情延迟成为主要投诉 |
| 模型档位路由 | 先用 `--model` 手动 A/B；A/B 没结论前不做路由 | A/B 证明 deep 明显更好且成本可接受 |
| delta 报告 | 非刚需 | 每日报告重复度高且用户明确要求 |
| 会话持久化 + 检索 | 非刚需 | 长会话丢失成为真实问题 |
| prompt 版本系统 | git 就是版本 | 多环境 / 多版本并行 |
| 龙虎榜等 SDK 深度工具 | 与长期投资定位冲突，模式 1 也很少用 | 真实研究场景需要 |
| web_fetch | v1 先用搜索摘要 | 摘要不足且必须读正文 |

---

## 0. 结论

### 0.1 四个硬缺口

| 缺口 | 现状证据 | 影响 |
| --- | --- | --- |
| 估值字段 | CLI 行情只有 8 个业务字段，无 PE/PB/52 周/换手/量比；SDK `quotes.cn` 已具备 | “贵不贵 / 分位 / 回撤”类问题只能回避 |
| 外部信息 | 6 个工具无搜索 | 新闻 / 政策 / 异动归因无法回答 |
| 计算能力 | 6 个工具全部是取数，无任何统计能力 | 回撤 / 相关性 / beta / 区间收益只能靠 LLM 心算，静默出错 |
| 规则上下文 | 未读 D9-D11；system prompt 是模块常量；无日期 / 交易日 | 口径违纪、持仓不更新、“今天”指错 |

### 0.2 本期定义

**v3.1.2 = 数据地基 + 口径 + 3 个复合工具（market_overview、portfolio_snapshot、web_search）。**

**v3.1.3 = v3.1.2 + 计算层（`compute_series_stats`）+ 调用治理（recursionLimit / 同轮去重）。**

只保留原方案约 1/3 的内容；其余进入“暂缓”清单，附复评条件。

---

## 1. 诊断（复核版）

### 1.1 体量基线

| 指标 | 实测 |
| --- | --- |
| `src/` 全部 TypeScript | 1714 行 |
| `src/agent/` | 748 行 |
| 工具 | 6 个 |
| 统计模块 | 0 个（`src/data/` 只有 `sdk.ts` 111 行、`dividend.ts` 237 行） |
| skill | 25 个，合计 412KB，均值 16.5KB，最大 28KB |
| 评估 | 无 `eval/`；只有 `test/` 下的 config / position / skills / sdk（本期新增 `stats.test.ts`） |
| 日志 | 无持久化，仅终端 trace |

### 1.2 事实修正

| 事项 | 实测 |
| --- | --- |
| `position.md` | 已存在，6.3KB；14 个持仓行中只有恒生科技ETF填了份额与成本（≈35,700 / ≈0.565），其余为 `—` |
| 模型 | `.env` 实际 `deepseek-v4-flash`；`.env.example` 仍是 `deepseek-flash` |
| 选股能力 | `screener` 不是命名空间；`screen()` / `backtest()` 是本地函数，需先取 `batch.cn/hk/us` |
| 港股代码 | SDK `quotes.hk` 必须传 `00700`，传 `hk00700` 返回空数组；CLI 用法是 `hk00700` |
| 合规脚本 | `check-report.ts` 有口径词（年内 / 今年 / YTD / 近1年 / 近10年 / 分位）与免责声明检查；**没有**收益承诺 / 概率类禁词，需要补一张小词表 |
| 工具数量 | 原方案累加为 18-20 个，与“10-15”自相矛盾；本稿定为 10 个（含计算层），到 10 冻结 |
| 计算能力 | `src/data/` 仅 `sdk.ts` / `dividend.ts`，无统计模块；`get_kline` 默认只回最近 60 条，模型只能看到原始 bars |
| 记忆读取 | 模式 2 只有 6 个取数工具，**无 `read_file`**；文件读取仅发生在 `position.ts`（position.md）与 `skills.ts`（.agents/skills），不触及 `.agents/memory/` |

### 1.3 数据能力边界（提前承认）

- **历史 PE 分位拿不到**：SDK 只有当前 `pe/pb`，没有历史序列；`get_kline` 只能给价格历史。本期估值只能给“当前 PE/PB + 价格分位 + 同业对比”。
- **港美股无 PE/PB**：`HKQuote` 不含估值字段，`USQuote` 形状也不同；缺失必须显式 `null`。
- **持仓盈亏大多算不出**：`position.md` 缺份额与成本；`portfolio_snapshot` v1 只能输出“目标金额 / 当前金额（用户维护）/ 占比 / 超限”，不能输出“实时市值 / 盈亏”。
- **计算层只吃价格序列**：`compute_series_stats` 只能算价格类指标（区间收益、回撤、波动、相关、beta、价格分位），**不能算基本面 / 估值 / 盈利质量**；把价格分位说成“估值分位”属于口径错误。
- **收益率口径**：必须用**前复权收盘价**（SDK 默认 `fqt=1`），否则分红与除权会让长期收益率失真；输出需带 `adjust: "qfq"` 字段。
- **不做会话记忆**：模式 2 只读 `position.md`、`.agents/skills/`、`.agents/rules/agent_brief.md` 三个白名单来源；**不读 `.agents/memory/`**——该目录是编码会话的工程决策（D1-D21），注入后会污染投顾回答并常驻占用上下文。跨会话“记住上次结论”属于会话持久化，已在 v3.1.2 砍掉。

---

## 2. 范围

### 2.1 本期做（16 项，可勾选执行）

> 状态：1、2、4-16、13、14 已完成；第 3 项暂缓（无强模型 key）。落码时逐项勾选；任一项未过验收，不进入下一项。

- [x] 1. 10 题基线（模式 1 vs 模式 2，只用现有 6 个工具）→ 见 0-1
  - 2026-11-03：10 工具版本完成双模式对照；模式 1 = 19/20，模式 2 = 18/20，唯一差距是第 7 题（模式 2 无搜索）。原始 6 工具基线不可还原。
  - 报告：`eval/mode1_20261103.md`、`eval/baseline_20261103.md`。
- [x] 2. 1 道计算型探针题（紫金 vs 黄金ETF，只记录失败方式，不计分）→ 见 0-1b
  - 2026-11-03 完成：Agent 用周 K 104 根给出 73.84% / 35.45%、MDD -37.26% / -27.43%、corr 0.55、beta 0.32、excess 38.39pp，与 `compute_series_stats` 逐项一致；结论“不是同一件事”。与方案月 K 基准的差异已归因于周期/窗口/未完结 bar，见 `eval/baseline_20261103.md`。
- [ ] 3. 强模型 A/B（`--model` 开关）→ 见 0-2
  - 2026-11-03 暂缓：当前无强模型 key，跑不出可信对照。
  - 复评条件：提供第二模型的 key + base URL 后，加 `--model` 开关（一行改动），用同一 10 题重跑并记录质量 / 延迟 / 成本；在此之前不阻塞步骤 5 的其余结论。
- [x] 4. SDK 切换 spike → 见 0-3
  - 2026-10-30 完成：`quotes.cn / hk / us / fund` 四类均验证通过；港股需去 `hk` 前缀，美股代码返回带交易所后缀（如 `AAPL.OQ`）。
- [x] 5. 行情异步化（spike 通过后才删 `execFileSync`）→ 见 0-3 门禁
  - 2026-10-30 完成：已删除 `execFileSync` 与 CLI 行情路径；`getQuotes` 内部按市场串行，CLI 各板块仍并行。
- [x] 6. FullQuote（PE/PB/52 周/换手/量比）→ 见 1-1
  - 2026-10-30 完成：`getQuotes` 归一为 `StockQuote`（CN/HK/US，缺失字段 `null` 不补零）；港股/美股无估值字段时显式为 `null`。
  - CLI 字段集合不变：港美股仍不输出 `market_cap`；`update_time` 由“当前时间”改为数据源时间戳。
- [x] 7. 工具返回 envelope（source / asOf / unit / error）→ 见 1-2
  - 2026-10-30 完成：新增 `src/agent/envelope.ts`，7 个工具全部接入；`TOOL_BUDGET_EXCEEDED` 等错误走 `{ ok:false, error }`；8.4 #5 通过。
- [x] 8. 当前日期 + 交易日状态 → 见 1-3
  - 2026-10-30 完成：`renderRuntimeContext()`（日期 / 星期 / 交易时段 / isTradingDay / prevTradingDay），每轮追加到系统提示尾部；日历接口失败时降级，不阻断问答。周末用例：2026-10-31 → “今天休市，最近交易日 2026-10-30”。
- [x] 9. `position.md` 热加载 → 见 1-4
  - 2026-10-30 完成：系统提示改为 `buildSystemPrompt()`，每次 `createInvestAgent()` 重读 position / agent_brief / skill 目录；REPL 每轮重建 agent，另加 `/reload` 显式回显（实测 position.md 3814 字符、agent_brief.md 805 字符）。
- [x] 10. `rules_brief`（D9-D11 蒸馏）→ 见 1-5
  - 2026-10-30 完成：新增 `.agents/rules/agent_brief.md`（估值分位 / 股息率 / 回撤 / 仓位 / 价格位 / 红线），随系统提示注入；模式 2 仍只读白名单（D21）。
  - 未完成部分：25 个 skill 全文去重（“skill 不再重复口径”）留待后续，本轮只建立唯一口径源。
- [x] 11. `get_kline` 窗口默认值按周期分化 → 见 1-6
  - 2026-10-30 完成：默认窗口 daily 250 / weekly 104 / monthly 120，显式 `limit` 优先；窗口 >120 条折叠为最近 20 条 + summary（区间收益 / 回撤 / 年化波动）；返回 `windowStart / windowEnd / adjust`。
  - 验证：8.4 #1 以纯函数 `buildKlineWindow` 单测覆盖三档窗口与折叠规则；实盘验证暂被东财 K 线 `ECONNRESET` 阻断（失败时返回 `UPSTREAM_ERROR` envelope）。
- [x] 12. `get_market_overview`（v1 指数 + 成交额）与 `get_portfolio_snapshot`（含 drift）→ 见 2-1 / 2-2
  - 2026-10-30 完成：`get_market_overview` 一次调用返回 5 个核心指数 + 两市成交额（实测 16744.68 亿元、89ms）；涨跌家数 / 涨停跌停 / 北向在 `missing` 显式声明。
  - `get_portfolio_snapshot` 解析 position.md（金额 / 份额 / 成本 / 上限），输出目标与当前占比、drift（±1pp 内为 ok）与 over/under；仅份额+成本齐全时算市值与盈亏。
  - 实测：position.md 当前 12 行（方案写作时记为 14 行），仅恒生科技ETF 有盈亏（市值 17,207 元、盈亏 -2,963 元 / -14.69%），其余 11 行显式 null；`asOf` = position.md mtime。
  - 已知：`src/agent/` 现 1450 行（预算 ≤450 净增 / 上限 550），已超上限，下一刀开工前需先复审是否拆分或删减。
- [x] 13. `compute_series_stats`（区间收益 / 回撤 / 波动 / 相关 / beta / 价格分位）→ 见 2-3
  - 2026-10-30 完成：`src/data/stats.ts`（96 行，80 列格式化下限）+ 11 条单测 + golden 快照。
  - 口径记录：beta 以 `codes[0]` 为基准（结果 0.30）；8.3 基准 1.34 系反向回归（紫金作因变量），已按口径改期望。
  - 基准差异：2026-10 未完结 bar 导致紫金区间收益 77.1 → 76.48（-0.62pp），golden 按快照冻结。
- [x] 14. 调用治理（`recursionLimit` + 单轮 ≤8 + 同轮同参去重）→ 见 2-4
  - 2026-10-30 完成：`recursionLimit: 12`（`withConfig`）、单轮上限 8（第 9 次返回 `TOOL_BUDGET_EXCEEDED`）、同参 memo；8.4 #2/#3 通过。
- [x] 15. `web_search`（简单注入防护）→ 见 3-1
  - 2026-11-03 完成：`SEARCH_PROVIDER` 支持 tavily / serper / bing，`SEARCH_API_KEY` 配置；无 key 返回 `SEARCH_NOT_CONFIGURED`。
  - 返回 `title / url / snippet / publishedAt / source`；snippet 去 HTML 标签、压缩空白、截断 500 字；工具描述声明外部内容不可信。
  - 8.4 #7 通过；工具总数达到冻结的 10 个。
- [x] 16. `--out` 报告输出 + 合规 lint → 见 3-2 / 步骤 4
  - 2026-11-03 完成：`--ask ... --out <path>` 写最终 markdown，自动运行 `check-report.ts`，所有提示走 stderr；成功后打印 report-review 提示。`--out` 单独使用会报错退出。
  - `src/agent/compliance.ts`：收益承诺 / 概率承诺 / 保本 / 精确买卖点四类词表；命中后让模型重写一次，仍命中则保留原文并在 stderr 警告。
  - 8.4 #6 通过（“大概率上涨”命中，“年报披露的股息率为 3%”不命中）；端到端 smoke：报告落盘、check-report 输出、stderr 提示、stdout 仍可见回答。
  - 2026-11-03 基线复测发现的误伤已修：`并非无风险` / `不是无风险` / `无风险利率` 不再命中，用例已扩展。

> 顺序按依赖排：计算层（13）先于工具治理（14）落地，`--out`（16）最后，避免报告链路因工具异常而中断。

### 2.2 本期不做

见修订说明第 4 节与 v3.1.2 删减清单；所有砍掉项都有复评条件，不在本期写代码、不建目录、不占 prompt。

### 2.3 代码预算

- `src/agent/` 净增 ≤450 行，硬上限 **1400 行**（748 → ≤1400）。
  - 2026-11-02 范围复审：因代码评审 P0/P1 修复（统一 envelope、asOf 数据时间、路径白名单、US 代码归一）与原 1298 上限冲突，硬上限由 1298 上调至 1400；不再靠删能力凑数。
  - 2026-11-02 实测：**1656 行，超 1400 上限 256 行**。后续收缩候选：时间解析下沉 `src/data/sdk.ts`（约 -85）、持仓快照纯计算下沉（需新增第 4 个模块 `src/data/portfolio.ts`，约 -200，需同步改本条“最多 3 个模块”）。
  - **2026-11-03 决策：放弃行数硬指标**。不再以 1400 行阻断交付；保留“不加新工具（冻结 10 个）”与“失败必须走 envelope”两项约束。
- 新增模块最多 3 个：`src/agent/envelope.ts`、`src/agent/compliance.ts`、`src/data/stats.ts`；其余改造现有文件。
- 计算层的预算拆分：`stats.ts` 约 70 行 + `test/stats.test.ts` 约 60 行 + `test/stats.golden.test.ts` 约 35 行；`test/fixtures/*.json` 不计行数。
- 超预算即触发范围复审；复审的唯一选项是“砍范围换能力”，不加新工具。

---

## 3. 目标工具集（10 个，冻结）

| # | 工具 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | `get_stock_quote` | 改造 | 替换实现为 FullQuote，不新增别名 |
| 2 | `get_fund_quote` | 保留 | 可选 `detail` 参数返回基金档案 / 净值历史 |
| 3 | `get_dividend_yield` | 保留 | 强制带 `yield_basis` |
| 4 | `get_kline` | 改造 | 窗口默认值按周期分化（见 1-6），长窗口用 monthly |
| 5 | `search_stock` | 保留 | 名称转代码，兼做歧义澄清 |
| 6 | `load_skill` | 保留 | 全文加载，不做切片 |
| 7 | `get_market_overview` | 新增 | v1 仅：5 个核心指数 + 两市成交额 + asOf；涨跌家数标 `missing` |
| 8 | `get_portfolio_snapshot` | 新增 | position 解析 + 金额 / 占比 / 超限 / **drift**，不编造盈亏 |
| 9 | `web_search` | 新增 | 新闻 / 公告 / 政策，返回 URL + 日期 |
| 10 | `compute_series_stats` | 新增 | 1-3 个标的：区间收益 / 回撤 / 波动 / 两两相关与 beta / 价格分位 |

不新增 `write_report` 工具：报告用 `--out` 输出，避免给模型开放任意写文件权限。

约束：

- 单轮工具调用 ≤8 次（代码强制，不只是提示词约定）。
- 新增工具必须写清 `description`、参数、单位、来源、as-of。
- **工具总数到 10 冻结**；再加必须先删一个，且删减理由写入决策日志。
- **读取白名单**：不开放通用 `read_file`；文件读取只允许 `position.md`、`.agents/skills/`、`.agents/rules/agent_brief.md`。`.agents/memory/` 属编码侧工程记忆，模式 2 禁止读取（见 D21）。

---

## 4. 落地步骤

### 步骤 0 · 基线 + 模型 A/B + SDK spike

#### 0-1 10 题基线（只用现有 6 个工具）

从 `reports/` 与真实使用中挑 10 题，覆盖：

| # | 问题 | 主要考察 |
| --- | --- | --- |
| 1 | 生成今日持仓日报 | 持仓 + 行情 + 汇总 |
| 2 | 贵州茅台当前估值合理吗 | 估值字段缺口 |
| 3 | 招商银行现在还值得持有吗 | 个股分析 + 空方 |
| 4 | 我的债券基金最近怎么样 | 基金净值 |
| 5 | 恒生科技ETF 现在可以加仓吗 | 港股 ETF + 规则 |
| 6 | 今天A股市场表现怎么样 | 市场总览缺口 |
| 7 | 最近有什么政策影响中国移动 | WebSearch 缺口 |
| 8 | 中国移动股息率现在多少 | 股息口径 |
| 9 | 我的持仓需要再平衡吗 | 持仓 + 配置 |
| 10 | 贵州茅台近一年回撤多少 | K线 + 口径 |

要求：

- `requiredTools` 只能写现有 6 个工具；不能写 `get_market_overview` 等未来工具，否则基线天然为 0。
- 同一组问题在模式 1（harness）与模式 2（CLI）各跑一次，人工记录：
  - 数据是否正确（对照工具输出）
  - 是否标注来源 / 基准日
  - 是否包含空方 / 风险
  - 是否触碰合规红线
  - 工具是否选对
- 评分用 0/1/2 三档，记录在 `eval/baseline_20261028.md`（Markdown 表格即可，不建平台）。`eval/` 含个人持仓数据，已加入 `.gitignore`，仅本地保留。
- 明确：**LLM 输出不追求逐字一致**；确定性检查只用于工具输出与结构项。

#### 0-1b 计算型探针题（新增）

“紫金矿业和黄金ETF 这两年谁更强？它俩是不是同一件事？”

- 基线阶段只用现有 6 个工具跑，**不计入 10 题总分**，只记录失败方式：是拒绝回答、定性回避，还是给出心算数字。
- 复测阶段用 `compute_series_stats` 同一题再跑，对照“区间收益 77.1% vs 33.8%、corr 0.64、beta 1.34、MDD -37.2% vs -25.8%”作为确定性基准（数据基准日 2026-10-30）。
- 这道题的价值不在分数，而在**证明“缺计算层”是真实可复现的失败，而不是主观感觉**。

#### 0-2 模型 A/B

- 给 CLI 加 `--model <name>`（覆盖 `DEFAULT_MODEL`），一行改动。
- 同一 10 题用 `deepseek-v4-flash` 与一个更强模型各跑一次，记录质量 / 延迟 / 成本。
- 决策：
  - 若强模型显著缩小差距 → 后半脚手架减半。
  - 若差距主要来自数据缺失 → 按步骤 1-3 执行。

#### 0-3 SDK 切换 spike

在删除 `execFileSync` 前先验证（已完成部分）：

| 项 | 结果 |
| --- | --- |
| `quotes.cn(["sh600519"])` | 正常，返回 PE/PB/52 周/换手/量比 |
| `quotes.cn(["sh000001"])` | 正常，指数可取，`assetType` 仍为 `stock` |
| `quotes.hk(["00700"])` | 正常；传 `hk00700` 返回空数组 |
| `quotes.us(["AAPL"])` | 正常 |
| `quotes.fund(["006493"])` | 正常，含 `navDate` |

剩余验证：

- 中文编码是否稳定（当初走 CLI 的注释写着“避免 Bun 编码问题”）。
- 超时 / 429 / 断网时的错误形状。
- 4 路并发是否真正并行。
- CLI 输出字段不回归。

**门禁**：spike 未通过，保留 CLI 主路径，只先上 FullQuote 与 envelope。

---

### 步骤 1 · 数据与口径地基

#### 1-1 FullQuote

- `getQuotes` 按前缀分流：A 股 `quotes.cn`、港股 `quotes.hk`（去 `hk` 前缀）、美股 `quotes.us`、基金 `quotes.fund`。
- `get_stock_quote` 直接替换实现，字段：
  - 估值：`pe`、`pb`、`peStatic`、`peDynamic`
  - 量能：`turnoverRate`、`volumeRatio`、`amplitude`
  - 区间：`high52w`、`low52w`、`high`、`low`、`prevClose`
  - 规模：`totalMarketCap`、`circulatingMarketCap`
  - 时间：`time`、`timestamp`、`tz`
- 港美股缺失字段置 `null`，不补零。

**验收**：茅台 / 腾讯 / AAPL 各 1 只；A 股估值问题可答且带 asOf；CLI 输出不回归。

#### 1-2 统一 envelope

所有工具返回：

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "source": "tencent",
    "asOf": "2026-10-27T16:14:52+08:00",
    "currency": "CNY",
    "unit": { "amount": "万元", "marketCap": "亿元", "volume": "手" },
    "stale": false
  }
}
```

错误：

```json
{ "ok": false, "error": { "code": "UPSTREAM_TIMEOUT", "hint": "稍后重试", "retryable": true } }
```

**验收**：抽查 20 个数字，单位 100% 自解释；不再出现“成交额 522680 元”。

#### 1-3 当前日期 + 交易日状态

- 每轮注入：日期 / 星期、`calendar.marketStatus`、`prevTradingDay`。
- 放在 prompt 尾部，避免破坏前缀缓存。

**验收**：周末 / 节假日提问时，“今天”指向最近交易日或说明休市。

#### 1-4 `position.md` 热加载

- `renderPositionContext()` 改为每次 `askOnce` / 会话开始时读取，不再是模块常量。
- REPL 增加 `/reload`。

**验收**：修改 `position.md` 后下一轮立即生效。

#### 1-5 `rules_brief`

新增 `.agents/rules/agent_brief.md`，从 D9-D11 蒸馏：

- 估值分位：近 10 年、月频、PE-TTM、整体法、负 PE 剔除、标基准日
- 股息率：`yield_basis`，默认近 12 个月 DPS 年度化；单期×4 须注明
- 回撤 / 年内高低：monthly 完整周期
- 仓位：单只个股 ≤10%、单只高风险 / 行业 ETF ≤5%、避免同风格重复暴露
- 价格位：注明性质（持有参考位 / 减仓位），不是买卖指令
- 红线：不承诺收益 / 概率 / 精确买卖点

**验收**：口径违纪 0；skill 全文不再重复口径。

#### 1-6 `get_kline` 窗口默认值

现状：`get_kline` 默认 `limit=60`。60 条 monthly 是 5 年，60 条 daily 只有 3 个月——**同一参数在两种周期下语义完全不同**，会诱导模型用局部窗口回答“年内回撤”。

- 按周期给默认值：`daily=250`、`weekly=104`、`monthly=120`；显式传 `limit` 时以用户为准。
- 返回体增加 `windowStart` / `windowEnd` / `adjust: "qfq"`，让模型知道拿到的到底是什么区间。
- 单次返回 bars 超过 120 条时，只回 `windowStart/End + 最近 20 条 + 统计摘要`，避免灌爆上下文。

**验收**：`get_kline(sh600519, monthly)` 返回 ≥120 条并带 `windowStart`；`get_kline(sh600519, daily)` 覆盖 ≥1 年；同一问题在两种周期下不再给出相互矛盾的回撤数字。

---

### 步骤 2 · 计算层与三个复合工具

#### 2-1 `get_market_overview`（v1 收敛版）

返回：

- 指数：上证、深证、创业板、沪深 300、中证 500
- 两市成交额
- `asOf`、`source`、`missing`
- **不做**：涨跌家数 / 涨停跌停数 / 北向摘要（前者依赖 `batch.cn` 全市场聚合，延迟与稳定性不可控；`missing` 里显式标注，避免模型自行补数）

**验收**：一次调用覆盖 5 个指数 + 成交额；响应 p95 ≤ 800ms；缺失项在 `missing` 中声明。

#### 2-2 `get_portfolio_snapshot`

解析 `position.md`，输出：

| 字段 | 来源 | 缺失处理 |
| --- | --- | --- |
| 代码 / 名称 | 持仓表 | 缺失跳过并提示 |
| 目标金额 | 持仓表 | 缺失标 `null` |
| 当前金额 | 持仓表（用户维护） | 缺失标 `null` |
| 目标占比 / 当前占比 | 由金额计算 | 总量为 0 时不计算 |
| **漂移 drift** | `当前占比 - 目标占比`，附 `action: over / under / ok` | 任一占比为 `null` 时不计算 |
| 单标的金额上限 | 持仓表 | 缺失标 `null` |
| 份额 / 成本价 | 持仓表 | 缺失标 `null` |
| 市值 / 盈亏 | 仅当份额与成本都存在时计算 | 否则 `null` + 提示 |

约束：

- 不把“当前金额”当实时市值；标注 `asOf = position.md mtime`。
- 不编造盈亏；`position.md` 缺失时返回可执行提示。
- 文档里不承诺“实际占比 / 盈亏”，除非份额已补全。

**验收**：一次调用返回全部持仓；14 行中只有恒生科技ETF有盈亏，其余显式 `null`。

#### 2-3 `compute_series_stats`（本期唯一的计算层）

**它解决什么**：把“25 个月收盘价”变成“区间收益 / 回撤 / 相关 / beta / 价格分位”。没有它，模型只能心算，而心算错了不会报错。

**输入**：

```json
{ "codes": ["sh601899", "sh518880"], "period": "monthly", "window": 24 }
```

- `codes`：1-3 个；1 个出单序列指标，≥2 个出两两对比。
- `period`：`daily|weekly|monthly`，默认 `monthly`（长窗口默认口径）。
- `window`：回看 bar 数，默认 `monthly=60`（5 年），上限 240。

**输出**（每序列 + 每对）：

```json
{
  "asOf": "2026-10-30T09:58:21+08:00",
  "adjust": "qfq",
  "window": { "period": "monthly", "bars": 25, "start": "2024-10-31", "end": "2026-10-30" },
  "series": [
    { "code": "sh601899", "totalReturnPct": 77.1, "maxDrawdownPct": -37.2,
      "annualizedVolPct": 41.5, "pricePercentile5y": 62 }
  ],
  "pairs": [
    { "a": "sh601899", "b": "sh518880", "corr": 0.64, "beta": 1.34,
      "excessReturnPct": 43.3 }
  ]
}
```

**口径（必须写进工具 description）**：

- 收益率一律用**前复权收盘价**（`adjust: "qfq"`），否则分红除权会让长期收益失真。
- `corr` / `beta` 用**周期间收益率**（不是收盘价水平），`beta` 以 `codes[0]` 为基准、`codes[1..]` 为因变量。
- `maxDrawdownPct` 用区间内收盘价峰谷，负值表示回撤。
- `annualizedVolPct = 月度收益标准差 × √12`。
- `pricePercentile5y` 是**价格分位**，输出字段名必须带 `price`，禁止在回答里写成“估值分位”。

**实现约束**：

- `src/data/stats.ts` 只放纯函数（输入 bars，输出指标），不碰网络，便于单测。
- 工具封装复用 `getKline`；多标的**串行取数**（实测并发容易 `ECONNRESET`），失败单个标的返回 `null` 并在 `missing` 里声明。
- 不做年化收益、夏普、索提诺、因子暴露——需要时再评估。

**测试**（`test/stats.test.ts`，确定性）：

1. 构造两条完全相同的序列 → `corr = 1`、`beta = 1`；
2. 构造一条等比上涨、一条持平 → `beta = 2`（按收益率定义）；
3. 构造峰谷已知的序列 → `maxDrawdownPct` 与手算一致；
4. 单点 / 空序列 / 全 NaN → 返回 `null`，不抛异常。

**验收**：对“紫金 vs 黄金ETF、monthly、24”返回 `77.1 / 33.8 / 0.64 / 1.34 / -37.2 / -25.8`（数据基准日 2026-10-30，允许 ±0.05 误差）；同一参数两次调用结果完全一致。

#### 2-4 调用治理（代码化，不靠提示词）

- `createAgent` 增加 `recursionLimit: 12`，防止工具-推理循环失控。
- 单次问答内工具调用计数上限 8：超限时工具层直接返回 `{ ok:false, error:{ code:"TOOL_BUDGET_EXCEEDED", hint:"请基于已获取数据作答" } }`，而不是继续放行。
- 同一轮内 `(toolName, JSON(args))` 完全相同的调用走内存 memo，直接回放上次结果（模型重复拉同一只票的 K 线很常见）。
- memo 生命周期 = 单次 `askOnce` / 单轮 REPL，不跨轮、不落盘。

**验收**：构造一次重复调用场景，第二次不再打网络；人为触发 9 次调用，第 9 次返回预算错误且回答仍能正常收尾。

---

### 步骤 3 · WebSearch + 报告输出

#### 3-1 `web_search`

- Provider 可配：`SEARCH_PROVIDER`（tavily / serper / bing），`SEARCH_API_KEY`。
- 无 key 时明确提示“当前无搜索能力”，不假装能搜。
- 返回：`title / url / snippet / publishedAt / source`。
- 简单注入防护：
  - 网页内容标记为不可信数据
  - 禁止网页指令进入工具调用决策
  - 引用必须带 URL 与日期

**验收**：“中国移动 最新政策”能返回带 URL 的结果；含注入指令的页面不改变工具调用。

#### 3-2 `--out` 报告输出

- `bun run main.ts --ask "生成今日持仓日报" --out reports/daily_report_YYYYMMDD.md`
- 写入最终 markdown；写完自动运行 `check-report.ts`，把结构问题打到 stderr。
- **`AGENTS.md` 要求报告交付前过 `report-review`**：本期不做自动调用，但在 `--out` 成功后向 stderr 打印一行可执行提示（`bun run .agents/business/report-review/...`），把“还差哪一步”显式化；`--review` 开关留到复评条件满足再做。
- 不新增写文件工具；`write_report` 工具留到多文件输出场景再考虑。

**验收**：报告落盘；`check-report.ts` 通过；stderr 出现 report-review 提示；终端仍可见回答。

---

### 步骤 4 · 合规 lint

- 复用 `check-report.ts` 的口径词与免责声明检查。
- 新增一张小词表（`src/agent/compliance.ts`，约 20 行）：收益承诺、概率、保本、精确买卖点。
- 命中后让模型重写一次；仍命中则输出警告并保留原文。

**验收**：10 题红线命中 0；不误伤正常引用（如“年报披露的股息率”）。

---

### 步骤 5 · 复测与决策

- 重跑步骤 0 的 10 题，比较模式 1 vs 模式 2 的分数。
- 重跑 0-1b 探针题：计算层上线后，同一题必须从“定性回避”变成“给出可对照的数字”（基准见 8.3）。
- 记录：估值题是否可答、来源 / 基准日覆盖、口径违纪、延迟、工具选择。
- 只有在残余差距明确、且能归因到某个被砍项时，才启动对应复评：
  - 工具选不准 → 先改 description，再考虑路由
  - 数字仍编造 → 先补 envelope / 提示词，再考虑 verifier
  - skill 成本高 → 再考虑切片
- 将结论写入 `.agents/memory/decisions.md`（D12-D20），其中必须记录：
  - 计算层是否真的缩小了探针题差距（对照 0-1b 的确定性基准）
  - 有没有出现“价格分位被说成估值分位”的口径违纪
  - 10 个工具里哪几个整轮没被调用过（没被调用的就是候选删除项）

---

## 5. 验收指标（本期）

| 指标 | 目标 | 测量方式 |
| --- | --- | --- |
| 估值题可答 | A 股 3/3 | 茅台 / 招行 / 中国移动 |
| FullQuote 字段 | PE/PB/52 周/换手/量比齐全 | 对照 SDK 输出 |
| **计算题可答** | 探针题 1/1，且数字对照 0-1b 基准 | 确定性对照 |
| **corr / beta 精度** | 与手算偏差 ≤0.05 | 单测 + 基准题 |
| **stats 单测** | 8.2 的 11 条全绿 | `bun test test/stats.test.ts` |
| **Golden 回归** | 8.3 数值在容差内 | `RUN_GOLDEN=1 bun test` |
| **K 线窗口默认值** | daily/weekly/monthly 三档生效并带 `windowStart` | 代码检查 + 1 条命令 |
| **调用预算** | 单轮 ≤8 次，第 9 次触发 `TOOL_BUDGET_EXCEEDED` | 手工构造 |
| **同轮去重** | 重复同参调用不再打网络 | trace 网络计数 |
| **drift** | 快照含 `drift` 与 `action` | 工具输出检查 |
| **读取白名单** | 有读取入口时非白名单路径 100% 拒绝，`.agents/memory/` 不可读 | 8.4 守门用例 |
| asOf / source 覆盖 | 工具输出 100%，回答 ≥90% | envelope 检查 |
| 单位错误 | 0 | 抽查 20 个数字 |
| 口径违纪 | 0（含“价格分位≠估值分位”） | `rules_brief` 对照 |
| 合规红线 | 0 | 禁词表 |
| 持仓热加载 | 修改后下一轮生效 | 手工验证 |
| 报告落盘 | 1 份日报通过 `check-report.ts` + review 提示 | 命令验证 |
| 工具总数 | 10（冻结） | 代码检查 |
| p95 延迟 | ≤基线 ×1.2 | 10 题计时 |
| 代码净增 | ≤450 行（上限 550） | `wc -l` |
| 基线差距 | 10 题分数提升，且能归因 | 人工评分表 |

不做“逐字一致”“自动评分平台”这类无法稳定满足的验收。

---

## 6. 风险与边界

1. **范围反弹**：最容易发生的是“顺手把路由 / 结构化也做了”。超过代码预算即停，先复测。
2. **SDK 编码坑**：`sdk.ts` 注释写明当初走 CLI 是为绕开 Bun 编码问题；spike 未过就保留 CLI。
3. **港股代码格式**：SDK 要 `00700`，CLI 要 `hk00700`；数据层必须做前缀归一，否则静默返回空数组。
4. **持仓数据缺口**：份额 / 成本大多为 `—`；snapshot 不能输出盈亏，否则模型会编。
5. **历史估值分位**：本期拿不到，回答时必须说明“仅当前估值 + 价格分位”。
6. **Web 噪音与注入**：新闻会降低稳定性；网页内容是不可信输入。
7. **流式与报告的兼容**：报告用 markdown，不引入 JSON schema，避免破坏流式。
8. **合规**：所有输出保留“仅供参考，不构成投资建议”。
9. **计算层被当万能否**：`compute_series_stats` 只覆盖价格序列。模型最容易犯的错是拿 `pricePercentile5y` 当“估值分位”讲，或用它替代 PE/PB 判断贵贱——需在 description 与 `rules_brief` 双重约束。
10. **复权口径不一致**：若 K 线数据源改回不复权，长期收益与回撤全部失真；`adjust` 字段必须随输出返回，缺失即视为失败。
11. **并发与限流**：多标的同时取 K 线实测会 `ECONNRESET`；stats 工具必须串行 + 单标的失败降级，不能整包失败。
12. **工程记忆误注入**：`.agents/memory/decisions.md` 是编码决策（工具数、代码预算、看板），一旦进入用户侧 prompt，回答会冒出“D19 口径”这类内部代号并挤占上下文。约束：模式 2 只走白名单读取；将来若新增任何通用读文件能力，必须先把白名单写成代码校验，而不是靠约定。

---

## 7. 附录

### 7.1 文件地图

| 文件 | 作用 |
| --- | --- |
| `src/agent/index.ts` | agent 骨架 + system prompt + 模型 |
| `src/agent/tools.ts` | 10 个工具 |
| `src/agent/run.ts` | 单次问答 + REPL + 流式 |
| `src/agent/skills.ts` | skill 目录 + 全文加载 |
| `src/agent/position.ts` | position.md 注入 |
| `src/agent/config.ts` | 模型配置 |
| `src/agent/trace.ts` | 工具调用追踪 |
| `src/agent/envelope.ts` | 统一返回结构 + 错误码（新增） |
| `src/agent/compliance.ts` | 合规禁词 lint（新增） |
| `src/data/sdk.ts` | 数据层（CLI 行情、K线、搜索） |
| `src/data/dividend.ts` | 股息率 |
| `src/data/stats.ts` | 纯函数统计（收益 / 回撤 / 波动 / 相关 / beta / 价格分位，新增） |
| `test/stats.test.ts` | 统计函数确定性单测（新增，8.2） |
| `test/stats.golden.test.ts` | 紫金 vs 黄金ETF 真实场景回归（新增，8.3） |
| `test/fixtures/golden_20261030.json` | Golden 用例的收盘价快照（新增） |
| `test/agent-tools.test.ts` | 工具层治理与 envelope 测试（新增，8.4） |
| `.agents/skills/` | 25 个投资 skill（约 412KB） |
| `.agents/rules/` | 项目规则 |
| `.agents/memory/decisions.md` | 编码侧决策日志（现有 D1-D11，本期计划追加 D12-D21）；**模式 2 不读**（D21） |
| `reports/` | 历史日报，可作为基线题目来源 |
| `.agents/business/report-review/scripts/check-report.ts` | 报告结构与口径检查 |

### 7.2 当前配置（2026-10-28）

- `OPENAI_BASE_URL=https://api.deepseek.com`
- `.env` 实际 `DEFAULT_MODEL=deepseek-v4-flash`
- `.env.example` 仍为 `deepseek-flash`（需同步）
- `temperature=0.3`（硬编码）
- 无 `maxTokens` / `timeout` / `maxRetries` / `recursionLimit`（本期只补 `recursionLimit: 12`，其余不动）

### 7.3 本期会用到的 SDK 能力

| 能力 | API | 用途 |
| --- | --- | --- |
| A 股 FullQuote | `quotes.cn` | PE/PB/52 周/换手/量比 |
| 港股 / 美股 / 基金 | `quotes.hk / us / fund` | 行情与净值 |
| 指数 | `quotes.cn` | 市场总览（v1 唯一数据源） |
| K 线（前复权） | `getKline`（`fqt=1`） | 计算层输入：收益 / 回撤 / 相关 / beta |
| 全市场统计 | `batch.cn` | **v1 不用**：延迟与稳定性不可控，留待复评 |
| 北向摘要 | `northbound.summary` | **v1 不用** |
| 交易日历 | `calendar.marketStatus / prevTradingDay` | 运行时上下文 |
| 基金档案 / 净值 | `fund.profile / navHistory` | `get_fund_quote(detail)` |
| 请求治理 | `new StockSDK({ timeout, retry, rateLimit, circuitBreaker })` | 超时 / 重试 / 熔断 |

不接入：龙虎榜、涨停池、两融、大宗、板块、资金流排名、选股器、技术指标、MCP。

### 7.4 快速验证命令

```bash
# 现有行情
bun run main.ts -s sh600519 --pretty

# FullQuote 字段
bun -e 'import { StockSDK } from "stock-sdk"; const s = new StockSDK(); console.log(JSON.stringify(await s.quotes.cn(["sh600519"]), null, 2))'

# 港股代码格式
bun -e 'import { StockSDK } from "stock-sdk"; const s = new StockSDK(); console.log((await s.quotes.hk(["00700"]))[0]?.name)'

# 交易日状态
bun -e 'import { StockSDK } from "stock-sdk"; const s = new StockSDK(); console.log(JSON.stringify(s.calendar.marketStatus("cn")))'

# 报告输出
bun run main.ts --ask "生成今日持仓日报" --out reports/daily_report_test.md

# 报告结构检查
bun run .agents/business/report-review/scripts/check-report.ts reports/daily_report_test.md

# 计算层单测（确定性）
bun test test/stats.test.ts

# 计算层基准题（对照 0-1b）
bun run main.ts --ask "紫金矿业和黄金ETF这两年谁更强，相关性多少" --agent
```

### 7.5 决策记录建议

- D12 · 模式 2 以“数据地基 + 口径 + 计算层 + 4 个复合工具”为 v3.1 范围
- D13 · 行情默认走 SDK FullQuote，统一 envelope（source / asOf / unit）
- D14 · `rules_brief` 与 `position.md` 热加载作为口径基线
- D15 · 持仓快照只输出可验证字段，缺份额不输出盈亏
- D16 · WebSearch 作为外部信息入口，内容按不可信数据处理
- D17 · 结构化输出 / 路由 / verifier / eval 平台暂缓，按复评条件启动
- D18 · 计算层收敛为单个 `compute_series_stats`，明确拒绝 `run_js` 代码沙箱
- D19 · K 线统一前复权口径，`adjust: "qfq"` 随输出返回；价格分位不得表述为估值分位
- D20 · 工具总数到 10 冻结；`market_overview` v1 缩范围，用省下的复杂度换计算层
- D21 · 模式 2 只读 `position.md` + `.agents/skills/` + `.agents/rules/agent_brief.md`；**不读 `.agents/memory/`**，工程记忆与投顾上下文隔离；不开放通用 `read_file`

---

## 8. 测试用例

> 进度跟踪统一用第 2.1 节的勾选清单，**不单独建 `todo.md`**：两份状态必然漂移，验收细节以本文档各节为准。

### 8.1 分层原则

| 层 | 内容 | 自动执行 | 依赖网络 |
| --- | --- | --- | --- |
| L1 单元测试 | `src/data/stats.ts` 纯函数 | 是，`bun test` 必过 | 否 |
| L2 工具层测试 | 窗口 / 预算 / 去重 / envelope / drift / 合规 | 是，不打 LLM | 可 mock |
| L3 Golden 回归 | 真实场景（紫金 vs 黄金ETF） | 默认 `skip`，`RUN_GOLDEN=1` 触发 | 否（读 fixture 快照） |
| L4 人工基线 | 10 题 + 探针题 | 否 | 是 |

关键设计：**Golden 用例把当天 bars 落盘成 fixture，测试读快照而不是打网络**——这样它既是真实场景回归，又是确定性的，不会因为行情更新而每天变红。

### 8.2 L1 单元测试（`test/stats.test.ts`）

| # | 用例 | 构造方式 | 期望 |
| --- | --- | --- | --- |
| 1 | 同序列 | `a = b` | `corr = 1.000`、`beta = 1.00` |
| 2 | 两倍弹性 | `b` 的各期收益 = `2 × a` 的收益 | `corr = 1.000`、`beta = 2.00` |
| 3 | 反向 | `b` 的收益 = `-a` 的收益 | `corr = -1.000`、`beta = -1.00` |
| 4 | 基准零波动 | `a` 全程不变 | `corr` / `beta` 返回 `null`（分母为 0），不抛异常 |
| 5 | 最大回撤 | 100 → 120 → 90 → 110 | `maxDrawdownPct = -25.0` |
| 6 | 区间收益 | 100 → 177.1 | `totalReturnPct = 77.1` |
| 7 | 年化波动 | 12 个月收益全为 +1% | `annualizedVolPct ≈ 0`（±1e-9） |
| 8 | 价格分位 | 窗口最低点 / 最高点 | 分别返回 `0` / `100` |
| 9 | 数据不足 | 0 条、1 条、含 `NaN` | 指标 `null`，不抛异常 |
| 10 | 窗口截断 | 30 条 bar，`window = 24` | 只用最后 24 条，`start` 对应第 7 条 |
| 11 | 复权缺失 | bars 不带 `adjust` 标记 | 指标照算，返回 `adjust: "unknown"` + `warning` |

### 8.3 L3 Golden 回归（`test/stats.golden.test.ts`）

**用例：紫金 vs 黄金ETF · monthly · 24**

- 输入：`codes = ["sh601899", "sh518880"]`、`period = "monthly"`、`window = 24`
- 数据来源：`test/fixtures/golden_20261030.json`（2026-10-30 收盘快照，含两条前复权收盘价序列）
- 期望值（容差：比率类 ±0.05，百分比类 ±0.5pp）：

| 指标 | 紫金 601899 | 黄金ETF 518880 |
| --- | --- | --- |
| `totalReturnPct` | **77.1** | **33.8** |
| `maxDrawdownPct` | **-37.2** | **-25.8** |

| 对比项 | 期望 |
| --- | --- |
| `corr` | **0.64** |
| `beta` | **1.34** |
| `excessReturnPct` | **43.3** |
| `window.bars` | 25（起点 2024-10） |
| `adjust` | `"qfq"` |

- 触发方式：`RUN_GOLDEN=1 bun test test/stats.golden.test.ts`；日常 `bun test` 自动跳过。
- 维护规则：fixture 冻结不改；若结果不符，先判断是**实现错误**还是**口径变更**（复权 / 周期 / 窗口定义），确认口径变了才更新 fixture，并在决策日志追加一条。
- 用途：这道用例同时是 0-1b 探针题的评分基准。

### 8.4 L2 工具层测试（`test/agent-tools.test.ts`）

| # | 用例 | 做法 | 期望 |
| --- | --- | --- | --- |
| 1 | K 线默认窗口 | 分别以 daily / weekly / monthly 调用 | 250 / 104 / 120，且返回 `windowStart` |
| 2 | 调用预算 | 同一轮连续 9 次工具调用 | 第 9 次返回 `TOOL_BUDGET_EXCEEDED`，不抛异常 |
| 3 | 同轮去重 | 同参调用两次（注入网络计数桩） | 第二次命中 memo，网络计数不增加 |
| 4 | 持仓漂移 | 用 `position.md` 快照 fixture | `drift = 当前占比 - 目标占比`，`action` 正确 |
| 5 | envelope | 检查任一工具输出 | 含 `source` / `asOf` / `unit`，无裸数字 |
| 6 | 合规 lint | "大概率上涨" / "年报披露的股息率为 3%" | 前者命中，后者不命中 |
| 7 | 搜索未配置 | 无 `SEARCH_API_KEY` 时调用 `web_search` | `ok:false` + `SEARCH_NOT_CONFIGURED`，不假装能搜 |
| 8 | 读取白名单（守门用例） | 对全部文件读取入口断言路径白名单 | 非白名单返回 `PATH_NOT_ALLOWED`；本期无读取工具时标记 `skip`，一旦新增读取能力即启用 |

### 8.5 执行顺序（测试先行）

1. 先写 8.2 的 11 条单测 → `bun test` 全红；
2. 写 `src/data/stats.ts` → 转绿；
3. 再补 8.3 的 fixture 与 Golden 用例 → 转绿；
4. 之后才动工具层（8.4），每条用例对应 2.1 的一个勾选项。

### 8.6 明确不写的测试

- 不断言 LLM 回答文本（与 v3.1.2 砍掉 eval 的理由一致）；
- 不做跨日快照对比（行情一变就红，无信号）；
- 不做性能基准，p95 只按 0-1 人工计时记录。
