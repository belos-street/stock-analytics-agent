import { existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { StockSDK } from 'stock-sdk'

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
function execQuoteCLI(codes: string[], extraArgs: string[] = []): any[] {
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
    return JSON.parse(result)
  } catch (error: any) {
    const detail = error.stderr ? error.stderr.toString().trim() : error.message
    throw new Error(`行情查询失败 (${validCodes.join(',')}): ${detail}`, {
      cause: error
    })
  }
}

// A股行情（代码自动识别市场）
export async function getQuotes(codes: string[]) {
  return execQuoteCLI(codes)
}

// 基金行情（基金必须显式指定 --market fund）
export async function getFundQuotes(codes: string[]) {
  return execQuoteCLI(codes, ['--market', 'fund'])
}

// 港股行情（代码自动识别市场）
export async function getHKQuotes(codes: string[]) {
  return execQuoteCLI(codes)
}

// 美股行情（代码自动识别市场）
export async function getUSQuotes(codes: string[]) {
  return execQuoteCLI(codes)
}

// K线数据（使用SDK）
export async function getKline(symbol: string, period: string = 'daily') {
  return getSDK().kline.cn(symbol, { period: period as any })
}

// 搜索股票
export async function searchStock(keyword: string) {
  return getSDK().search(keyword)
}
