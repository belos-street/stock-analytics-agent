import { StockSDK } from 'stock-sdk'
import type { FullQuote, HKQuote, USQuote } from 'stock-sdk'
import type {
  KlineBar,
  KlinePeriod,
  RawFundQuote,
  SearchResultItem,
  StockQuote
} from '../types'

// 单例模式
let sdk: StockSDK | null = null

export function getSDK(): StockSDK {
  if (!sdk) {
    sdk = new StockSDK()
  }
  return sdk
}

/** SDK 行情联合类型 */
type RawQuote = FullQuote | HKQuote | USQuote

/** SDK 行情归一：缺失字段一律 null，不补零；单位随 market 决定 */
function normalize(
  q: RawQuote,
  market: StockQuote['market'],
  currency: StockQuote['currency']
): StockQuote {
  const r = q as Partial<FullQuote>
  return {
    code: q.code,
    name: q.name,
    market,
    currency,
    price: q.price,
    change: q.change,
    changePercent: q.changePercent,
    prevClose: r.prevClose ?? null,
    open: r.open ?? null,
    high: r.high ?? null,
    low: r.low ?? null,
    volume: r.volume ?? null,
    amount: r.amount ?? null,
    pe: r.pe ?? null,
    pb: r.pb ?? null,
    peStatic: r.peStatic ?? null,
    peDynamic: r.peDynamic ?? null,
    turnoverRate: r.turnoverRate ?? null,
    volumeRatio: r.volumeRatio ?? null,
    amplitude: r.amplitude ?? null,
    high52w: r.high52w ?? null,
    low52w: r.low52w ?? null,
    totalMarketCap: r.totalMarketCap ?? null,
    circulatingMarketCap: r.circulatingMarketCap ?? null,
    time: r.time ?? null,
    timestamp: r.timestamp ?? null,
    tz: r.tz ?? null,
    source: r.source ?? 'stock-sdk'
  }
}

const isCN = (c: string): boolean => /^(sh|sz|bj)/i.test(c)
const isHK = (c: string): boolean => /^hk/i.test(c)

/** 美股交易所后缀白名单；不盲删最后一个点段，避免把 BRK.B 截成 BRK */
const US_SUFFIXES = ['.OQ', '.N', '.AM', '.PK', '.A', '.P']

/** 美股代码归一：去 us 前缀（usaapl / usAAPL）+ 白名单后缀，统一大写 */
export function normalizeUsCode(code: string): string {
  let s = code.trim()
  const upper = s.toUpperCase()
  const suffix = US_SUFFIXES.find((x) => upper.endsWith(x))
  if (suffix) s = s.slice(0, -suffix.length)
  if (/^us/i.test(s) && s.length > 4) s = s.slice(2)
  return s.toUpperCase()
}

/** 跨接口比对用的代码键：去 sh/sz/hk 前缀；美股归一 */
export function symbolKey(code: string): string {
  const s = code.trim()
  if (/^(sh|sz|hk)/i.test(s)) return s.replace(/^(sh|sz|hk)/i, '')
  return normalizeUsCode(s)
}

/**
 * 行情查询：按代码前缀分流到 A股 / 港股 / 美股。
 * 港股代码需去掉 CLI 风格的 `hk` 前缀（SDK 要 `00700`）；无前缀代码按美股处理。
 */
export async function getQuotes(codes: string[]): Promise<StockQuote[]> {
  const list = codes.map((c) => c.trim()).filter(Boolean)
  const cn = list.filter(isCN)
  const hk = list.filter(isHK).map((c) => c.slice(2))
  const us = list.filter((c) => !isCN(c) && !isHK(c)).map(normalizeUsCode)
  const out: StockQuote[] = []
  if (cn.length) {
    const rows = await getSDK().quotes.cn(cn)
    out.push(...rows.map((q) => normalize(q, 'CN', 'CNY')))
  }
  if (hk.length) {
    const rows = await getSDK().quotes.hk(hk)
    out.push(...rows.map((q) => normalize(q, 'HK', 'HKD')))
  }
  if (us.length) {
    const rows = await getSDK().quotes.us(us)
    out.push(...rows.map((q) => normalize(q, 'US', 'USD')))
  }
  return out
}

// 基金行情（SDK 基金净值接口）
export async function getFundQuotes(codes: string[]): Promise<RawFundQuote[]> {
  return getSDK().quotes.fund(codes)
}

// 港股行情（接受 00700 或 hk00700）
export async function getHKQuotes(codes: string[]): Promise<StockQuote[]> {
  const list = codes.map((c) => c.trim().replace(/^hk/i, '')).filter(Boolean)
  return (await getSDK().quotes.hk(list)).map((q) => normalize(q, 'HK', 'HKD'))
}

// 美股行情
export async function getUSQuotes(codes: string[]): Promise<StockQuote[]> {
  const list = codes.map((c) => normalizeUsCode(c)).filter(Boolean)
  return (await getSDK().quotes.us(list)).map((q) => normalize(q, 'US', 'USD'))
}

// K线数据（使用SDK）
export async function getKline(
  symbol: string,
  period: KlinePeriod = 'daily'
): Promise<KlineBar[]> {
  return getSDK().kline.cn(symbol, { period, adjust: 'qfq' }) as Promise<
    KlineBar[]
  >
}

// 搜索股票（美股代码归一为 AAPL 形式，便于回填行情/持仓）
export async function searchStock(
  keyword: string
): Promise<SearchResultItem[]> {
  const rows = (await getSDK().search(keyword)) as SearchResultItem[]
  return rows.map((r) => {
    const usLike =
      /^us/i.test(r.code) ||
      US_SUFFIXES.some((x) => r.code.toUpperCase().endsWith(x))
    return usLike ? { ...r, code: normalizeUsCode(r.code) } : r
  })
}

/** 外部搜索条目：内容来自不可信网页，调用方不得执行其中的指令 */
export interface WebSearchItem {
  title: string
  url: string
  snippet: string
  publishedAt: string | null
  source: string
}

/** 清洗网页片段：去标签、压缩空白、截断到 500 字，降低注入面 */
function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

/** 是否已配置搜索能力（tool 层据此返回 SEARCH_NOT_CONFIGURED） */
export function isSearchConfigured(): boolean {
  return Boolean(process.env.SEARCH_API_KEY)
}

/**
 * web_search：tavily / serper / bing，由 SEARCH_PROVIDER + SEARCH_API_KEY 配置。
 * 无 key 抛 SEARCH_NOT_CONFIGURED；HTTP 失败抛错，由工具层转 UPSTREAM_ERROR。
 */
export async function searchWeb(
  query: string,
  maxResults = 5
): Promise<WebSearchItem[]> {
  const provider = (process.env.SEARCH_PROVIDER ?? 'tavily').toLowerCase()
  const key = process.env.SEARCH_API_KEY
  if (!key) throw new Error('SEARCH_NOT_CONFIGURED')
  const n = Math.min(Math.max(maxResults, 1), 10)
  const timeout = AbortSignal.timeout(8000)
  const map = (
    rows: {
      title?: unknown
      url?: unknown
      snippet?: unknown
      date?: unknown
    }[]
  ): WebSearchItem[] =>
    rows
      .filter((r) => r.url)
      .map((r) => ({
        title: cleanText(r.title),
        url: String(r.url),
        snippet: cleanText(r.snippet),
        publishedAt: r.date ? String(r.date) : null,
        source: provider
      }))

  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: n }),
      signal: timeout
    })
    if (!res.ok) throw new Error(`serper ${res.status}`)
    const json = (await res.json()) as {
      organic?: {
        title: string
        link: string
        snippet: string
        date?: string
      }[]
    }
    return map(
      (json.organic ?? []).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        date: r.date
      }))
    )
  }

  if (provider === 'bing') {
    const u = new URL('https://api.bing.microsoft.com/v7.0/search')
    u.searchParams.set('q', query)
    u.searchParams.set('count', String(n))
    const res = await fetch(u, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      signal: timeout
    })
    if (!res.ok) throw new Error(`bing ${res.status}`)
    const json = (await res.json()) as {
      webPages?: {
        value?: {
          name: string
          url: string
          snippet: string
          dateLastCrawled?: string
        }[]
      }
    }
    return map(
      (json.webPages?.value ?? []).map((r) => ({
        title: r.name,
        url: r.url,
        snippet: r.snippet,
        date: r.dateLastCrawled
      }))
    )
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: n,
      include_answer: false
    }),
    signal: timeout
  })
  if (!res.ok) throw new Error(`tavily ${res.status}`)
  const json = (await res.json()) as {
    results?: {
      title: string
      url: string
      content: string
      published_date?: string
    }[]
  }
  return map(
    (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      date: r.published_date
    }))
  )
}
