/**
 * 持仓快照工具：解析 position.md，输出占比 / drift / 超限与可验证盈亏。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getQuotes, getFundQuotes, symbolKey } from '../../data/sdk'
import {
  loadPositionBrief,
  parsePositionHoldings,
  positionMtimeISO
} from '../position'
import {
  fail,
  isoFromQuoteTime,
  localISO,
  ok,
  type MissingField
} from '../envelope'
import { governTool, r2 } from './runtime'

export const getPortfolioSnapshot = tool(
  governTool('get_portfolio_snapshot', async () => {
    const text = loadPositionBrief()
    if (!text) {
      return fail(
        'POSITION_NOT_FOUND',
        '未找到 position.md，请按 position.example.md 创建后再试'
      )
    }
    const holdings = parsePositionHoldings(text)
    if (holdings.length === 0) {
      return fail(
        'POSITION_PARSE_EMPTY',
        '未解析到持仓明细表，请检查 position.md 第二节的表格'
      )
    }
    const asOf = positionMtimeISO() ?? localISO()
    const missing: MissingField[] = []

    // 复合代码（如 "515450 → 008163"）不猜测，直接记 missing
    const composite = holdings.filter((h) => h.code.includes('→'))
    for (const h of composite) {
      missing.push({
        field: h.code,
        reason: '复合代码无法直接取价，需先确定唯一标的'
      })
    }
    const pnlRows = holdings.filter(
      (h) => h.shares !== null && h.cost !== null && !h.code.includes('→')
    )
    const prices: Record<string, { price: number; time: string | null }> = {}
    const funds = pnlRows.filter(
      (h) => h.query.includes('-f') && !/^(sh|sz|hk)/i.test(h.code)
    )
    const stocks = pnlRows.filter((h) => !funds.includes(h))
    try {
      if (funds.length > 0) {
        const rows = await getFundQuotes(funds.map((h) => h.code))
        for (const q of rows) {
          prices[symbolKey(q.code)] = { price: q.nav, time: q.navDate ?? null }
        }
      }
    } catch {
      missing.push({
        field: 'marketValue',
        reason: '基金净值获取失败，相关行市值与盈亏置 null'
      })
    }
    try {
      if (stocks.length > 0) {
        const rows = await getQuotes(stocks.map((h) => h.code))
        for (const q of rows) {
          prices[symbolKey(q.code)] = {
            price: q.price,
            time: isoFromQuoteTime(q.time, q.timestamp, q.tz)
          }
        }
      }
    } catch {
      missing.push({
        field: 'marketValue',
        reason: '股票行情获取失败，相关行市值与盈亏置 null'
      })
    }
    const noPnl = holdings.length - pnlRows.length - composite.length
    if (noPnl > 0) {
      missing.push({
        field: 'marketValue',
        reason: `${noPnl} 个持仓缺份额或成本价，市值与盈亏置 null`
      })
    }

    const targetTotal = holdings.reduce((s, h) => s + (h.targetAmount ?? 0), 0)
    const currentTotal = holdings.reduce(
      (s, h) => s + (h.currentAmount ?? 0),
      0
    )
    const rows = holdings.map((h) => {
      const targetPct =
        h.targetAmount !== null && targetTotal > 0
          ? r2((h.targetAmount / targetTotal) * 100)
          : null
      const currentPct =
        h.currentAmount !== null && currentTotal > 0
          ? r2((h.currentAmount / currentTotal) * 100)
          : null
      const driftPct =
        targetPct !== null && currentPct !== null
          ? r2(currentPct - targetPct)
          : null
      const action =
        driftPct === null
          ? null
          : driftPct > 1
            ? 'over'
            : driftPct < -1
              ? 'under'
              : 'ok'
      const q = prices[symbolKey(h.code)]
      const marketValue = q && h.shares !== null ? r2(q.price * h.shares) : null
      const pnl =
        q && h.shares !== null && h.cost !== null
          ? r2((q.price - h.cost) * h.shares)
          : null
      const pnlPct =
        q && h.cost !== null && h.cost > 0
          ? r2((q.price / h.cost - 1) * 100)
          : null
      return {
        ...h,
        targetPct,
        currentPct,
        driftPct,
        action,
        marketValue,
        pnl,
        pnlPct,
        priceTime: q?.time ?? null
      }
    })

    return ok(
      {
        total: {
          targetAmount: targetTotal > 0 ? targetTotal : null,
          currentAmount: currentTotal > 0 ? currentTotal : null
        },
        holdings: rows,
        missing
      },
      {
        source: 'position.md',
        asOf,
        asOfKind: 'fileMtime',
        fetchedAt: localISO(),
        currency: 'CNY',
        unit: {
          targetAmount: '元',
          currentAmount: '元',
          limitAmount: '元',
          marketValue: '元',
          pnl: '元',
          cost: '元/股',
          shares: '股/份',
          targetPct: '%',
          currentPct: '%',
          driftPct: '百分点',
          pnlPct: '%'
        },
        missing,
        stale: true
      }
    )
  }),
  {
    name: 'get_portfolio_snapshot',
    description:
      '解析 position.md 的持仓明细：目标 / 当前金额、目标 / 当前占比、漂移 drift（当前占比 - 目标占比，|drift| ≤ 1pp 为 ok，否则 over/under）、单标的金额上限。仅当份额与成本价都存在时才计算市值与盈亏，否则显式 null，不编造；复合代码不猜。asOf 为 position.md 修改时间，不代表实时市值。',
    schema: z.object({})
  }
)
