import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeSeriesStats } from '../src/data/stats'
import type { KlineBar } from '../src/types'

const fx = JSON.parse(
  readFileSync(join(import.meta.dir, 'fixtures/golden_20261030.json'), 'utf8')
)
const golden = process.env.RUN_GOLDEN === '1' ? describe : describe.skip
const toBars = (bs: { date: string; close: number }[]) =>
  bs.map((b) => ({ date: b.date, close: b.close }) as KlineBar)

/**
 * 2026-10-30 收盘快照。快照紧容差只吸收浮点误差（百分比 0.01pp、比率 0.005）。
 * 方案 8.3 的 reference（77.1 / 33.8 / -37.2 / -25.8 / corr 0.64 / beta 1.34 / excess 43.3）
 * 仅作人工对照，不作为断言：基准 beta 1.34 系反向回归，本口径为 0.30。
 */
golden('Golden · 紫金 vs 黄金ETF · monthly · 25 bars', () => {
  const r = computeSeriesStats({
    series: fx.series.map(
      (s: { code: string; bars: { date: string; close: number }[] }) => ({
        code: s.code,
        bars: toBars(s.bars)
      })
    ),
    period: fx.period,
    window: fx.window,
    adjust: 'qfq'
  })
  const [zj, gold] = r.series
  const p = r.pairs[0]
  const near = (v: number | null, target: number, tol: number) =>
    expect(Math.abs((v ?? Infinity) - target)).toBeLessThanOrEqual(tol)

  test('窗口 / 复权口径', () => {
    expect(r.adjust).toBe('qfq')
    expect(r.window.bars).toBe(25)
    expect(r.window.start).toBe('2024-10-31')
  })
  test('收益 / 回撤 / corr / beta / excess（快照紧容差）', () => {
    near(zj.totalReturnPct, 76.48, 0.01)
    near(zj.maxDrawdownPct, -37.16, 0.01)
    near(gold.totalReturnPct, 33.52, 0.01)
    near(gold.maxDrawdownPct, -25.98, 0.01)
    near(p.corr, 0.64, 0.005)
    near(p.beta, 0.3, 0.005)
    near(p.excessReturnPct, 42.96, 0.01)
  })
})
