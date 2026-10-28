# Agent 回答质量升级方案（模式 2 · 独立 CLI）

> 版本：v3.1.2（精简版）
> 定位：数据地基 + 口径 + 3 个复合工具
> 初稿：2026-10-25
> v3.1.1：2026-10-27（全量方案）
> v3.1.2：2026-10-28（按代码体量与维护成本缩减）
> 状态：方案稿，未落码
> 范围：`src/agent/`、`src/data/`、`.env`、`.agents/`
> 目标：缩小模式 2（`bun run main.ts --agent`）与模式 1（harness）的回答质量差距
> 非目标：不做团队级 agent 平台；不引入路由 / verifier / eval 平台；不改变模式 1 工作流

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

### 0.1 三个硬缺口

| 缺口 | 现状证据 | 影响 |
| --- | --- | --- |
| 估值字段 | CLI 行情只有 8 个业务字段，无 PE/PB/52 周/换手/量比；SDK `quotes.cn` 已具备 | “贵不贵 / 分位 / 回撤”类问题只能回避 |
| 外部信息 | 6 个工具无搜索 | 新闻 / 政策 / 异动归因无法回答 |
| 规则上下文 | 未读 D9-D11；system prompt 是模块常量；无日期 / 交易日 | 口径违纪、持仓不更新、“今天”指错 |

### 0.2 本期定义

**v3.1.2 = 数据地基 + 口径 + 3 个复合工具（market_overview、portfolio_snapshot、web_search）。**

只保留原方案约 1/3 的内容；其余进入“暂缓”清单，附复评条件。

---

## 1. 诊断（复核版）

### 1.1 体量基线

| 指标 | 实测 |
| --- | --- |
| `src/` 全部 TypeScript | 1714 行 |
| `src/agent/` | 748 行 |
| 工具 | 6 个 |
| skill | 25 个，合计 412KB，均值 16.5KB，最大 28KB |
| 评估 | 无 `eval/`；只有 `test/` 下的 config / position / skills / sdk |
| 日志 | 无持久化，仅终端 trace |

### 1.2 事实修正

| 事项 | 实测 |
| --- | --- |
| `position.md` | 已存在，6.3KB；14 个持仓行中只有恒生科技ETF填了份额与成本（≈35,700 / ≈0.565），其余为 `—` |
| 模型 | `.env` 实际 `deepseek-v4-flash`；`.env.example` 仍是 `deepseek-flash` |
| 选股能力 | `screener` 不是命名空间；`screen()` / `backtest()` 是本地函数，需先取 `batch.cn/hk/us` |
| 港股代码 | SDK `quotes.hk` 必须传 `00700`，传 `hk00700` 返回空数组；CLI 用法是 `hk00700` |
| 合规脚本 | `check-report.ts` 有口径词（年内 / 今年 / YTD / 近1年 / 近10年 / 分位）与免责声明检查；**没有**收益承诺 / 概率类禁词，需要补一张小词表 |
| 工具数量 | 原方案累加为 18-20 个，与“10-15”自相矛盾；本稿定为 9 个 |

### 1.3 数据能力边界（提前承认）

- **历史 PE 分位拿不到**：SDK 只有当前 `pe/pb`，没有历史序列；`get_kline` 只能给价格历史。本期估值只能给“当前 PE/PB + 价格分位 + 同业对比”。
- **港美股无 PE/PB**：`HKQuote` 不含估值字段，`USQuote` 形状也不同；缺失必须显式 `null`。
- **持仓盈亏大多算不出**：`position.md` 缺份额与成本；`portfolio_snapshot` v1 只能输出“目标金额 / 当前金额（用户维护）/ 占比 / 超限”，不能输出“实时市值 / 盈亏”。

---

## 2. 范围

### 2.1 本期做（12 项）

1. 10 题基线（模式 1 vs 模式 2，只用现有 6 个工具）
2. 强模型 A/B（`--model` 开关）
3. SDK 切换 spike
4. 行情异步化（spike 通过后才删 `execFileSync`）
5. FullQuote（PE/PB/52 周/换手/量比）
6. 工具返回 envelope（source / asOf / unit / error）
7. 当前日期 + 交易日状态
8. `position.md` 热加载
9. `rules_brief`（D9-D11 蒸馏）
10. `get_market_overview` + `get_portfolio_snapshot`
11. `web_search`（简单注入防护）
12. `--out` 报告输出 + 合规 lint + 复测

### 2.2 本期不做

见修订说明第 4 节；所有砍掉项都有复评条件，不在本期写代码、不建目录、不占 prompt。

### 2.3 代码预算

- `src/agent/` 净增 ≤300 行，硬上限 400 行（748 → ≤1148）。
- 新增模块最多 2 个：`envelope.ts`、`compliance.ts`；其余改造现有文件。
- 超过预算即触发范围复审，不再加功能。

---

## 3. 目标工具集（9 个）

| # | 工具 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | `get_stock_quote` | 改造 | 替换实现为 FullQuote，不新增别名 |
| 2 | `get_fund_quote` | 保留 | 可选 `detail` 参数返回基金档案 / 净值历史 |
| 3 | `get_dividend_yield` | 保留 | 强制带 `yield_basis` |
| 4 | `get_kline` | 保留 | 长窗口用 monthly，不改结构 |
| 5 | `search_stock` | 保留 | 名称转代码，兼做歧义澄清 |
| 6 | `load_skill` | 保留 | 全文加载，不做切片 |
| 7 | `get_market_overview` | 新增 | 指数 / 涨跌家数 / 成交额 / 北向摘要 |
| 8 | `get_portfolio_snapshot` | 新增 | position 解析 + 金额 / 占比 / 超限，不编造盈亏 |
| 9 | `web_search` | 新增 | 新闻 / 公告 / 政策，返回 URL + 日期 |

不新增 `write_report` 工具：报告用 `--out` 输出，避免给模型开放任意写文件权限。

约束：

- 单轮工具调用 ≤8 次。
- 新增工具必须写清 `description`、参数、单位、来源、as-of。
- 超过 9 个工具需要先删一个。

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
- 评分用 0/1/2 三档，记录在 `eval/baseline_20261028.md`（Markdown 表格即可，不建平台）。
- 明确：**LLM 输出不追求逐字一致**；确定性检查只用于工具输出与结构项。

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

---

### 步骤 2 · 两个复合工具

#### 2-1 `get_market_overview`

返回：

- 指数：上证、深证、创业板、沪深 300、中证 500
- 涨跌家数、涨停 / 跌停数（`batch.cn` 聚合，只返回统计值）
- 两市成交额
- 北向摘要（可选，`northbound.summary`）
- `asOf`、`source`、`missing`

**验收**：一次调用覆盖 5 类数据；不把全市场行情灌进上下文。

#### 2-2 `get_portfolio_snapshot`

解析 `position.md`，输出：

| 字段 | 来源 | 缺失处理 |
| --- | --- | --- |
| 代码 / 名称 | 持仓表 | 缺失跳过并提示 |
| 目标金额 | 持仓表 | 缺失标 `null` |
| 当前金额 | 持仓表（用户维护） | 缺失标 `null` |
| 目标占比 / 当前占比 | 由金额计算 | 总量为 0 时不计算 |
| 单标的金额上限 | 持仓表 | 缺失标 `null` |
| 份额 / 成本价 | 持仓表 | 缺失标 `null` |
| 市值 / 盈亏 | 仅当份额与成本都存在时计算 | 否则 `null` + 提示 |

约束：

- 不把“当前金额”当实时市值；标注 `asOf = position.md mtime`。
- 不编造盈亏；`position.md` 缺失时返回可执行提示。
- 文档里不承诺“实际占比 / 盈亏”，除非份额已补全。

**验收**：一次调用返回全部持仓；14 行中只有恒生科技ETF有盈亏，其余显式 `null`。

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
- 不新增写文件工具；`write_report` 工具留到多文件输出场景再考虑。

**验收**：报告落盘；`check-report.ts` 通过；终端仍可见回答。

---

### 步骤 4 · 合规 lint

- 复用 `check-report.ts` 的口径词与免责声明检查。
- 新增一张小词表（`src/agent/compliance.ts`，约 20 行）：收益承诺、概率、保本、精确买卖点。
- 命中后让模型重写一次；仍命中则输出警告并保留原文。

**验收**：10 题红线命中 0；不误伤正常引用（如“年报披露的股息率”）。

---

### 步骤 5 · 复测与决策

- 重跑步骤 0 的 10 题，比较模式 1 vs 模式 2 的分数。
- 记录：估值题是否可答、来源 / 基准日覆盖、口径违纪、延迟、工具选择。
- 只有在残余差距明确、且能归因到某个被砍项时，才启动对应复评：
  - 工具选不准 → 先改 description，再考虑路由
  - 数字仍编造 → 先补 envelope / 提示词，再考虑 verifier
  - skill 成本高 → 再考虑切片
- 将结论写入 `.agents/memory/decisions.md`（D12-D17）。

---

## 5. 验收指标（本期）

| 指标 | 目标 | 测量方式 |
| --- | --- | --- |
| 估值题可答 | A 股 3/3 | 茅台 / 招行 / 中国移动 |
| FullQuote 字段 | PE/PB/52 周/换手/量比齐全 | 对照 SDK 输出 |
| asOf / source 覆盖 | 工具输出 100%，回答 ≥90% | envelope 检查 |
| 单位错误 | 0 | 抽查 20 个数字 |
| 口径违纪 | 0 | `rules_brief` 对照 |
| 合规红线 | 0 | 禁词表 |
| 持仓热加载 | 修改后下一轮生效 | 手工验证 |
| 报告落盘 | 1 份日报通过 `check-report.ts` | 命令验证 |
| 工具总数 | 9 | 代码检查 |
| p95 延迟 | ≤基线 ×1.2 | 10 题计时 |
| 代码净增 | ≤300 行（上限 400） | `wc -l` |
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

---

## 7. 附录

### 7.1 文件地图

| 文件 | 作用 |
| --- | --- |
| `src/agent/index.ts` | agent 骨架 + system prompt + 模型 |
| `src/agent/tools.ts` | 6 个工具 |
| `src/agent/run.ts` | 单次问答 + REPL + 流式 |
| `src/agent/skills.ts` | skill 目录 + 全文加载 |
| `src/agent/position.ts` | position.md 注入 |
| `src/agent/config.ts` | 模型配置 |
| `src/agent/trace.ts` | 工具调用追踪 |
| `src/data/sdk.ts` | 数据层（CLI 行情、K线、搜索） |
| `src/data/dividend.ts` | 股息率 |
| `.agents/skills/` | 25 个投资 skill（约 412KB） |
| `.agents/rules/` | 项目规则 |
| `.agents/memory/decisions.md` | 决策日志 D1-D11 |
| `reports/` | 历史日报，可作为基线题目来源 |
| `.agents/business/report-review/scripts/check-report.ts` | 报告结构与口径检查 |

### 7.2 当前配置（2026-10-28）

- `OPENAI_BASE_URL=https://api.deepseek.com`
- `.env` 实际 `DEFAULT_MODEL=deepseek-v4-flash`
- `.env.example` 仍为 `deepseek-flash`（需同步）
- `temperature=0.3`（硬编码）
- 无 `maxTokens` / `timeout` / `maxRetries`

### 7.3 本期会用到的 SDK 能力

| 能力 | API | 用途 |
| --- | --- | --- |
| A 股 FullQuote | `quotes.cn` | PE/PB/52 周/换手/量比 |
| 港股 / 美股 / 基金 | `quotes.hk / us / fund` | 行情与净值 |
| 指数 | `quotes.cn` | 市场总览 |
| 全市场统计 | `batch.cn` | 涨跌家数聚合，只返回统计值 |
| 北向摘要 | `northbound.summary` | 市场总览（可选） |
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
```

### 7.5 决策记录建议

- D12 · 模式 2 以“数据地基 + 口径 + 3 个复合工具”为 v3.1 范围
- D13 · 行情默认走 SDK FullQuote，统一 envelope（source / asOf / unit）
- D14 · `rules_brief` 与 `position.md` 热加载作为口径基线
- D15 · 持仓快照只输出可验证字段，缺份额不输出盈亏
- D16 · WebSearch 作为外部信息入口，内容按不可信数据处理
- D17 · 结构化输出 / 路由 / verifier / eval 平台暂缓，按复评条件启动
