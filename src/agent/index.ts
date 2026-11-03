/**
 * Agent 骨架（模式 2 · 独立 CLI）
 * 基于 LangChain.js `createAgent` 组装：模型 + 工具 + 系统提示。
 * 复用 src/ 数据层作为工具实现，与模式 1 共享，不重复造数据逻辑。
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { loadModelConfig } from './config'
import { agentTools } from './tools'
import { renderSkillCatalog } from './skills'
import { renderPositionContext } from './position'
import { getSDK } from '../data/sdk'

/** 口径与红线文件（模式 2 读取白名单，D21；不读 .agents/memory/） */
const RULES_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.agents',
  'rules',
  'agent_brief.md'
)

/** 加载口径与红线（文件缺失时给兜底提示，不阻断启动） */
export function renderRulesBrief(): string {
  if (!existsSync(RULES_FILE)) {
    return '（未找到 .agents/rules/agent_brief.md，按系统提示的通用口径执行）'
  }
  return readFileSync(RULES_FILE, 'utf-8').trim()
}

/** 系统提示：投资分析助手定位 + 口径纪律 + 用户持仓 + 口径红线 + skill 目录 */
function buildSystemPrompt(): string {
  return `你是个人长期投资分析助手，帮助用户做行情查询、持仓分析、估值判断与资产配置建议。

工作原则：
- 数据一律通过工具实时查询，不要凭记忆编造价格、估值、股息率等数字。
- 做具体分析前，先用 load_skill 加载对应的方法论 skill，遵循其分析框架与口径要求。
- 量化指标（估值分位、回撤、股息率）必须说明计算口径与时间窗口。
- 股息率工具返回的 yield_basis 标注了口径（单期分红口径，非年度化），呈现时必须一并说明，避免用户误当年度化口径。
- 判断"年内最高价/年内回撤"等长窗口口径时，K线必须用 monthly 周期，不可用局部窗口冒充全年。
- 报告需包含空方论点，保持客观，不选择性乐观。
- 长期投资导向：不鼓励短线炒作、不追热点。
- 给建议时结合下方用户持仓与投资风格，个性化分析；不需用户每次复述持仓。
- 所有分析仅供参考，不构成投资建议；市场有风险，投资需谨慎。

## 用户持仓与投资风格（来自 position.md）

${renderPositionContext()}

## 口径与红线（来自 .agents/rules/agent_brief.md，必须遵守）

${renderRulesBrief()}

## 可用分析 Skill（用 load_skill 加载查看完整方法论）

${renderSkillCatalog()}`
}

const MARKET_STATUS: Record<string, string> = {
  pre_market: '盘前',
  open: '交易中',
  lunch_break: '午间休市',
  after_hours: '盘后',
  closed: '休市 / 非交易时段'
}

/**
 * 当前日期 + A 股交易日状态。
 * 由 run.ts 每轮追加到系统提示尾部：稳定前缀不变，利于前缀缓存。
 */
export async function renderRuntimeContext(
  now: Date = new Date()
): Promise<string> {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai'
  }).format(now)
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long',
    timeZone: 'Asia/Shanghai'
  }).format(now)
  const sdk = getSDK()
  const status = sdk.calendar.marketStatus('A', now)
  let trading = '未知（日历不可用）'
  let prev = '未知'
  try {
    trading = (await sdk.calendar.isTradingDay(now)) ? '是' : '否'
    prev = await sdk.calendar.prevTradingDay(now)
  } catch {
    // 日历接口失败时降级，不阻断问答
  }
  const hint =
    trading === '否'
      ? `今天休市，“今天”指最近交易日 ${prev}`
      : trading === '是'
        ? '今天为交易日，可直接用“今天”'
        : '交易日历不可用；涉及“今天”时先说明不确定'
  return [
    '## 当前时间与交易日（运行时注入）',
    `- 今天：${date} ${weekday}`,
    `- A股状态：${MARKET_STATUS[status] ?? status}`,
    `- 今天是否交易日：${trading}`,
    `- 上一交易日：${prev}`,
    `- 口径：${hint}；所有“今天 / 最近 / 年内”表述以此为准。`
  ].join('\n')
}

/** 创建投资分析 agent；runtimeContext 每轮追加在系统提示尾部 */
export function createInvestAgent(runtimeContext = '') {
  const config = loadModelConfig()

  const model = new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0.3,
    configuration: config.baseURL ? { baseURL: config.baseURL } : undefined
  })

  const base = buildSystemPrompt()
  return createAgent({
    model,
    tools: agentTools,
    systemPrompt: runtimeContext ? `${base}\n\n${runtimeContext}` : base
  }).withConfig({ recursionLimit: 12 })
}

export { loadModelConfig } from './config'
export type { ModelConfig } from './config'
export { agentTools, resetToolRuntime } from './tools'
