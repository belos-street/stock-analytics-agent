/**
 * 计算型工具：价格序列统计（收益 / 回撤 / 波动 / 相关性 / beta / 价格分位）。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getKline } from '../../data/sdk'
import { computeSeriesStats } from '../../data/stats'
import { fail, localISO, ok } from '../envelope'
import type { KlineBar, KlinePeriod } from '../../types'
import { governTool, parseCodes } from './runtime'

export const computeSeriesStatsTool = tool(
  governTool(
    'compute_series_stats',
    async ({
      codes,
      period = 'monthly',
      window
    }: {
      codes: string
      period?: KlinePeriod
      window?: number
    }) => {
      const list = parseCodes(codes).slice(0, 3)
      if (list.length === 0) {
        return fail('INVALID_ARGUMENT', 'codes 不能为空')
      }

      const series: { code: string; bars: KlineBar[] }[] = []
      const missing: string[] = []
      for (const code of list) {
        // 串行取数：多标的并发实测会 ECONNRESET；失败后间隔重试，仍失败则降级
        let bars: KlineBar[] | null = null
        for (let attempt = 0; attempt < 3 && !bars; attempt++) {
          try {
            bars = await getKline(code, period)
          } catch {
            bars = null
          }
          if (!bars && attempt < 2) await new Promise((r) => setTimeout(r, 300))
        }
        if (bars && bars.length > 0) series.push({ code, bars })
        else missing.push(code)
      }

      // 默认 60 根 bar；上限 240，避免超长窗口拖垮取数
      const lookback = window && window > 0 ? Math.min(window, 240) : 60
      const stats = computeSeriesStats({
        series,
        period,
        window: lookback,
        adjust: 'qfq'
      })
      // codes[0] 缺失时不能把第一个成功标的当基准，否则 beta 方向会静默翻转
      const baseMissing = list.length > 0 && series[0]?.code !== list[0]
      const pairs = baseMissing ? [] : stats.pairs
      return ok(
        {
          ...stats,
          pairs,
          baseCode: list[0],
          baseMissing,
          missing
        },
        {
          source: 'eastmoney',
          asOf: stats.window.end ?? localISO(),
          asOfKind: stats.window.end ? 'barDate' : 'fetch',
          fetchedAt: localISO(),
          currency: 'CNY',
          unit: {
            totalReturnPct: '%',
            maxDrawdownPct: '%',
            annualizedVolPct: '%',
            pricePercentile5y: '%分位（窗口见 window）',
            corr: '无量纲',
            beta: '无量纲',
            excessReturnPct: '%'
          },
          stale: false
        }
      )
    }
  ),
  {
    name: 'compute_series_stats',
    description:
      '计算 1-3 个标的的价格序列统计：区间收益、最大回撤、年化波动、两两相关与 beta、价格分位。只覆盖价格序列，不含基本面/估值。口径：收益率用前复权收盘价（adjust="qfq"）；corr/beta 用周期间收益率，beta 以 codes[0] 为基准、codes[1..] 为因变量；maxDrawdownPct 为区间收盘价峰谷（负值）；annualizedVolPct = 周期间收益标准差 × √12/√52/√250；pricePercentile5y 是当前价在窗口内的价格分位，不是估值分位，回答时禁止表述为"估值分位"。多标的串行取数，单个失败时该序列缺失（不进 series）并在 missing 中声明，不整包失败。',
    schema: z.object({
      codes: z
        .string()
        .describe('逗号分隔的 1-3 个代码（如 sh601899,sh518880）'),
      period: z
        .enum(['daily', 'weekly', 'monthly'])
        .optional()
        .describe('K线周期，默认 monthly（长窗口默认口径）'),
      window: z
        .number()
        .optional()
        .describe('回看 bar 数，默认 60（monthly 约 5 年），上限 240')
    })
  }
)
