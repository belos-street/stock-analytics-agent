import { existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { StockSDK } from 'stock-sdk'
import type {
  KlineBar,
  KlinePeriod,
  RawFundQuote,
  RawStockQuote,
  SearchResultItem
} from '../types'

// 单例模式
let sdk: StockSDK | null = null

export function getSDK(): StockSDK {
  if (!sdk) {
    sdk = new StockSDK()
  }
  return sdk
}

/**
 * 解析 stock-sdk CLI 可执行路径。
 * 优先使用项目本地安装的 bin（比 npx 快约一倍），找不到时回退到 npx。
 */
function resolveStockSdkBin(): { cmd: string; prefixArgs: string[] } {
  const localBin = join(
    dirname(fileURLToPath(import.meta.url)),
    '../node_modules/.bin/stock-sdk'
  )
  if (existsSync(localBin)) {
    return { cmd: localBin, prefixArgs: [] }
  }
  return { cmd: 'npx', prefixArgs: ['stock-sdk'] }
}

/**
 * 通过CLI获取行情（避免Bun编码问题）。
 * stock-sdk CLI 会按代码前缀自动识别市场（sh/sz/hk/us），基金须显式 --market fund。
 */
function execQuoteCLI<T>(codes: string[], extraArgs: string[] = []): T[] {
  const validCodes = codes.filter((c) => c.trim())
  if (validCodes.length === 0) return []

  const { cmd, prefixArgs } = resolveStockSdkBin()
  try {
    const result = execFileSync(
      cmd,
      [
        ...prefixArgs,
        'quote',
        ...validCodes,
        ...extraArgs,
        '--format',
        'json',
        '-q'
      ],
      { encoding: 'utf-8' }
    )
    return JSON.parse(result) as T[]
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string }
    const detail = err.stderr
      ? err.stderr.toString().trim()
      : (err.message ?? String(error))
    throw new Error(`行情查询失败 (${validCodes.join(',')}): ${detail}`, {
      cause: error
    })
  }
}

// A股行情（代码自动识别市场）
export async function getQuotes(codes: string[]): Promise<RawStockQuote[]> {
  return execQuoteCLI<RawStockQuote>(codes)
}

// 基金行情（基金必须显式指定 --market fund）
export async function getFundQuotes(codes: string[]): Promise<RawFundQuote[]> {
  return execQuoteCLI<RawFundQuote>(codes, ['--market', 'fund'])
}

// 港股行情（代码自动识别市场）
export async function getHKQuotes(codes: string[]): Promise<RawStockQuote[]> {
  return execQuoteCLI<RawStockQuote>(codes)
}

// 美股行情（代码自动识别市场）
export async function getUSQuotes(codes: string[]): Promise<RawStockQuote[]> {
  return execQuoteCLI<RawStockQuote>(codes)
}

// K线数据（使用SDK）
export async function getKline(
  symbol: string,
  period: KlinePeriod = 'daily'
): Promise<KlineBar[]> {
  return getSDK().kline.cn(symbol, { period }) as Promise<KlineBar[]>
}

// 搜索股票
export async function searchStock(
  keyword: string
): Promise<SearchResultItem[]> {
  return getSDK().search(keyword) as Promise<SearchResultItem[]>
}
