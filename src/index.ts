/**
 * Stock Analytics Skill V2.0
 * 基于 stock-sdk 的股市投资分析助手
 */

// SDK 封装
export {
  getSDK,
  getQuotes,
  getFundQuotes,
  getHKQuotes,
  getUSQuotes,
  getKline,
  searchStock
} from './sdk'

// 股息率计算
export { getDividendYield, getDividendYields } from './dividend'
export type { DividendYieldResult } from './dividend'

// 输出格式化
export {
  formatStockQuote,
  formatFundQuote,
  formatDividendYield,
  formatAndOutputStocks,
  formatAndOutputFunds,
  formatAndOutputDividends,
  outputData
} from './format'
export type {
  FormattedStock,
  FormattedFund,
  FormattedDividend,
  FormattedData
} from './format'
