/**
 * 输出格式化模块
 * 保持与 V1.x 输出格式兼容，同时支持新的数据结构
 */

import type {
  DividendYieldResult,
  FormattedDividend,
  FormattedFund,
  FormattedStock,
  RawFundQuote,
  RawStockQuote
} from './types'

export type {
  FormattedData,
  FormattedDividend,
  FormattedFund,
  FormattedStock
} from './types'

/** 统一时间戳格式化：有 timestamp 用之，否则用当前时间 */
function formatUpdateTime(timestamp?: number): string {
  return timestamp
    ? new Date(timestamp).toLocaleString('zh-CN')
    : new Date().toLocaleString('zh-CN')
}

/**
 * 格式化股票行情数据
 */
export function formatStockQuote(quote: RawStockQuote): FormattedStock {
  return {
    type: 'stock',
    code: quote.code,
    name: quote.name,
    current_price: quote.price,
    change: quote.change,
    change_percent: quote.changePercent,
    volume: quote.volume,
    amount: quote.amount,
    market_cap: quote.marketCap,
    // 股票行情无 timestamp 字段（SDK 未返回），更新时间取当前
    update_time: formatUpdateTime()
  }
}

/**
 * 格式化基金行情数据
 */
export function formatFundQuote(quote: RawFundQuote): FormattedFund {
  return {
    type: 'fund',
    code: quote.code,
    name: quote.name,
    current_price: quote.nav,
    // 基金行情接口没有 changePercent 字段，涨跌幅存放在 change 字段
    change_percent: quote.change,
    update_time: formatUpdateTime(quote.timestamp)
  }
}

/**
 * 格式化股息率数据
 */
export function formatDividendYield(
  data: DividendYieldResult
): FormattedDividend {
  return {
    type: 'dividend',
    code: data.symbol,
    name: data.name,
    current_price: data.currentPrice,
    dividend_per_share: data.dividendPerShare,
    yield_rate: data.yieldRate,
    yield_basis: data.yieldBasis,
    latest_dividend_date: data.latestDividend?.reportDate || '',
    latest_dividend_desc: data.latestDividend?.dividendDesc || ''
  }
}

/**
 * 输出数据到控制台
 */
export function outputData<T extends object>(
  data: T[],
  format: 'json' | 'table' | 'csv' = 'json',
  pretty: boolean = false
) {
  if (!data || data.length === 0) {
    console.error('未获取到数据')
    return
  }

  switch (format) {
    case 'json': {
      const jsonOutput = pretty
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data)
      console.log(jsonOutput)
      break
    }

    case 'table':
      console.table(data)
      break

    case 'csv': {
      const first = data[0]
      if (first) {
        const headers = Object.keys(first).join(',')
        const rows = data.map((item) =>
          Object.values(item)
            .map((v) =>
              typeof v === 'string' && v.includes(',') ? `"${v}"` : v
            )
            .join(',')
        )
        console.log([headers, ...rows].join('\n'))
      }
      break
    }
  }
}

/**
 * 格式化并输出股票数据
 */
export function formatAndOutputStocks(
  quotes: RawStockQuote[],
  format: 'json' | 'table' | 'csv' = 'json',
  pretty: boolean = false
) {
  const formatted = quotes.map(formatStockQuote)
  outputData(formatted, format, pretty)
}

/**
 * 格式化并输出基金数据
 */
export function formatAndOutputFunds(
  quotes: RawFundQuote[],
  format: 'json' | 'table' | 'csv' = 'json',
  pretty: boolean = false
) {
  const formatted = quotes.map(formatFundQuote)
  outputData(formatted, format, pretty)
}

/**
 * 格式化并输出股息率数据
 */
export function formatAndOutputDividends(
  data: DividendYieldResult[],
  format: 'json' | 'table' | 'csv' = 'json',
  pretty: boolean = false
) {
  const formatted = data.map(formatDividendYield)
  outputData(formatted, format, pretty)
}
