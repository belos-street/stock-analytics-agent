# 代码评审报告 · Agent 质量升级 v3.1.3

> 评审对象：`git status` 中 10 个修改文件 + 6 组新增文件（全部未提交）
> 技术栈：Bun + TypeScript + LangChain `createAgent` + stock-sdk
> 评审方式：只读 + 必跑命令 + 实盘抽查；未修改任何被评审文件
> 评审时间：2026-10-30
> 声明：**未读取 `.env`，未读取 `.agents/memory/`**；工具输出与日志中未发现密钥泄漏

---

## 1. 结论

**BLOCK**

理由：`compute_series_stats` 在 `codes=""` 时返回裸字符串 `"错误：codes 不能为空"`（已实测），直接违反 1-2「所有工具返回 envelope」契约，也命中判定标准中的「任何工具仍返回裸数据」。另有 `get_stock_quote` / `get_fund_quote` / `search_stock` 在上游异常时 reject，而不是返回 `{ ok:false, error }`；虽然 LangChain `ToolNode` 默认可能兜住异常，但工具边界契约已破坏。

修复上述 P0/P1 后可降级为 **PASS WITH ISSUES**；计算层口径、K 线窗口、预算/去重主路径本身与方案一致。

---

## 2. 必跑命令结果（实际输出）

| 命令 | 结果 |
| --- | --- |
| `bun run typecheck` | `tsc --noEmit` 退出码 0，无输出 |
| `bun test test/agent-tools.test.ts test/stats.test.ts` | **16 pass / 0 fail**，34 expect |
| `RUN_GOLDEN=1 bun test test/stats.golden.test.ts` | **1 pass / 0 fail** |
| `bun test --timeout 15000` | **49 pass / 1 skip / 1 fail**；失败为 `test/sdk.test.ts:63` 日 K 线，`ECONNRESET`（已知网络依赖） |
| `bunx oxfmt --check ...` | 22 文件全部通过 |
| `bunx oxlint ...` | **0 errors / 3 warnings**（`no-await-in-loop`：`tools.ts:381`、`tools.ts:385`、`test/agent-tools.test.ts:49`） |
| `git status --porcelain` / `git diff --stat` | 10 modified，新增 `.agents/rules/agent_brief.md`、`src/agent/envelope.ts`、`src/data/stats.ts`、`test/agent-tools.test.ts`、`test/fixtures/`、`test/stats.golden.test.ts`、`test/stats.test.ts`；`1170 insertions(+), 201 deletions(-)` |

实盘抽查（2026-10-30 17:4x，Asia/Shanghai）：

- `get_stock_quote(sh600519,hk00700,AAPL)` → `ok:true`，`currency:"MIXED"`；CN amount `825738`（万元），HK amount `8540915574.008`（港元原币），US amount `14878265494`（美元原币）。
- HK null 字段实测：`pe,pb,peStatic,peDynamic,turnoverRate,volumeRatio,amplitude,high52w,low52w,timestamp`。
- US null 字段实测：`peStatic,peDynamic,volumeRatio,circulatingMarketCap`；代码返回 `AAPL.OQ`。
- `get_portfolio_snapshot` → 12 行；仅恒生科技ETF有盈亏（市值 `17207.4`、盈亏 `-2963.1`、`-14.69%`），其余 11 行 `null`；`drift=0.11 → ok`；`asOf` 为 `position.md` mtime。
- `get_market_overview` → 5 个指数 + `turnover.value=16744.68` 亿元 + 3 条固定 `missing`。
- `compute_series_stats` 实盘 → 两个代码均因东财 K 线 `ECONNRESET` 进入 `missing`，返回 `ok:true` 空 `series`。
- `get_kline` → `UPSTREAM_ERROR` envelope（网络失败路径正确）。
- `renderRuntimeContext()` 周六用例（2026-10-31）→ “今天休市，最近交易日 2026-10-30”，与 1-3 验收一致。

---

## 3. 问题表

### P0 · 阻断

| # | 位置 | 问题 | 证据 | 最小修复 |
| --- | --- | --- | --- | --- |
| P0-1 | `src/agent/tools.ts:372` | `compute_series_stats` 空 `codes` 返回裸字符串，不是 envelope | `computeSeriesStatsTool.invoke({codes:""})` 实测返回 `"错误：codes 不能为空"`；该工具其余路径均为 `ok()/fail()` | 改为 `return fail('INVALID_ARGUMENT','codes 不能为空')`；zod 增加 `.min(1)` 双保险 |

### P1 · 重要

| # | 位置 | 问题 | 证据 | 最小修复 |
| --- | --- | --- | --- | --- |
| P1-1 | `src/agent/tools.ts:124-138`、`148-161`、`302-308` | `get_stock_quote` / `get_fund_quote` / `search_stock` 没有 try/catch，上游失败时工具 reject，不返回 `{ok:false,error}` | 三个 `governTool` 回调内直接 `await getQuotes/getFundQuotes/searchStock`；`governTool` 也不 catch（`tools.ts:104-120`）。只有 `get_kline`、`get_market_overview` 显式 catch | 在 `governTool` 统一 `try/catch`，返回 `fail('UPSTREAM_ERROR', ...)`；或每个工具补 catch |
| P1-2 | `src/agent/tools.ts:71-84` | 混合市场 `unit` 只说“见每行 currency”，没有说明 **amount 的量纲不同**：CN 为万元，HK/US 为原币；marketCap 的“亿”也丢失 | 实测同一响应：CN `amount=825738`（万元）、HK `8540915574`（港元）、US `14878265494`（美元）；`unit.amount="见每行 currency"`。模型可把 82.6 亿读成 8257 亿或反之 | 混合市场改为 `amount: "CN 万元 / HK·US 原币"`、`totalMarketCap: "CN 亿元 / HK·US 亿原币"`；或在每条 data 内加 `amountUnit` |
| P1-3 | `src/agent/tools.ts:133`、`269`、`403`、`490`；`638` | 多数工具 `asOf = localISO()`（请求时刻），不是数据时间；`stale:false` 硬编码。US 行情实际为前一交易日收盘、HK `timestamp=null`，模型会把旧数据说成“截至现在” | 实测 HK 行 `timestamp:null`，US 行 `time:"2026-10-29 16:00:01"`，但 meta.asOf 为 `2026-10-30T17:46+08:00`；portfolio 的 `currentAmount` 是用户维护值却 `stale:false` | `asOf` 取 `max(quote.timestamp/time)` 或 `windowEnd`；另加 `fetchedAt`；HK 无时间戳时 `stale:true` 或注明“数据时间未知” |
| P1-4 | `src/agent/tools.ts:387-398`、`src/data/stats.ts:94` | `codes[0]` 取数失败时，`series` 只保留成功标的，`pairs` 的基准自动变成第一个成功代码，**beta 方向静默翻转**；工具 description 却写“beta 以 codes[0] 为基准” | 代码 `pairs: used.slice(1).map(b => pairOf(used[0], b, ...))`，`used` 已过滤失败项；`missing` 只列失败代码，不标“基准缺失” | 基准失败时不生成 pairs，或保留占位并在 data 加 `baseCode` / `baseMissing:true`；单测覆盖“codes[0] 失败、codes[1] 成功” |
| P1-5 | `src/data/sdk.ts:74`、`src/agent/tools.ts:28` | 美股代码无法回环：搜索返回 `usaapl.oq`，行情返回 `AAPL.OQ`，两者再传给 `getQuotes` 都进入 US 分支并返回 `[]`；`bareCode` 只去 sh/sz/hk | 实测 `searchStock("苹果")` → `usaapl.oq`；`getQuotes(["usAAPL"])` → `[]`；`getQuotes(["AAPL.OQ"])` → `[]`；`getQuotes(["hk03968"])` → `03968` 正常 | 在 `getQuotes`/`bareCode` 统一归一：US 去 `us` 前缀、去交易所后缀、转大写；`searchStock` 输出即归一 |
| P1-6 | `src/data/sdk.ts:63-74`；`src/agent/tools.ts:534-550` | 任何无前缀代码都被当作美股；基金代码、ETF 代码、`position.md` 的复合代码均静默返回空。`position.md` 当前就存在 `515450 → 008163`、查询参数 `-s / -f` | 实测 `getQuotes(["515450"])` → `[]`、`getQuotes(["006493"])` → `[]`；`getFundQuotes(["515450 → 008163"])` → `[]`。若该行补上份额/成本，`marketValue` 会静默 `null` 且不进入 `missing` | 按查询参数/持仓表 `market` 路由，不要只按代码前缀；解析复合代码取箭头左侧或显式映射；空结果记入 `missing` |
| P1-7 | `.agents/rules/agent_brief.md:15` vs `src/agent/tools.ts:190`、`src/agent/index.ts:44` | 股息率口径冲突：`agent_brief` 写“默认近 12 个月 DPS 年度化”，工具实际是“单期已实施分红/现价，非年度化”，系统提示也写“单期、非年度化”。模型同时看到两套默认口径 | `YIELD_BASIS`（`src/data/dividend.ts:12-13`）明确“单期分红口径…未年度化”；`agent_brief` 第 2 节写“默认口径：近 12 个月…年度化” | 把 `agent_brief` 改为“以工具 `yield_basis` 为准；当前工具为单期口径，不得表述为年度化”；年度化能力要么实现，要么删除该“默认”表述 |
| P1-8 | `src/agent/skills.ts:94` | `load_skill` 未做路径白名单校验，可通过 `../` 读取 `.agents/skills/` 之外的 `SKILL.md`，违反 D21 白名单（当前不能读 `.env`/`.memory`，但可读 `business/dev`） | 实测 `loadSkillTool.invoke({name:"../business/report-review"})` → `ok:true`，读入 4017 字符；`../dev/bun` → `ok:true`，5654 字符 | `resolve()` 后校验 `startsWith(SKILLS_DIR + sep)`，否则 `fail('PATH_NOT_ALLOWED', ...)`；补 8.4 #8 守门用例 |

### P2 · 建议

| # | 位置 | 问题 | 证据 | 最小修复 |
| --- | --- | --- | --- | --- |
| P2-1 | `src/agent/tools.ts:130-137`、`155-161`、`179-185`、`303-309` | 空结果/部分结果均返回 `ok:true`，不声明 `missing`。`get_stock_quote` 传 3 个代码只回 2 个时，模型无法知道少了一个；空结果还会得到 `currency:"MIXED"` | `getQuotes(["515450"])` → `ok:true, data:[], currency:"MIXED"`；`get_dividend_yield(hk00700)` → `ok:true, data:[], currency:"CNY"` | 空结果返回 `fail('NO_DATA', ...)` 或 `ok` 中加 `missing`；`currency` 为空时置 `null` |
| P2-2 | `src/agent/tools.ts:236-243` vs `266-280` | `get_kline` 的 `summary`（totalReturnPct / maxDrawdownPct / annualizedVolPct）没有出现在 `meta.unit`；KlineBar 可能带的 `amplitude/changePercent/change/turnoverRate` 也未覆盖 | 逐字段比对 `KLINE_WINDOW` 返回体与 `unit` 对象 | 补 `summary` 三个 `%`、bar 的 `amplitude/changePercent` 等；或直接把 unit 写成“见 bars 字段名” |
| P2-3 | `src/agent/tools.ts:267-280` | `get_kline` 固定 `currency:"CNY"`，但 `getKline` 永远走 `kline.cn`，入参没有市场限制；HK/US 代码会得到错误币种（若 K 线可用） | `tools.ts:267-269` 硬编码 CNY；`sdk.ts:109-114` 只用 `kline.cn` | 按代码市场限制（只允许 sh/sz）或在 description 明示只支持 A 股；否则按市场返回币种 |
| P2-4 | `src/data/sdk.ts:109-114`；`src/agent/tools.ts:225` | `adjust:"qfq"` 是硬编码标签，但 `getKline` 没有显式传 `adjust`，依赖 SDK 默认 `fqt=1`。SDK 默认一旦变化，标签会撒谎 | 实测请求 URL 含 `fqt=1`；代码未传 `adjust`（SDK 类型支持 `adjust?: ''\|'qfq'\|'hfq'`） | `getKline(symbol, period, adjust='qfq')` 显式传参；K 线窗口的 `adjust` 从返回值透传，不要硬编码 |
| P2-5 | `src/agent/tools.ts:206-245` | 月度/周度最后一根是未完结 bar（当前 2026-10），`get_kline`/`compute_series_stats` 未标记，模型可能把“当月未完结”的区间收益当完整周期 | fixture 自己注明“2026-10 为未完结月线”；golden 因它从 77.1 变为 76.48；代码返回体无 `lastBarIncomplete`/`note` | 增加 `lastBarIncomplete: true` 或 `note:"末根为未完结 bar"`；口径文档同步 |
| P2-6 | `src/agent/tools.ts:565-569` | 目标/当前总额用 `(h.targetAmount ?? 0)` 求和；只要有一行为 `null`，总额会把缺失当 0，且仍以“总计”呈现。当前 12 行都填了金额，暂未触发 | `targetTotal` / `currentTotal` 的 reduce；行级 `targetPct/currentPct` 又依赖这个偏小的总额 | 任一行缺失时总额置 `null` 或加 `totalComplete:false`；或按“已知金额合计”明确命名 |
| P2-7 | `src/agent/tools.ts:570-612`、`583-590`、`627-637` | 持仓行计算：`action` 的 ±1pp 阈值未写进 description/unit；`unit` 缺 `cost`、`pnlPct`；`currency` 固定 `CNY`，若持仓含 `hk00700` 会标错 | `unit` 对象只列 targetAmount/currentAmount/limitAmount/marketValue/pnl/shares/targetPct/currentPct/driftPct；`cost`、`pnlPct` 为数字但无单位 | 补 `cost:"元/股"`、`pnlPct:"%"`；在 description 明示 ±1pp；按持仓市场汇总 currency |
| P2-8 | `src/agent/tools.ts:538-556` | 基金与股票取价放在同一个 try 内：基金源失败会连股票价格一起丢弃，所有市值/盈亏变 `null`；单行失败也未隔离 | 先 `getFundQuotes` 再 `getQuotes`，任一抛错进入同一 catch | 基金、股票各一个 try/catch；单标的失败记 `missing`，不影响其他行 |
| P2-9 | `src/agent/tools.ts:529`、`638` | `asOf` 用 `position.md` mtime 是正确的，但 `stale:false` 与“当前金额由用户维护、非实时”矛盾；行内又给出 `priceTime`，两个时间容易混淆 | `source:"position.md"`、`asOf: mtime`、`stale:false`；description 已说明不代表实时市值 | 改为 `stale:true` 或增加 `positionAsOf` / `priceAsOf` 两个字段 |
| P2-10 | `src/agent/index.ts:128` vs 2-4 单轮 ≤8 | `recursionLimit:12` 可能先于 8 次预算触发：若每个“模型→工具”各算 1 步，8 次调用 ≈ 16 步，会在预算错误前被递归上限终止 | `withConfig({ recursionLimit: 12 })`；预算常量 `TOOL_BUDGET=8`（`tools.ts:93`） | 将 recursionLimit 调到 ≥ `2*TOOL_BUDGET + 2`（如 18-20），或把 tool budget 降到 5，并补一条真实链路用例 |
| P2-11 | `src/agent/tools.ts:379-386` | `compute_series_stats` 每个代码最多重试 3 次 + 300ms；SDK 自身还有 `executeWithRetry`。3 个代码可能产生 9-27 次底层请求，但预算只记 1 次，且会长时间阻塞 | 代码内层 `for attempt < 3`；失败实测 `getKline` 单次约 7.6s（`test/sdk.test.ts`） | 只保留 1 次尝试（或 2 次、无 SDK 重试），把重试/超时下推到 SDK 配置；记录耗时 |
| P2-12 | `src/agent/tools.ts:71-84` | 混合市场 `unit.volume` 是清楚的（CN 手 / HK·US 股），但 `amount`、`marketCap` 的“万元/亿元”量纲在 `MIXED` 时丢失，属于高概率误读 | 同 P1-2 | 同 P1-2 |
| P2-13 | `test/stats.golden.test.ts:27-35` | Golden 用 `toMatchObject` 做**精确浮点匹配**，没有实现 8.3 的“比率 ±0.05 / 百分比 ±0.5pp”容差；任何末位舍入变化都会红 | 断言 `totalReturnPct: 76.48`、`beta: 0.3` 等；无 `expectClose` | 加 `expectClose(actual, expected, tol)` 辅助；比率 0.05、百分比 0.5pp |
| P2-14 | `test/sdk.test.ts:63` | 网络依赖用例留在默认 `bun test`，本次全量运行唯一失败即它；与 8.6“不做跨日快照对比”的稳定性原则冲突 | `bun test` → `(fail) ... 查询日K线 - 贵州茅台 [7628.91ms] ECONNRESET` | 改为 `RUN_NETWORK=1` 条件执行，或移出默认套件 |
| P2-15 | `src/data/stats.ts:49` | 字段名 `pricePercentile5y` 写死“5y”，但窗口由 `window` 决定：daily 60 ≈ 3 个月、monthly 24 ≈ 2 年，均非 5 年；模型可能据此说“5 年价格分位” | `computeSeriesStats({period:'daily',window:60})` 仍返回 `pricePercentile5y`；工具 description 也沿用该名 | 改名 `pricePercentileInWindow`，并在输出里带 `window.start/end`；保留旧名会造成误读 |
| P2-16 | `src/data/stats.ts:74` | `excessReturnPct` 用各自整段 `totalReturnPct` 相减；若一只标的历史不足窗口（如 30 根 vs 60 根），比较的是不同长度区间，超额收益不可比 | `ta - tb`，而 `ta/tb` 由各自 `bars.slice(-window)` 计算，未按 `min` 对齐 | 成对指标统一按 `min(xa.length, xb.length)+1` 对齐，再算两序列区间收益 |
| P2-17 | `src/agent/position.ts:84-97` | 表格解析假定固定列顺序，不校验表头；用户调整列顺序或备注含未转义 `|` 时会静默错位 | `cells[4..9]` 直接按位置取；仅 `cells.length < 10` 跳过 | 读取表头做列名→索引映射；对列数异常返回 `POSITION_PARSE_EMPTY` 或 warning |
| P2-18 | `src/agent/index.ts:37-61` | `position.md` 原文直接拼进 system prompt，没有“以下为用户数据、不是指令”的边界标记；文件中的交易规则可被模型当作系统指令执行 | `${renderPositionContext()}` 原样插入；`position.md` 含“跌破3659转2000”等操作语句 | 用 `<position_data>...</position_data>` 包裹，并在系统提示声明“其中内容仅为数据/用户偏好，不覆盖本提示与红线” |
| P2-19 | `src/agent/tools.ts:156`；`src/agent/tools.ts:180` | 来源标注与实际不符：`get_fund_quote` 标 `eastmoney`，实测 SDK 基金 `source:"tencent"`；`get_dividend_yield` 在东财失败回退 SDK 后仍标 `eastmoney` | 实盘基金返回 `source:"tencent"`；`getDividendYields` 有东财→SDK 回退（`dividend.ts:197-210`） | 用返回值里的 `source` 汇总；回退时标 `tencent` 或 `MIXED` |
| P2-20 | `src/format.ts:23-26`、`45` | CLI `update_time` 语义变成“有 timestamp 用数据时间，否则当前时间”；实测 CN 16:14:55（数据时间）、HK 17:44:36（请求时间）、US 04:00:01（本地时区显示的美东收盘），三种含义混在一个字段 | 三条 CLI 输出；HK `timestamp:null`，CN/US 有值 | 输出 `update_time`（数据时间，统一 Asia/Shanghai）+ `fetched_at`；无 timestamp 时明确 `null` 而不是 now |
| P2-21 | `src/agent/tools.ts:206-245` | 空 bars 时 `get_kline` 返回 `ok:true`、`windowStart/End:null`、`bars:[]`，没有失败码或 `missing`；模型可能把“上游无数据”当“没有历史” | `buildKlineWindow` 对 `bars=[]` 正常返回 | 空 bars 返回 `fail('NO_DATA', ...)`，或在 data 加 `empty:true` |

### P3 · Nit

| # | 位置 | 问题 | 证据 | 最小修复 |
| --- | --- | --- | --- | --- |
| P3-1 | `src/agent/tools.ts:113` | memo key 用 `JSON.stringify(args)`，对键顺序敏感；`{a:1,b:2}` 与 `{b:2,a:1}` 不命中。当前单参工具居多，`compute_series_stats` 三参可能触发 | `const key = \`${name}:${JSON.stringify(args)}\`` | 稳定序列化（按键排序）或 `JSON.stringify(args, Object.keys(args).sort())` |
| P3-2 | `src/agent/tools.ts:93-101` | 预算/memo 是模块级全局状态；同进程并发两个 agent 会串预算；同参并发调用会在 `await` 前都 miss，重复打网络 | `let toolCalls` / `const toolMemo` 在模块顶层 | 用 `AsyncLocalStorage` 或把运行时挂在 agent 实例上；至少文档声明单进程串行假设 |
| P3-3 | `src/agent/tools.ts:333-340` | `load_skill` 把整篇 markdown 塞进 JSON 字符串，换行/引号全部转义；模型需要解析 `data.content`，且 token 成本上升 | 返回 `{ok:true,data:{content:"..."}}` | 可保留 envelope，但把 `content` 放在 data 第一层文本字段，或返回纯 markdown + 简短 meta（需与 1-2 统一决策） |
| P3-4 | `src/agent/envelope.ts:33-40` | `localISO` 用系统时区；运行时上下文固定 `Asia/Shanghai`。部署到 UTC 机器时，asOf 偏移与“今天”口径不一致 | `-d.getTimezoneOffset()` 取系统时区；`renderRuntimeContext` 显式 `Asia/Shanghai` | 固定 `Asia/Shanghai` 计算，或统一用 `Intl` |
| P3-5 | `src/agent/tools.ts:381`、`385`；`test/agent-tools.test.ts:49` | oxlint 3 条 `no-await-in-loop` warning；串行取数是设计选择，但缺少注解 | oxlint 输出 | 在对应行加 `// eslint-disable-next-line no-await-in-loop` 或调整 lint 配置 |
| P3-6 | `src/agent/position.ts:56-63` | `parseAmount` 只取单元格中第一个数字；备注如“约 5w（含手续费 200）”会被截断；当前 12 行数据未触发 | 正则 `\d+(?:\.\d+)?` | 限定命名列解析，或在单元格格式校验时拒绝含多数字的值 |
| P3-7 | `upgrade/v3.1/agent_quality_optimization.md:139`、`428` | 文档仍写“14 个持仓行”，实际 12 行；2-2 验收“14 行中只有恒生科技ETF有盈亏”会误导复验 | 实盘 `get_portfolio_snapshot` 返回 12 行；`position.md` 表格 12 行 | 改为“12 行（2026-10-30 实测）”，或写“按文件实际行数，当前 12” |
| P3-8 | `upgrade/v3.1/agent_quality_optimization.md`（diff 整体） | 评审范围描述“仅状态勾选”与实际 diff 不符：diff 含 v3.1.2→v3.1.3 的 374 行新增/改写，不只是勾选 | `git diff --stat` 显示该文件 374 行变化 | 交付说明改为“v3.1.3 方案正文 + 状态勾选”，避免复审误判范围 |

---

## 4. 检查清单 A-I 逐条结论

| 项 | 结论 | 关键证据 |
| --- | --- | --- |
| **A. Envelope 契约** | **不通过**：9 个工具中 1 个有裸字符串返回；3 个工具上游异常 reject；`asOf` 多为请求时间；混合市场 `unit` 有量纲歧义；`load_skill` 返回 JSON envelope 可用但不理想 | P0-1、P1-1/P1-2/P1-3、P2-1/P2-2/P2-3；见契约表 |
| **B. FullQuote 归一** | **基本通过**，但 US 代码回环、无前缀代码误判、CLI `update_time` 语义不一致 | HK/US null 实测；`getQuotes(["515450"])`→`[]`；search `usaapl.oq`→quote `[]`；`format.ts:45` |
| **C. 调用治理** | **主路径通过**：9 次调用第 9 次 `TOOL_BUDGET_EXCEEDED`，同参 memo 命中，`run.ts:85-86` 每轮 reset。风险：recursionLimit 12 可能先触发；重试绕过预算 | `test/agent-tools.test.ts` 2/3 通过；`index.ts:128`；`tools.ts:379-386` |
| **D. 计算层** | **口径基本一致**：beta 以 `codes[0]` 为基准、样本标准差（n-1）、MDD 峰谷、末值价格分位均与方案一致；空/单点/NaN 不抛。缺陷：基准失败会静默换基准；`pricePercentile5y` 命名；golden 无容差 | `stats.ts:44-49/94`；`stats.test.ts` 11 条全绿；golden 精确匹配 |
| **E. K 线窗口** | **通过**核心：250/104/120、显式 limit 优先、>120 折叠 20+summary、`windowStart/End/adjust` 始终存在、throw 走 `UPSTREAM_ERROR`。缺陷：summary/币种/未完结 bar/空 bars | `buildKlineWindow` 单测；实盘 `UPSTREAM_ERROR`；`tools.ts:206-280` |
| **F. 持仓快照** | **部分通过**：12 行解析、`10w/7.5w/≈35,700/—/6.5w ⚠️` 正常，drift/over/under 正常；复合代码与无前缀基金代码会静默 null；±1pp 阈值未声明；总额 `?? 0`；12 vs 14 验收未更新 | 实盘 12 行、恒生科技 PnL 正确；`holdings[3].code="515450 → 008163"`；`tools.ts:565-590` |
| **G. Prompt 与热加载** | **部分通过**：每轮 `createInvestAgent` 重读 position/rules；`/reload` 只是回显但下一轮确实重建；运行时上下文追加尾部。缺陷：`position.md` 原文注入无边界标记；`load_skill` 越权读 `.agents/business`/`dev`；D21 未强制 | `run.ts:154/202`；`skills.ts:94` 实测；`index.ts:53` |
| **H. 测试** | **不足**：drift/action、市值/盈亏、market_overview missing、UPSTREAM_ERROR、混合 unit、真实工具装配均无确定性测试；golden 默认 skip 且无容差；网络用例在默认套件 | `test/agent-tools.test.ts` 缺 #4；只有纯函数/包装器断言；`bun test` 1 fail |
| **I. 体量与维护性** | **超预算**：`src/agent` 1452 行 vs 硬上限 1298（超 154 行）。`tools.ts` 661 行是热点；可回收 100-150 行但需配合 1 次跨层迁移 | `wc -l` 合计 1452；见第 6 节 |

---

## 5. 契约核对表（9 个工具）

图例：**是** = 满足；**缺失** = 部分字段/路径未覆盖；**否** = 不满足；**N/A** = 无数字字段，不适用。

| 工具 | 成功 envelope | 错误 envelope | `source` | `asOf` | `unit` |
| --- | --- | --- | --- | --- | --- |
| `get_stock_quote` | 是 | **否**（上游异常 reject；仅空参数 `fail`） | 是（tencent；实测 HK/US 亦 tencent） | 是，但为请求时间而非数据时间 | 是；混合市场量纲歧义（万元 vs 原币、亿元丢失） |
| `get_fund_quote` | 是 | **否**（上游异常 reject） | **缺失**（标 eastmoney，实测数据 source=tencent） | 是，请求时间 | 是（nav/accNav/change；timestamp 无单位） |
| `get_dividend_yield` | 是 | 是（仅参数；空结果仍 ok） | 是（eastmoney；SDK 回退时不准确） | 是，请求时间 | **缺失**（嵌套 `latestDividend.dividendPretax` 未覆盖） |
| `get_kline` | 是 | 是（`UPSTREAM_ERROR`） | 是（eastmoney） | 是，请求时间而非 `windowEnd` | **缺失**（`summary` 三项、bar 的 amplitude/changePercent 未覆盖；HK/US 币种错） |
| `search_stock` | 是 | **否**（上游异常 reject） | 是（eastmoney，未实测） | 是，请求时间 | N/A；但 US code 非规范（`usaapl.oq`） |
| `load_skill` | 是 | 是（`SKILL_NOT_FOUND`） | 是（local-skill） | 是，但无实际数据时间语义 | N/A（含 markdown，非数字） |
| `compute_series_stats` | 是 | **否**（空 `codes` 返回裸字符串） | 是（eastmoney） | 是，请求时间而非 `windowEnd` | 是（顶层指标）；`window.bars` 无单位但语义清楚 |
| `get_market_overview` | 是 | 是（`UPSTREAM_ERROR`） | 是（tencent） | 是，请求时间 | 是（价格/涨跌/涨跌幅/高低/成交额） |
| `get_portfolio_snapshot` | 是 | 是（`POSITION_NOT_FOUND` / `POSITION_PARSE_EMPTY`） | 是（position.md） | **是且正确**（mtime） | **缺失**（`cost`、`pnlPct`；`currency` 固定 CNY） |

补充：

- 9 个工具的 `meta` 都含 `source` 与 `asOf`；`currency/unit` 对无数字工具（`search_stock`、`load_skill`）不适用，符合 `EnvelopeMeta` 可选设计。
- `meta.stale` 全部硬编码 `false`：对实时行情可接受，但对 `position.md` 用户维护金额、HK 无时间戳、US 隔夜收盘不准确（P1-3 / P2-9）。

---

## 6. 测试盲区清单

| 路径 | 现状 | 建议用例 |
| --- | --- | --- |
| 持仓 drift / action | 无测试；`agent-tools.test.ts` 编号从 3 跳到 5，第 4 条缺失 | 用 `position.md` fixture 断言 `drift = currentPct - targetPct`，覆盖 `1.00` / `1.01` / `-1.00` / `-1.01` 边界 |
| 持仓市值 / 盈亏 | 仅实盘抽查；无确定性用例 | 注入 prices 的纯函数：份额+成本齐全、仅份额、仅成本、无效代码、复合代码，分别断言值或 `null` |
| 账号代码路由 | 无 | `getQuotes(["515450"])`、`["006493"]`、`["515450 → 008163"]`、`["hk00700"]`、`["usaapl.oq"]`、`["AAPL.OQ"]` 逐项断言 |
| 基金/股票取价失败隔离 | 无 | stub `getFundQuotes` 抛错，断言股票行仍有 `marketValue`，且 `missing` 只影响基金行 |
| `get_kline` 上游失败 | 只测 `buildKlineWindow` 纯函数 | stub `getKline` reject → 断言 `{ok:false,error.code:"UPSTREAM_ERROR"}` |
| 空 bars / 历史不足 120 | 只覆盖 300 → 250/120/104 与 120 边界 | 0 条、1 条、80 条 monthly：断言 `windowBars`、`windowStart`、空 bars 的失败语义 |
| `compute_series_stats` 装配 | 只测 `computeSeriesStats` 纯函数 | stub 取数：base 失败、第二标的失败、全部失败、3 次重试后成功；断言 `missing`、`pairs` 不换基准 |
| 混合市场 unit | 无 | 断言 `currency:"MIXED"` 且 `unit.amount` 明确 CN 万元 / HK·US 原币 |
| `asOf` 语义 | 无 | 断言 quote 的 `asOf` = max(timestamp/time)，kline 的 `asOf` = `windowEnd`，portfolio = mtime |
| 全工具 envelope 装配 | `envelope` 只测 `ok()/fail()` 助手 | 对 9 个工具逐个 `invoke` 成功/空参/坏参，`JSON.parse` 断言 `ok` 与 `error.code` |
| 预算 / 去重真实链路 | 只测 `governTool` 桩 | 用真实工具（可 mock 数据层）连续 9 次，断言第 9 次 `TOOL_BUDGET_EXCEEDED`；同参第二次不打网络 |
| `buildSystemPrompt` / 运行时上下文 | 无；周六口径仅手工验证 | 固化 `renderRuntimeContext(2026-10-31)` 断言“休市/最近交易日 2026-10-30”；修改 position fixture 后断言提示含新内容 |
| D21 白名单 | 8.4 #8 标记 skip，未实现 | `load_skill("../business/report-review")` 断言 `PATH_NOT_ALLOWED`；`../memory/...` 同样拒绝 |
| 网络依赖用例 | `test/sdk.test.ts` 默认执行 | 移到 `RUN_NETWORK=1` 条件，或改名不匹配 `*.test.ts` |

**“看起来绿但没测到”的具体点**：

- `agent-tools.test.ts` 的 5 条测试实际验证的是 `buildKlineWindow`、`governTool`、`envelope` 助手、`parsePositionHoldings`，**没有一条调用真实工具**；因此 P0-1 的裸字符串、P1-1 的 throw、P1-2 的混合 unit 全部绿灯漏过。
- Golden 测试默认 `skip`，且用精确匹配，日常 `bun test` 不能证明统计实现正确；`RUN_GOLDEN=1` 只证明“快照重算一致”，不证明与 8.3 期望值（77.1/33.8/0.64/1.34/43.3）一致。
- 实盘抽查（市场总览、持仓快照、混合行情）是本次人工验证，不在 CI 中。

---

## 7. 体量收缩候选（不损失行为）

当前：`src/agent/` 1452 行（`config 64 + envelope 41 + index 133 + position 106 + run 232 + skills 126 + tools 661 + trace 89`），方案硬上限 1298，超 154 行。

| 位置 | 动作 | 预计回收 | 风险 |
| --- | --- | --- | --- |
| `tools.ts:125-128`、`150-153`、`174-177`、`367-371` | 抽取 `parseCodes(codes)` 并复用到 4 处 | 10-15 行 | 低；注意空数组语义统一为 `fail('INVALID_ARGUMENT')` |
| `tools.ts:131-137`、`155-161`、`179-185`、`267-280`、`399-416`、`486-502`、`614-639` | 抽取 `baseMeta(source, currency?, unit?)`；把重复的 `source/asOf/stale` 模板收敛 | 20-30 行 | 低；保持每个工具的 currency/unit 差异 |
| `tools.ts:196-245` | `buildKlineWindow` + `KLINE_WINDOW/KLINE_MAX_BARS` 下沉到 `src/data/stats.ts` | agent -42 行（data +42） | 中；测试 import 需改，`stats.ts` 从 96 → ~138（本就超 ~70 估算）；不新增第 4 模块 |
| `tools.ts:529-612` | 把持仓取价、drift、action、marketValue/pnl 压缩为纯函数（可留在 `position.ts` 或下沉 data 层） | 40-60 行 | 中高；必须先补 drift/市值/代码路由测试，否则容易改变行为；若下沉到 `src/data/portfolio.ts` 会超出方案“最多 3 个新模块” |
| `tools.ts:451-485` | `get_market_overview` 的 `missing` + indices 构造改为表驱动/一次 map | 8-12 行 | 低；保留固定 3 条 `missing` 文案 |
| `tools.ts:123-193` | `get_stock_quote` / `get_fund_quote` / `get_dividend_yield` 共用一个 `quoteTool(name, source, run)` 工厂 | 15-25 行 | 中；schema/description 会变得不直观，且可能掩盖 P1-1 的 catch 差异；不建议优先做 |

**结论**：在 `src/agent` 内部可通过 1-2-5-6 回收约 **80-110 行**；要真正到 1298，必须再把 `buildKlineWindow`（约 42 行）迁到 `src/data/stats.ts`，或接受“预算复审”而不是硬凑。方案 2.3 自己写的是“超预算即触发范围复审；唯一选项是砍范围换能力，不加新工具”，因此更诚实的处理是：先修 P0/P1，再做一次范围复审（例如把 `compute_series_stats` 的 `window` 上限从 240 降到 120、或暂缓 `get_portfolio_snapshot` 的市值/盈亏计算），而不是靠微重构掩盖 150 行缺口。

---

## 8. 关键证据附录

### 8.1 裸字符串

```text
$ bun -e 'import { computeSeriesStatsTool } from "./src/agent/tools"; ... invoke({codes:""})'
EMPTY -> "错误：codes 不能为空"
```

对应代码：

```ts
// src/agent/tools.ts:372
if (list.length === 0) return '错误：codes 不能为空'
```

### 8.2 混合市场 unit 与量纲

```text
meta.currency = "MIXED"
meta.unit.amount = "见每行 currency"
meta.unit.totalMarketCap = "见每行 currency"
CN 600519 amount=825738（万元，约 82.6 亿元）
HK 00700 amount=8540915574.008（港元原币）
US AAPL.OQ amount=14878265494（美元原币）
```

### 8.3 美股代码回环

```text
searchStock("苹果") -> code "usaapl.oq"
getQuotes(["usAAPL"])  -> []
getQuotes(["AAPL.OQ"]) -> []
getQuotes(["hk03968"]) -> ["03968"]
getQuotes(["515450"])  -> []
getFundQuotes(["515450 → 008163"]) -> []
```

### 8.4 持仓复合代码

```text
holdings[3] = { name:"红利低波50ETF", code:"515450 → 008163", query:"-s / -f" }
```

若该行补上份额/成本：`funds` 分支会把复合代码传给 `getFundQuotes`，返回 `[]`，`marketValue/pnl` 静默 `null`，且不进入 `missing`（因为 `shares/cost` 已齐全，`noPnl` 不增加）。

### 8.5 `load_skill` 越权

```text
loadSkillTool.invoke({name:"../business/report-review"}) -> ok:true, content 4017 chars
loadSkillTool.invoke({name:"../dev/bun"})               -> ok:true, content 5654 chars
```

D21 白名单只允许 `.agents/skills/`；`skills.ts:94` 直接 `join(SKILLS_DIR, target, 'SKILL.md')`，没有 `resolve` 前缀校验。

### 8.6 股息率口径冲突

```text
.agents/rules/agent_brief.md:15  "默认口径：近 12 个月每股分红（DPS）年度化。"
src/data/dividend.ts:12-13       "单期分红口径（最新一期已实施分红/现价，未年度化…）"
src/agent/index.ts:44            "（单期分红口径，非年度化）"
```

### 8.7 测试与静态检查

```text
bun test test/agent-tools.test.ts test/stats.test.ts -> 16 pass / 0 fail
RUN_GOLDEN=1 bun test test/stats.golden.test.ts       -> 1 pass
bun test --timeout 15000                              -> 49 pass / 1 skip / 1 fail
  (fail) Stock SDK 测试 > K线数据 > 查询日K线 - 贵州茅台 [7628.91ms] ECONNRESET
bunx oxfmt --check ...                                -> All matched files use the correct format.
bunx oxlint ...                                       -> 0 errors, 3 warnings
```

---

## 9. 声明

本次评审**未修改任何被评审的源码、测试或方案文件**；仅新增本报告 `upgrade/v3.1/code_review_20261030.md`。评审过程中未读取 `.env`，未读取 `.agents/memory/`，未在工具输出或日志中发现密钥泄漏。
