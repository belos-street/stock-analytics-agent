/**
 * 输出格式化模块
 * 保持与 V1.x 输出格式兼容，同时支持新的数据结构
 */

export interface FormattedStock {
  type: 'stock'
  code: string
  name: string
  current_price: number
  change: number
  change_percent: number
  volume?: number
  amount?: number
  market_cap?: number
  update_time: string
}

export interface FormattedFund {
  type: 'fund'
  code: string
  name: string
  current_price: number
  change_percent: number
  update_time: string
}

export interface FormattedDividend {
  type: 'dividend'
  code: string
  name: string
  current_price: number
  dividend_per_share: number
  yield_rate: number
  latest_dividend_date: string
  latest_dividend_desc: string
}

export type FormattedData = FormattedStock | FormattedFund | FormattedDividend

/**
 * 格式化股票行情数据
 */
export function formatStockQuote(quote: any): FormattedStock {
  return {
    type: 'stock',
    code: quote.code || quote.symbol || '',
    name: quote.name || '',
    current_price: quote.price || 0,
    change: quote.change || 0,
    change_percent: quote.changePercent || 0,
    volume: quote.volume,
    amount: quote.amount,
    market_cap: quote.marketCap,
    update_time: quote.timestamp
      ? new Date(quote.timestamp).toLocaleString('zh-CN')
      : new Date().toLocaleString('zh-CN')
  }
}

/**
 * 格式化基金行情数据
 */
export function formatFundQuote(quote: any): FormattedFund {
  return {
    type: 'fund',
    code: quote.code || quote.symbol || '',
    name: quote.name || '',
    current_price: quote.price || quote.nav || 0,
    // 基金行情接口没有 changePercent 字段，涨跌幅存放在 change 字段
    change_percent: quote.changePercent ?? quote.change ?? 0,
    update_time: quote.timestamp
      ? new Date(quote.timestamp).toLocaleString('zh-CN')
      : new Date().toLocaleString('zh-CN')
  }
}

/**
 * 格式化股息率数据
 */
export function formatDividendYield(data: any): FormattedDividend {
  return {
    type: 'dividend',
    code: data.symbol,
    name: data.name,
    current_price: data.currentPrice,
    dividend_per_share: data.dividendPerShare,
    yield_rate: data.yieldRate,
    latest_dividend_date: data.latestDividend?.reportDate || '',
    latest_dividend_desc: data.latestDividend?.dividendDesc || ''
  }
}

/**
 * 输出数据到控制台
 */
export function outputData(
  data: any[],
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
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',')
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
  quotes: any[],
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
  quotes: any[],
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
  data: any[],
  format: 'json' | 'table' | 'csv' = 'json',
  pretty: boolean = false
) {
  const formatted = data.map(formatDividendYield)
  outputData(formatted, format, pretty)
}
