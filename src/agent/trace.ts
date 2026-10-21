/**
 * Agent 执行过程追踪（模式 2 · 独立 CLI）
 * 记录 agent 调用了哪些工具（skill / 数据查询），用于：
 * - 思考时实时展示进度（正在干什么）
 * - 回答后输出溯源清单（调了哪些 skill、查了哪些数据）
 */

/** 单次工具调用记录 */
export interface ToolCallRecord {
  /** 工具名（get_stock_quote / load_skill 等） */
  name: string
  /** 工具入参 */
  input: Record<string, unknown>
}

/** 工具中文名映射 */
const TOOL_LABELS: Record<string, string> = {
  get_stock_quote: '查行情',
  get_fund_quote: '查基金',
  get_dividend_yield: '查股息率',
  get_kline: '查K线',
  search_stock: '搜索',
  load_skill: '加载方法论'
}

/** 单个工具调用的人类可读描述（实时进度用） */
export function describeToolCall(call: ToolCallRecord): string {
  const label = TOOL_LABELS[call.name] ?? call.name
  const { input } = call

  switch (call.name) {
    case 'get_stock_quote':
    case 'get_fund_quote':
    case 'get_dividend_yield':
      return `${label} ${str(input.codes)}`
    case 'get_kline':
      return `${label} ${str(input.code)}（${str(input.period) || 'daily'}）`
    case 'search_stock':
      return `${label}「${str(input.keyword)}」`
    case 'load_skill':
      return `${label} ${str(input.name)}`
    default:
      return label
  }
}

/** 汇总：加载过的 skill 名（去重） */
export function collectSkills(calls: ToolCallRecord[]): string[] {
  const names = calls
    .filter((c) => c.name === 'load_skill')
    .map((c) => str(c.input.name))
    .filter(Boolean)
  return [...new Set(names)]
}

/** 汇总：数据查询描述（去重） */
export function collectDataQueries(calls: ToolCallRecord[]): string[] {
  const descs = calls
    .filter((c) => c.name !== 'load_skill')
    .map(describeToolCall)
  return [...new Set(descs)]
}

/**
 * 渲染回答后的溯源清单。
 * 展示本次回答依赖的方法论 skill 与实时数据，让用户可核验。
 */
export function renderTrace(calls: ToolCallRecord[]): string {
  if (calls.length === 0) return ''

  const skills = collectSkills(calls)
  const queries = collectDataQueries(calls)

  const lines: string[] = ['📎 本次回答依据']
  if (skills.length > 0) {
    lines.push(`  方法论：${skills.join('、')}`)
  }
  if (queries.length > 0) {
    lines.push(`  实时数据：${queries.join('；')}`)
  }

  return lines.join('\n')
}

function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  return String(v)
}
