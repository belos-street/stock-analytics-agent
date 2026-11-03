import { describe, test, expect } from 'bun:test'
import { computeSeriesStats } from '../src/data/stats'
import type { KlineBar } from '../src/types'

const bars = (cs: number[]): KlineBar[] =>
  cs.map((c, i) => ({ date: `d${i}`, open: c, high: c, low: c, close: c }))
const acc = (rs: number[], start = 100): number[] =>
  rs.reduce((a, r) => [...a, a[a.length - 1] * (1 + r)], [start])
const run = (list: number[][], adjust?: string, window?: number) =>
  computeSeriesStats({
    series: list.map((c, i) => ({ code: `s${i}`, bars: bars(c) })),
    period: 'monthly',
    window,
    adjust
  })
const one = (cs: number[]) => run([cs]).series[0]
const pair = (a: number[], b: number[]) => run([a, b]).pairs[0]
const R = [0.01, -0.02, 0.03, 0.05, -0.04]

describe('computeSeriesStats · L1 单元测试', () => {
  test('1. 同一序列：corr=1、beta=1', () => {
    expect(pair(acc(R), acc(R))).toMatchObject({ corr: 1, beta: 1 })
  })
  test('2. 因变量收益 = 2 × 基准：beta=2', () => {
    const p = pair(acc(R), acc(R.map((r) => r * 2)))
    expect(p).toMatchObject({ corr: 1, beta: 2 })
  })
  test('3. 因变量收益 = -基准：corr=-1、beta=-1', () => {
    const p = pair(acc(R), acc(R.map((r) => -r)))
    expect(p).toMatchObject({ corr: -1, beta: -1 })
  })
  test('4. 基准零波动：corr / beta 为 null', () => {
    const p = pair([100, 100, 100, 100, 100, 100], acc(R))
    expect(p).toMatchObject({ corr: null, beta: null })
  })
  test('5. 最大回撤 100 → 120 → 90 → 110 = -25.0', () => {
    expect(one([100, 120, 90, 110]).maxDrawdownPct).toBe(-25)
  })
  test('6. 区间收益 100 → 177.1 = 77.1', () => {
    expect(one([100, 177.1]).totalReturnPct).toBe(77.1)
  })
  test('7. 12 期收益全为 +1%：年化波动≈0', () => {
    const v = one(acc(Array(12).fill(0.01))).annualizedVolPct!
    expect(Math.abs(v)).toBeLessThan(1e-9)
  })
  test('8. 价格分位：收于窗口最低 / 最高 = 0 / 100', () => {
    expect(one([100, 120, 90, 90]).pricePercentile5y).toBe(0)
    expect(one([100, 90, 120, 120]).pricePercentile5y).toBe(100)
  })
  test('9. 空 / 单点 / NaN：指标 null 且不抛异常', () => {
    expect(one([]).totalReturnPct).toBeNull()
    expect(one([100]).maxDrawdownPct).toBeNull()
    expect(one([100, Number.NaN, 120]).totalReturnPct).toBeNull()
  })
  test('10. 30 条取 window=24，起点为第 7 条', () => {
    const cs = Array.from({ length: 30 }, (_, i) => 100 + i)
    const w = run([cs], undefined, 24).window
    expect(w).toMatchObject({ bars: 24, start: 'd6', end: 'd29' })
  })
  test('11. 复权缺失：照算，adjust=unknown + warning', () => {
    const r = run([[100, 120, 110]])
    expect(r).toMatchObject({ adjust: 'unknown' })
    expect(r.warning).toBeTruthy()
    expect(run([[100, 120, 110]], 'qfq').warning).toBeUndefined()
  })
})
