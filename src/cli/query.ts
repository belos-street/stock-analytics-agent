/**
 * 数据查询编排（模式 1 · CLI 数据查询）
 * 从 main.ts 抽离：按选项并行拉取各市场数据，分板块渲染输出。
 * 单个板块失败不影响其他板块。
 */

import chalk from 'chalk'
import {
  getQuotes,
  getFundQuotes,
  getHKQuotes,
  getUSQuotes,
  getKline,
  searchStock
} from '../data/sdk'
import { getDividendYields } from '../data/dividend'
import {
  formatAndOutputStocks,
  formatAndOutputFunds,
  formatAndOutputDividends,
  outputData
} from '../format'
import type { CliOptions } from './program'
import type { KlinePeriod } from '../types'

/** 预先挂载 catch，避免并行请求在后序请求被 await 前产生未处理的 rejection */
function track<T>(p: Promise<T> | null): Promise<T> | null {
  p?.catch(() => {})
  return p
}

/** 逗号分隔字符串 → 代码数组 */
function split(raw: string): string[] {
  return raw.split(',').filter((s: string) => s.trim())
}

/** 执行数据查询并按板块输出 */
export async function runQuery(options: CliOptions): Promise<void> {
  const stockCodes = split(options.stocks)
  const fundCodes = split(options.funds)
  const hkCodes = split(options.hk)
  const usCodes = split(options.us)
  const dividendCodes = split(options.dividend)

  // 并行发起所有数据请求
  const stocksP = track(stockCodes.length > 0 ? getQuotes(stockCodes) : null)
  const fundsP = track(fundCodes.length > 0 ? getFundQuotes(fundCodes) : null)
  const hkP = track(hkCodes.length > 0 ? getHKQuotes(hkCodes) : null)
  const usP = track(usCodes.length > 0 ? getUSQuotes(usCodes) : null)
  const dividendP = track(
    dividendCodes.length > 0 ? getDividendYields(dividendCodes) : null
  )
  const klineP = track(
    options.kline
      ? getKline(options.kline, options.period as KlinePeriod)
      : null
  )
  const searchP = track(options.search ? searchStock(options.search) : null)

  // 按固定顺序输出各板块结果；单个板块失败不影响其他板块
  const errors: string[] = []
  async function output<T>(
    title: string,
    p: Promise<T> | null,
    render: (data: T) => void
  ) {
    if (!p) return
    console.error(chalk.cyan(`\n=== ${title} ===`))
    try {
      const data = await p
      render(data)
    } catch (error) {
      console.error(
        chalk.red(
          `查询失败: ${error instanceof Error ? error.message : String(error)}`
        )
      )
      errors.push(title)
    }
  }

  await output('A股行情', stocksP, (data) =>
    formatAndOutputStocks(data, options.format, options.pretty)
  )
  await output('基金行情', fundsP, (data) =>
    formatAndOutputFunds(data, options.format, options.pretty)
  )
  await output('港股行情', hkP, (data) =>
    formatAndOutputStocks(data, options.format, options.pretty)
  )
  await output('美股行情', usP, (data) =>
    formatAndOutputStocks(data, options.format, options.pretty)
  )
  await output('股息率查询', dividendP, (data) => {
    if (data.length > 0) {
      formatAndOutputDividends(data, options.format, options.pretty)
    } else {
      console.error(chalk.yellow('未获取到股息率数据'))
    }
  })
  await output('K线数据', klineP, (data) => {
    if (data && data.length > 0) {
      console.error(`获取到 ${data.length} 条K线数据`)
      outputData(data.slice(-10), options.format, options.pretty) // 只显示最近10条
    } else {
      console.error(chalk.yellow('未获取到K线数据'))
    }
  })
  await output('搜索结果', searchP, (data) => {
    if (data && data.length > 0) {
      outputData(data, options.format, options.pretty)
    } else {
      console.error(chalk.yellow('未找到匹配的股票/基金'))
    }
  })

  if (errors.length > 0) {
    console.error(
      chalk.red(`\n共有 ${errors.length} 个查询失败: ${errors.join('、')}`)
    )
    process.exit(1)
  }
}

/** 无查询参数时的用法提示 */
export function printUsage(): void {
  console.error(chalk.yellow('请指定股票或基金代码'))
  console.error(chalk.gray('使用 -h 查看帮助'))
  console.error('')
  console.error(chalk.cyan('示例:'))
  console.error('  bun main.ts -s sh600519,sh600036')
  console.error('  bun main.ts -f 006493,006961')
  console.error('  bun main.ts --hk 00700')
  console.error('  bun main.ts --dividend sh600941,sh600036')
  console.error('  bun main.ts --search 招商银行')
}
