/**
 * Agent Tools（模式 2 · 独立 CLI）
 * 将现有 CLI 数据能力（src/）封装为 LangChain agent 可调用的工具。
 *
 * 设计要点：
 * - 复用 `src/` 数据层，与模式 1（harness 用 CLI）共享同一实现，避免逻辑分叉；
 * - 工具返回 JSON 字符串，便于模型解析；
 * - 行情工具按代码前缀自动识别市场（sh/sz/hk/us），故 A/港/美股合并为一个工具。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getQuotes, getFundQuotes, getKline, searchStock } from '../sdk'
import { getDividendYields } from '../dividend'

/** 工具返回统一为 JSON 字符串 */
const toJson = (data: unknown): string => JSON.stringify(data, null, 2)

const codesSchema = z
  .string()
  .describe(
    '逗号分隔的代码列表。A股/ETF用 sh/sz 前缀（如 sh600519,sz000001），港股用 hk 前缀（如 hk00700），美股直接写代码（如 AAPL）'
  )

/** 行情查询：A股 / 港股 / 美股 / ETF（代码前缀自动识别市场） */
export const getStockQuote = tool(
  async ({ codes }: { codes: string }) => {
    const list = codes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length === 0) return '错误：codes 不能为空'
    return toJson(await getQuotes(list))
  },
  {
    name: 'get_stock_quote',
    description:
      '查询 A股/港股/美股/ETF 的实时行情（现价、涨跌幅、市值、成交量）。输入逗号分隔的代码，市场按前缀自动识别。基金请用 get_fund_quote。',
    schema: z.object({ codes: codesSchema })
  }
)

/** 基金行情（基金须显式指定 market=fund） */
export const getFundQuote = tool(
  async ({ codes }: { codes: string }) => {
    const list = codes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length === 0) return '错误：codes 不能为空'
    return toJson(await getFundQuotes(list))
  },
  {
    name: 'get_fund_quote',
    description:
      '查询场外基金的净值行情（单位净值、估算涨跌幅）。输入逗号分隔的基金代码（如 006493,006961）。',
    schema: z.object({ codes: codesSchema })
  }
)

/** 股息率查询（含口径标注） */
export const getDividendYield = tool(
  async ({ codes }: { codes: string }) => {
    const list = codes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length === 0) return '错误：codes 不能为空'
    return toJson(await getDividendYields(list))
  },
  {
    name: 'get_dividend_yield',
    description:
      '查询股票/ETF 的股息率。结果含 yield_basis 字段标注计算口径（单期分红口径，非年度化），向用户呈现时必须一并说明口径。',
    schema: z.object({ codes: codesSchema })
  }
)

/** K线数据 */
export const getKlineData = tool(
  async ({ code, period }: { code: string; period?: string }) => {
    return toJson(await getKline(code, period || 'daily'))
  },
  {
    name: 'get_kline',
    description:
      '查询 K线数据，用于判断年内高点、回撤、价格走势。period 可选 daily/weekly/monthly——判断"年内最高价"等长窗口口径必须用 monthly。',
    schema: z.object({
      code: z.string().describe('单个代码（如 sh600519）'),
      period: z
        .enum(['daily', 'weekly', 'monthly'])
        .optional()
        .describe('K线周期，默认 daily')
    })
  }
)

/** 搜索股票/基金 */
export const searchStockTool = tool(
  async ({ keyword }: { keyword: string }) => {
    return toJson(await searchStock(keyword))
  },
  {
    name: 'search_stock',
    description:
      '按名称或代码关键词搜索股票/基金，用于把用户说的名称转成标准代码。',
    schema: z.object({
      keyword: z.string().describe('名称或代码关键词，如"招商银行"')
    })
  }
)

/** agent 工具集：模型可调用的全部工具 */
export const agentTools = [
  getStockQuote,
  getFundQuote,
  getDividendYield,
  getKlineData,
  searchStockTool
]
