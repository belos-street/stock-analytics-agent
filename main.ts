#!/usr/bin/env bun

/**
 * Stock Analytics Skill V2.0
 * 基于 stock-sdk 的股市投资分析助手
 *
 * 约定：stdout 只输出数据（JSON/table/csv），标题、提示、错误一律走 stderr，
 * 保证输出可被大模型或管道直接解析。
 */

import { Command } from 'commander'
import chalk from 'chalk'
import {
  getQuotes,
  getFundQuotes,
  getHKQuotes,
  getUSQuotes,
  getKline,
  searchStock
} from './src/sdk'
import { getDividendYields } from './src/dividend'
import {
  formatAndOutputStocks,
  formatAndOutputFunds,
  formatAndOutputDividends,
  outputData
} from './src/format'

const program = new Command()

program
  .name('stock-analytics')
  .description('股市投资分析助手 V2.0 - 基于 stock-sdk')
  .version('2.0.0')
  .option(
    '-s, --stocks <codes>',
    'A股/ETF/指数代码列表（逗号分隔，sh/sz前缀可省略）',
    ''
  )
  .option('-f, --funds <codes>', '基金代码列表（逗号分隔）', '')
  .option('--hk <codes>', '港股代码列表（逗号分隔）', '')
  .option('--us <codes>', '美股代码列表（逗号分隔）', '')
  .option('--dividend <codes>', '查询股息率（逗号分隔多个代码）', '')
  .option('--kline <code>', '查询K线数据', '')
  .option('--period <period>', 'K线周期: daily | weekly | monthly', 'daily')
  .option('--search <keyword>', '搜索股票/基金', '')
  .option('-o, --format <type>', '输出格式: json | table | csv', 'json')
  .option('--pretty', 'JSON美化输出', false)
  .option('--agent', '进入 AI 投资分析对话（需配置 .env 的 LLM 密钥）')
  .option('--ask <question>', '向 AI 投资分析助手提单个问题')
  .parse(process.argv)

const options = program.opts()

// 预先挂载 catch，避免并行请求在后序请求被 await 前产生未处理的 rejection
function track<T>(p: Promise<T> | null): Promise<T> | null {
  p?.catch(() => {})
  return p
}

async function main() {
  // AI agent 模式：--ask 单次提问 / --agent 交互对话（独立于下方 CLI 数据查询）
  if (options.agent || options.ask) {
    try {
      const { askOnce, chatLoop } = await import('./src/agent/run')
      if (options.ask) {
        console.log(await askOnce(options.ask))
      } else {
        await chatLoop()
      }
    } catch (error: any) {
      console.error(chalk.red(`启动 AI 助手失败：${error.message}`))
      process.exit(1)
    }
    return
  }

  const hasOptions =
    options.stocks ||
    options.funds ||
    options.hk ||
    options.us ||
    options.dividend ||
    options.kline ||
    options.search

  if (!hasOptions) {
    console.error(chalk.yellow('请指定股票或基金代码'))
    console.error(chalk.gray('使用 -h 查看帮助'))
    console.error('')
    console.error(chalk.cyan('示例:'))
    console.error('  bun main.ts -s sh600519,sh600036')
    console.error('  bun main.ts -f 006493,006961')
    console.error('  bun main.ts --hk 00700')
    console.error('  bun main.ts --dividend sh600941,sh600036')
    console.error('  bun main.ts --search 招商银行')
    process.exit(1)
  }

  const split = (raw: string) => raw.split(',').filter((s: string) => s.trim())

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
    options.kline ? getKline(options.kline, options.period) : null
  )
  const searchP = track(options.search ? searchStock(options.search) : null)

  // 按固定顺序输出各板块结果；单个板块失败不影响其他板块
  const errors: string[] = []
  async function output(
    title: string,
    p: Promise<any> | null,
    render: (data: any[]) => void
  ) {
    if (!p) return
    console.error(chalk.cyan(`\n=== ${title} ===`))
    try {
      const data = await p
      render(data)
    } catch (error: any) {
      console.error(chalk.red(`查询失败: ${error.message}`))
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

main()
