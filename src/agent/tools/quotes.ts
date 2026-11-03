/**
 * 行情类工具：股票 / 基金 / 股息率 / K线 / 搜索。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import {
  getQuotes,
  getFundQuotes,
  getKline,
  searchStock,
  symbolKey
} from '../../data/sdk'
import { getDividendYields } from '../../data/dividend'
import { buildKlineWindow } from '../../data/stats'
import { fail, isoFromQuoteTime, latestISO, localISO, ok } from '../envelope'
import type { KlineBar, KlinePeriod } from '../../types'
import {
  codesSchema,
  fetchMeta,
  fundRow,
  governTool,
  parseCodes,
  quoteMeta,
  quoteRow
} from './runtime'

/** 行情查询：A股 / 港股 / 美股 / ETF（代码前缀自动识别市场） */
export const getStockQuote = tool(
  governTool('get_stock_quote', async ({ codes }: { codes: string }) => {
    const list = parseCodes(codes)
    if (list.length === 0) return fail('INVALID_ARGUMENT', 'codes 不能为空')
    const rows = (await getQuotes(list)).map(quoteRow)
    if (rows.length === 0) {
      return fail('NO_DATA', '未获取到任何行情，请检查代码或稍后重试', true)
    }
    return ok(rows, quoteMeta('tencent', rows, list))
  }),
  {
    name: 'get_stock_quote',
    description:
      '查询 A股/港股/美股/ETF 的实时行情（现价、涨跌幅、市值、成交量）。输入逗号分隔的代码，市场按前缀自动识别。基金请用 get_fund_quote。',
    schema: z.object({ codes: codesSchema })
  }
)

/** 基金行情（场外基金净值） */
export const getFundQuote = tool(
  governTool('get_fund_quote', async ({ codes }: { codes: string }) => {
    const list = parseCodes(codes)
    if (list.length === 0) return fail('INVALID_ARGUMENT', 'codes 不能为空')
    const rows = (await getFundQuotes(list)).map(fundRow)
    if (rows.length === 0) {
      return fail('NO_DATA', '未获取到任何基金净值，请检查代码或稍后重试', true)
    }
    const latest = latestISO(rows.map((r) => r.asOf))
    return ok(rows, {
      source: 'eastmoney',
      asOf: latest ?? localISO(),
      asOfKind: latest ? 'navDate' : 'fetch',
      fetchedAt: localISO(),
      currency: 'CNY',
      unit: { nav: '元', accNav: '元', change: '涨跌幅(%)' },
      missing: list
        .filter((c) => !rows.some((r) => symbolKey(r.code) === symbolKey(c)))
        .map((c) => ({ field: c, reason: '未返回净值' })),
      stale: rows.some((r) => !r.asOf)
    })
  }),
  {
    name: 'get_fund_quote',
    description:
      '查询场外基金的净值行情（单位净值、估算涨跌幅）。输入逗号分隔的基金代码（如 006493,006961）。',
    schema: z.object({ codes: codesSchema })
  }
)

/** 股息率查询（含口径标注） */
export const getDividendYield = tool(
  governTool('get_dividend_yield', async ({ codes }: { codes: string }) => {
    const list = parseCodes(codes)
    if (list.length === 0) return fail('INVALID_ARGUMENT', 'codes 不能为空')
    const data = await getDividendYields(list)
    if (data.length === 0) {
      return fail(
        'NO_DATA',
        '未获取到任何股息率数据，请检查代码或稍后重试',
        true
      )
    }
    return ok(data, {
      ...fetchMeta('eastmoney'),
      currency: 'CNY',
      unit: {
        currentPrice: '元',
        dividendPerShare: '元/股',
        yieldRate: '%'
      },
      missing: list
        .filter((c) => !data.some((d) => symbolKey(d.symbol) === symbolKey(c)))
        .map((c) => ({ field: c, reason: '未返回股息率' }))
    })
  }),
  {
    name: 'get_dividend_yield',
    description:
      '查询股票/ETF 的股息率。结果含 yield_basis 字段标注计算口径（单期分红口径，非年度化），向用户呈现时必须一并说明口径。',
    schema: z.object({ codes: codesSchema })
  }
)

/** K线数据（窗口按周期分化；超长窗口折叠为尾部 + 摘要） */
export const getKlineData = tool(
  governTool(
    'get_kline',
    async ({
      code,
      period,
      limit
    }: {
      code: string
      period?: KlinePeriod
      limit?: number
    }) => {
      const kp = period || 'daily'
      let bars: KlineBar[]
      try {
        bars = await getKline(code, kp)
      } catch {
        return fail('UPSTREAM_ERROR', 'K线数据获取失败，请稍后重试', true)
      }
      if (bars.length === 0) {
        return fail('NO_DATA', '未获取到K线数据，请检查代码或稍后重试', true)
      }
      const data = buildKlineWindow(code, bars, kp, limit)
      const last = bars[bars.length - 1]
      const barTime = last?.timestamp
        ? isoFromQuoteTime(null, last.timestamp, last.tz ?? 'Asia/Shanghai')
        : data.windowEnd
      return ok(data, {
        source: 'eastmoney',
        asOf: barTime ?? localISO(),
        asOfKind: barTime ? 'barDate' : 'fetch',
        fetchedAt: localISO(),
        currency: 'CNY',
        unit: {
          open: '元',
          high: '元',
          low: '元',
          close: '元',
          volume: '手',
          amount: '元',
          amplitude: '%',
          changePercent: '%',
          turnoverRate: '%',
          totalReturnPct: '%',
          maxDrawdownPct: '%',
          annualizedVolPct: '%'
        },
        stale: false
      })
    }
  ),
  {
    name: 'get_kline',
    description:
      '查询 K线数据，用于判断年内高点、回撤、价格走势。period 默认 daily；默认窗口按周期分化：daily 250（约1年）、weekly 104（约2年）、monthly 120（约10年），显式 limit 覆盖默认。返回 windowStart / windowEnd / adjust；窗口超过 120 条时只回最近 20 条 + summary（区间收益 / 回撤 / 年化波动），避免灌爆上下文。判断"年内最高价/年内回撤"必须用 monthly，不可用局部窗口冒充全年。',
    schema: z.object({
      code: z.string().describe('单个代码（如 sh600519）'),
      period: z
        .enum(['daily', 'weekly', 'monthly'])
        .optional()
        .describe('K线周期，默认 daily'),
      limit: z
        .number()
        .optional()
        .describe('返回最近 N 条；不传按周期默认 250/104/120')
    })
  }
)

/** 搜索股票/基金 */
export const searchStockTool = tool(
  governTool('search_stock', async ({ keyword }: { keyword: string }) => {
    const data = await searchStock(keyword)
    if (data.length === 0) {
      return fail('NO_DATA', '未找到匹配的股票/基金', false)
    }
    return ok(data, fetchMeta('eastmoney'))
  }),
  {
    name: 'search_stock',
    description:
      '按名称或代码关键词搜索股票/基金，用于把用户说的名称转成标准代码。',
    schema: z.object({
      keyword: z.string().describe('名称或代码关键词，如"招商银行"')
    })
  }
)
