/**
 * 集中类型定义（数据层 + 格式化层）
 *
 * 口径说明：Raw* 为外部数据源（stock-sdk CLI / 东方财富 API）的实测字段形状，
 * 属系统边界类型；因项目未引入运行期校验库，边界数据按实测 shape 静态声明，
 * 字段缺失时由各 format 函数提供兜底值。
 */

// ── 原始行情（stock-sdk CLI 返回） ─────────────────────────────

/** A股/港股/美股原始行情 */
export interface RawStockQuote {
  marketId?: string
  name: string
  code: string
  price: number
  change: number
  changePercent: number
  volume?: number
  amount?: number
  marketCap?: number
  marketType?: string
  market?: string
  assetType?: string
  source?: string
}

/** 基金原始净值行情（字段与股票不同：nav 代替 price，change 即涨跌幅） */
export interface RawFundQuote {
  code: string
  name: string
  nav: number
  accNav?: number
  /** 基金行情的涨跌幅存放在 change 字段（无 changePercent） */
  change: number
  navDate?: string
  timestamp?: number
  tz?: string
  market?: string
  assetType?: string
  source?: string
}

/** K线单条记录 */
export interface KlineBar {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume?: number
  amount?: number
  amplitude?: number
  changePercent?: number
  change?: number
  turnoverRate?: number
  timestamp?: number
  tz?: string
  code?: string
}

/** 搜索结果项 */
export interface SearchResultItem {
  code: string
  name: string
  market?: string
  type?: string
  category?: string
}

/** K线周期 */
export type KlinePeriod = 'daily' | 'weekly' | 'monthly'

// ── 股息率（src/dividend.ts 计算结果） ─────────────────────────

/**
 * 股息率计算结果
 */
export interface DividendYieldResult {
  symbol: string
  name: string
  currentPrice: number
  dividendPerShare: number
  yieldRate: number
  /**
   * 股息率计算口径说明。
   * 本结果采用「单期分红口径」（最新一期已实施分红 / 现价），非年度化口径，
   * 不同标的分红频次不同，横向对比或校准阈值前须先统一口径。
   */
  yieldBasis: string
  latestDividend: {
    reportDate: string
    dividendPretax: number
    dividendDesc: string
    assignProgress: string
  }
}

// ── 东方财富分红接口（原始记录，仅声明用到的字段） ─────────────

export interface EastMoneyDividendRecord {
  SECURITY_CODE?: string
  PRETAX_BONUS_RMB?: number
  ASSIGN_PROGRESS?: string
  EX_DIVIDEND_DATE?: string
  IMPL_PLAN_PROFILE?: string
  /** 东方财富返回的小数形式股息率（0.0512 表示 5.12%） */
  DIVIDENT_RATIO?: string
}

/** stock-sdk 分红历史记录（字段对齐 DividendDetail，含 null） */
export interface SdkDividendRecord {
  reportDate?: string | null
  dividendPretax?: number | null
  dividendDesc?: string | null
  assignProgress?: string | null
}

// ── 格式化输出（CLI 对外 JSON 结构，字段名为 snake_case） ──────

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
  /** 股息率计算口径（单期分红口径，非年度化） */
  yield_basis: string
  latest_dividend_date: string
  latest_dividend_desc: string
}

export type FormattedData = FormattedStock | FormattedFund | FormattedDividend

/** 通用输出行（outputData 可接收格式化结果、K线、搜索结果等异构对象数组） */
export type OutputRow = Record<string, unknown>
