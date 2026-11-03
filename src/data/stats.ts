/** 价格序列统计（纯函数，不触网）；口径见 compute_series_stats 的 description。 */
import type { KlineBar, KlinePeriod } from '../types'
const ANNUAL = { daily: 250, weekly: 52, monthly: 12 }
const r2 = (v: number): number => Math.round(v * 100) / 100
type Bar = { code: string; bars: KlineBar[] }
type In = {
  series: Bar[]
  period: KlinePeriod
  window?: number
  adjust?: string
}

function returnsOf(bars: KlineBar[]): number[] | null {
  const cs = bars.map((b) => b.close)
  if (cs.length < 2 || !cs.every(Number.isFinite)) return null
  const out = cs.slice(1).map((c, i) => c / cs[i] - 1)
  return out.every(Number.isFinite) ? out : null
}

function metricsOf(bars: KlineBar[], period: KlinePeriod, code: string) {
  const out = {
    code,
    totalReturnPct: null as number | null,
    maxDrawdownPct: null as number | null,
    annualizedVolPct: null as number | null,
    pricePercentile5y: null as number | null
  }
  const rs = returnsOf(bars)
  if (!rs) return out
  const cs = bars.map((b) => b.close)
  let peak = cs[0],
    mdd = 0
  for (const c of cs) {
    if (c > peak) peak = c
    mdd = Math.min(mdd, c / peak - 1)
  }
  const lo = Math.min(...cs),
    hi = Math.max(...cs)
  const last = cs[cs.length - 1]
  out.totalReturnPct = r2((last / cs[0] - 1) * 100)
  out.maxDrawdownPct = r2(mdd * 100)
  if (rs.length > 1) {
    const m = rs.reduce((s, x) => s + x, 0) / rs.length
    const sd = Math.sqrt(
      rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1)
    )
    out.annualizedVolPct = r2(sd * Math.sqrt(ANNUAL[period]) * 100)
  }
  if (hi > lo) out.pricePercentile5y = r2(((last - lo) / (hi - lo)) * 100)
  return out
}

function pairOf(a: Bar, b: Bar, ta: number | null, tb: number | null) {
  const xa = returnsOf(a.bars) ?? [],
    xb = returnsOf(b.bars) ?? []
  const n = Math.min(xa.length, xb.length)
  const x = xa.slice(-n),
    y = xb.slice(-n)
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let cov = 0,
    va = 0,
    vb = 0
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my)
    va += (x[i] - mx) ** 2
    vb += (y[i] - my) ** 2
  }
  return {
    a: a.code,
    b: b.code,
    corr: va > 0 && vb > 0 ? r2(cov / Math.sqrt(va * vb)) : null,
    beta: va > 0 ? r2(cov / va) : null,
    excessReturnPct: ta !== null && tb !== null ? r2(ta - tb) : null
  }
}

export function computeSeriesStats(input: In) {
  const used = input.series.map((s) => {
    const bars =
      input.window && input.window > 0 ? s.bars.slice(-input.window) : s.bars
    return { code: s.code, bars, m: metricsOf(bars, input.period, s.code) }
  })
  const base = used[0]?.bars ?? []
  const start = base[0]?.date ?? null
  const end = base[base.length - 1]?.date ?? null
  const rt0 = used[0]?.m.totalReturnPct ?? null
  const warning = '未提供复权口径（adjust），收益率与回撤可能因分红除权失真'
  return {
    adjust: input.adjust || 'unknown',
    ...(input.adjust ? {} : { warning }),
    window: { period: input.period, bars: base.length, start, end },
    series: used.map((u) => u.m),
    pairs: used.slice(1).map((b) => pairOf(used[0], b, rt0, b.m.totalReturnPct))
  }
}

/** K线周期默认回看 bar 数（显式 limit 优先）：daily≈1年、weekly≈2年、monthly≈10年 */
const KLINE_WINDOW: Record<KlinePeriod, number> = {
  daily: 250,
  weekly: 104,
  monthly: 120
}
const KLINE_MAX_BARS = 120
const KLINE_TAIL_BARS = 20

/** 构造 K 线窗口返回体（纯函数；>120 条折叠为最近 20 条 + 摘要） */
export function buildKlineWindow(
  code: string,
  bars: KlineBar[],
  period: KlinePeriod,
  limit?: number
) {
  const n = limit && limit > 0 ? limit : KLINE_WINDOW[period]
  const win = bars.slice(-n)
  const truncated = win.length > KLINE_MAX_BARS
  const metrics = truncated
    ? computeSeriesStats({
        series: [{ code, bars: win }],
        period,
        adjust: 'qfq'
      }).series[0]
    : null
  return {
    code,
    period,
    adjust: 'qfq',
    total: bars.length,
    windowStart: win[0]?.date ?? null,
    windowEnd: win[win.length - 1]?.date ?? null,
    windowBars: win.length,
    truncated,
    note: truncated
      ? `窗口 ${win.length} 条超过 ${KLINE_MAX_BARS}，仅回最近 ${KLINE_TAIL_BARS} 条 + summary`
      : `窗口 ${win.length} 条已全部返回`,
    bars: truncated ? win.slice(-KLINE_TAIL_BARS) : win,
    ...(metrics
      ? {
          summary: {
            totalReturnPct: metrics.totalReturnPct,
            maxDrawdownPct: metrics.maxDrawdownPct,
            annualizedVolPct: metrics.annualizedVolPct
          }
        }
      : {})
  }
}
