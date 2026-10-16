#!/usr/bin/env bun

/**
 * stock-sdk 测试脚本
 * 测试各种数据源和功能
 */

import { StockSDK } from 'stock-sdk'
import { execSync } from 'child_process'

const sdk = new StockSDK()

// 测试结果收集
interface TestResult {
  name: string
  success: boolean
  data?: any
  error?: string
}

const results: TestResult[] = []

// 测试函数
async function test(name: string, fn: () => Promise<any>) {
  try {
    console.log(`\n🧪 测试: ${name}`)
    const data = await fn()
    results.push({ name, success: true, data })
    console.log(`✅ 成功`)
    return data
  } catch (error: any) {
    results.push({ name, success: false, error: error.message })
    console.log(`❌ 失败: ${error.message}`)
    return null
  }
}

// 打印分割线
function printSeparator() {
  console.log('\n' + '='.repeat(60))
}

// 格式化输出
function printJson(data: any, limit = 3) {
  if (Array.isArray(data)) {
    console.log(JSON.stringify(data.slice(0, limit), null, 2))
    if (data.length > limit) {
      console.log(`... 共 ${data.length} 条数据`)
    }
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

// 通过 CLI 执行命令
function execCLI(command: string): any {
  try {
    const result = execSync(`npx stock-sdk ${command}`, { encoding: 'utf-8' })
    return JSON.parse(result)
  } catch (error) {
    throw new Error(`CLI 命令执行失败: ${command}`, { cause: error })
  }
}

async function main() {
  console.log('🚀 stock-sdk 测试开始')
  console.log(`📦 SDK 版本: stock-sdk`)

  // ==================== 1. A股行情测试（使用CLI） ====================
  printSeparator()
  console.log('📊 1. A股行情测试')

  await test('A股单只股票 - 贵州茅台', async () => {
    const quotes = execCLI('quote sh600519 --format json -q')
    printJson(quotes)
    return quotes
  })

  await test('A股多只股票 - 茅台+招行+移动', async () => {
    // stock-sdk CLI 的多个代码用空格分隔
    const quotes = execCLI('quote sh600519 sh600036 sh600941 --format json -q')
    printJson(quotes)
    return quotes
  })

  await test('A股ETF - 红利低波50ETF', async () => {
    const quotes = execCLI('quote sh515450 --format json -q')
    printJson(quotes)
    return quotes
  })

  // ==================== 2. 基金行情测试（使用CLI） ====================
  printSeparator()
  console.log('📈 2. 基金行情测试')

  await test('基金行情 - 南方中债3-5年农发债', async () => {
    // 基金必须显式指定 --market fund
    const quotes = execCLI('quote 006493 --market fund --format json -q')
    printJson(quotes)
    return quotes
  })

  // ==================== 3. 港股行情测试（使用CLI） ====================
  printSeparator()
  console.log('🇭🇰 3. 港股行情测试')

  await test('港股行情 - 腾讯控股', async () => {
    const quotes = execCLI('quote 00700 --format json -q')
    printJson(quotes)
    return quotes
  })

  // ==================== 4. K线数据测试（使用SDK） ====================
  printSeparator()
  console.log('📉 4. K线数据测试')

  await test('A股日K线 - 贵州茅台', async () => {
    const kline = await sdk.kline.cn('sh600519', { period: 'daily' })
    printJson(kline, 5)
    return kline
  })

  // ==================== 5. 分红数据测试（使用SDK） ====================
  printSeparator()
  console.log('💰 5. 分红数据测试')

  await test('分红明细 - 中国移动', async () => {
    const dividends = await sdk.reference.dividendDetail('sh600941')
    printJson(dividends, 3)
    return dividends
  })

  await test('分红明细 - 招商银行', async () => {
    const dividends = await sdk.reference.dividendDetail('sh600036')
    printJson(dividends, 3)
    return dividends
  })

  // ==================== 6. 股息率计算测试（使用CLI+SDK） ====================
  printSeparator()
  console.log('📊 6. 股息率计算测试')

  await test('股息率计算 - 中国移动', async () => {
    // 获取分红数据
    const dividends = await sdk.reference.dividendDetail('sh600941')
    if (!dividends || dividends.length === 0) {
      throw new Error('未获取到分红数据')
    }

    // 获取当前股价（使用CLI）
    const quotes = execCLI('quote sh600941 --format json -q')
    if (!quotes || quotes.length === 0) {
      throw new Error('未获取到行情数据')
    }

    const currentPrice = quotes[0].price
    const latestDividend = dividends[0]
    const dividendPerShare = (latestDividend.dividendPretax || 0) / 10
    const yieldRate = (dividendPerShare / currentPrice) * 100

    console.log(`当前股价: ${currentPrice} 元`)
    console.log(`最新分红: 每10股派 ${latestDividend.dividendPretax} 元`)
    console.log(`每股分红: ${dividendPerShare} 元`)
    console.log(`股息率: ${yieldRate.toFixed(2)}%`)

    return { currentPrice, dividendPerShare, yieldRate }
  })

  await test('股息率计算 - 招商银行', async () => {
    const dividends = await sdk.reference.dividendDetail('sh600036')
    if (!dividends || dividends.length === 0) {
      throw new Error('未获取到分红数据')
    }

    const quotes = execCLI('quote sh600036 --format json -q')
    if (!quotes || quotes.length === 0) {
      throw new Error('未获取到行情数据')
    }

    const currentPrice = quotes[0].price
    const latestDividend = dividends[0]
    const dividendPerShare = (latestDividend.dividendPretax || 0) / 10
    const yieldRate = (dividendPerShare / currentPrice) * 100

    console.log(`当前股价: ${currentPrice} 元`)
    console.log(`最新分红: 每10股派 ${latestDividend.dividendPretax} 元`)
    console.log(`每股分红: ${dividendPerShare} 元`)
    console.log(`股息率: ${yieldRate.toFixed(2)}%`)

    return { currentPrice, dividendPerShare, yieldRate }
  })

  // ==================== 7. 交易日历测试（使用SDK） ====================
  printSeparator()
  console.log('📅 7. 交易日历测试')

  await test('今天是否交易日', async () => {
    const today = new Date().toISOString().split('T')[0]
    const isTrading = await sdk.calendar.isTradingDay(today)
    console.log(`${today} 是否交易日: ${isTrading}`)
    return { date: today, isTrading }
  })

  // ==================== 8. 搜索功能测试（使用SDK） ====================
  printSeparator()
  console.log('🔍 8. 搜索功能测试')

  await test('搜索股票 - 招商银行', async () => {
    const found = await sdk.search('招商银行')
    printJson(found)
    return found
  })

  // ==================== 测试结果汇总 ====================
  printSeparator()
  console.log('📊 测试结果汇总')

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  console.log(`✅ 成功: ${successCount}`)
  console.log(`❌ 失败: ${failCount}`)
  console.log(
    `📊 成功率: ${((successCount / results.length) * 100).toFixed(1)}%`
  )

  if (failCount > 0) {
    console.log('\n❌ 失败的测试:')
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`))
  }

  console.log('\n✨ 测试完成!')
}

// 运行测试
main().catch(console.error)
