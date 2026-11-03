/**
 * 工具运行时：单轮预算、同参 memo、统一 envelope 元信息。
 * 不依赖任何具体工具模块，避免循环引用。
 */

import { z } from 'zod'
import { symbolKey } from '../../data/sdk'
import {
  fail,
  isoFromQuoteTime,
  latestISO,
  localISO,
  type EnvelopeMeta,
  type MissingField
} from '../envelope'
import type { RawFundQuote, StockQuote } from '../../types'

/** 保留两位小数 */
export const r2 = (v: number): number => Math.round(v * 100) / 100

/** 逗号分隔代码 → 数组 */
export const parseCodes = (codes: string): string[] =>
  codes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** 无数据时间的工具：asOf = fetchedAt */
export const fetchMeta = (source: string): EnvelopeMeta => ({
  source,
  asOf: localISO(),
  asOfKind: 'fetch',
  fetchedAt: localISO()
})

/** 行情行：附数据时间；无法解析时为 null，由调用方降级 */
export type QuoteRow = StockQuote & {
  asOf: string | null
  asOfKind: 'quote' | 'fetch'
}

export function quoteRow(q: StockQuote): QuoteRow {
  const iso = isoFromQuoteTime(q.time, q.timestamp, q.tz)
  return { ...q, asOf: iso, asOfKind: iso ? 'quote' : 'fetch' }
}

/** 行情类 envelope meta：asOf 取最新数据时间；任一行无时间则 stale */
export function quoteMeta(
  source: string,
  rows: QuoteRow[],
  requested: string[]
): EnvelopeMeta {
  const fetchedAt = localISO()
  const latest = latestISO(rows.map((r) => r.asOf))
  const missing: MissingField[] = requested
    .filter((c) => !rows.some((r) => symbolKey(r.code) === symbolKey(c)))
    .map((c) => ({ field: c, reason: '未返回行情' }))
  return {
    source,
    asOf: latest ?? fetchedAt,
    asOfKind: latest ? 'quote' : 'fetch',
    fetchedAt,
    currency: rows.length > 0 ? currencyOf(rows) : null,
    unit: rows.length > 0 ? unitOf(rows) : undefined,
    missing,
    stale: rows.some((r) => !r.asOf)
  }
}

/** 基金行：asOf = 净值日期 */
export function fundRow(q: RawFundQuote) {
  return { ...q, asOf: q.navDate ?? null, asOfKind: 'navDate' as const }
}

export const codesSchema = z
  .string()
  .describe(
    '逗号分隔的代码列表。A股/ETF用 sh/sz 前缀（如 sh600519,sz000001），港股用 hk 前缀（如 hk00700），美股直接写代码（如 AAPL）'
  )

/** 行情单位：货币类随市场变化；比率/倍数类跨市场一致 */
const quoteUnit = (
  cur: string,
  big: string,
  vol: string
): Record<string, string> => ({
  price: cur,
  change: cur,
  changePercent: '%',
  prevClose: cur,
  open: cur,
  high: cur,
  low: cur,
  high52w: cur,
  low52w: cur,
  amount: cur === '元' ? '万元' : cur,
  volume: vol,
  pe: '倍',
  pb: '倍',
  peStatic: '倍',
  peDynamic: '倍',
  turnoverRate: '%',
  volumeRatio: '倍',
  amplitude: '%',
  totalMarketCap: big,
  circulatingMarketCap: big
})

const UNITS: Record<string, Record<string, string>> = {
  CN: quoteUnit('元', '亿元', '手'),
  HK: quoteUnit('港元', '亿港元', '股'),
  US: quoteUnit('美元', '亿美元', '股')
}

/** 按返回的行情市场给出 unit；混合市场时提示逐行看 currency */
export function unitOf(quotes: StockQuote[]): Record<string, string> {
  const markets = [...new Set(quotes.map((q) => q.market))]
  if (markets.length === 1) return UNITS[markets[0]]
  return {
    price: '见每行 currency',
    change: '见每行 currency',
    amount: 'CN 万元 / HK·US 原币',
    totalMarketCap: 'CN 亿元 / HK·US 亿原币',
    circulatingMarketCap: 'CN 亿元 / HK·US 亿原币',
    volume: 'CN 手 / HK·US 股',
    pe: '倍',
    pb: '倍',
    turnoverRate: '%',
    amplitude: '%'
  }
}

export function currencyOf(quotes: StockQuote[]): string {
  const list = [...new Set(quotes.map((q) => q.currency))]
  return list.length === 1 ? list[0] : 'MIXED'
}

/** 单轮工具预算：按调用次数计（含 memo 命中），第 9 次直接拒绝 */
const TOOL_BUDGET = 8
let toolCalls = 0
const toolMemo = new Map<string, string>()

/** 重置单轮工具运行时（每次 askOnce / REPL 单轮开始时调用） */
export function resetToolRuntime(): void {
  toolCalls = 0
  toolMemo.clear()
}

/** 包装工具执行：预算拦截 + 同参回放；超限返回 JSON 错误而不抛异常 */
export function governTool<A>(
  name: string,
  run: (args: A) => Promise<string> | string
) {
  return async (args: A): Promise<string> => {
    toolCalls += 1
    if (toolCalls > TOOL_BUDGET) {
      return fail('TOOL_BUDGET_EXCEEDED', '请基于已获取数据作答')
    }
    const key = `${name}:${JSON.stringify(args)}`
    const cached = toolMemo.get(key)
    if (cached !== undefined) return cached
    try {
      const result = await run(args)
      toolMemo.set(key, result)
      return result
    } catch {
      // 失败不写 memo，避免把一次性故障固化成同一轮的“事实”
      return fail('UPSTREAM_ERROR', '工具执行失败，请稍后重试', true)
    }
  }
}
