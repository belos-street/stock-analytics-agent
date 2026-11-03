/**
 * 市场总览工具：5 个核心指数 + 两市成交额（v1）。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getQuotes, symbolKey } from '../../data/sdk'
import { fail, ok, type MissingField } from '../envelope'
import { governTool, quoteMeta, quoteRow, r2 } from './runtime'

const INDEX_LIST = ['sh000001', 'sz399001', 'sz399006', 'sh000300', 'sh000905']

export const getMarketOverview = tool(
  governTool('get_market_overview', async () => {
    const rows = (await getQuotes(INDEX_LIST)).map(quoteRow)
    if (rows.length === 0) {
      return fail('NO_DATA', '未获取到任何指数行情，请稍后重试', true)
    }
    const byCode = new Map(rows.map((q) => [q.code, q]))
    const missing: MissingField[] = [
      { field: 'advanceDecline', reason: 'v1 不聚合全市场涨跌家数' },
      { field: 'limitUpDown', reason: 'v1 不做涨停 / 跌停统计' },
      { field: 'northbound', reason: 'v1 不接入北向资金摘要' }
    ]
    const indices: Record<string, unknown>[] = []
    for (const code of INDEX_LIST) {
      const q = byCode.get(symbolKey(code))
      if (!q) {
        missing.push({ field: code, reason: '指数行情缺失' })
        continue
      }
      indices.push({
        code,
        name: q.name,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        high: q.high,
        low: q.low,
        asOf: q.asOf,
        asOfKind: q.asOfKind
      })
    }
    const sh = byCode.get('000001')
    const sz = byCode.get('399001')
    const shAmount = sh?.amount ?? null
    const szAmount = sz?.amount ?? null
    const turnover =
      shAmount !== null && szAmount !== null
        ? {
            value: r2((shAmount + szAmount) / 10000),
            unit: '亿元',
            basis: '上证指数 + 深证成指成交额合计（源字段单位万元）'
          }
        : null
    if (!turnover) missing.push({ field: 'turnover', reason: '两市成交额缺失' })
    const meta = quoteMeta('tencent', rows, INDEX_LIST)
    meta.missing = missing
    meta.unit = {
      price: '点',
      change: '点',
      changePercent: '%',
      high: '点',
      low: '点',
      turnover: '亿元'
    }
    return ok({ indices, turnover, missing }, meta)
  }),
  {
    name: 'get_market_overview',
    description:
      '查询 A 股市场总览 v1：上证指数 / 深证成指 / 创业板指 / 沪深300 / 中证500 + 两市成交额（亿元）。不含涨跌家数、涨停跌停、北向资金，缺失项在 missing 中声明，不要自行补数。',
    schema: z.object({})
  }
)
