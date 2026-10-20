import { describe, test, expect } from 'bun:test'
import {
  getQuotes,
  getFundQuotes,
  getHKQuotes,
  getKline,
  searchStock
} from '../src/data/sdk'

describe('Stock SDK 测试', () => {
  // A股行情测试
  describe('A股行情', () => {
    test('查询单只股票 - 贵州茅台', async () => {
      const quotes = await getQuotes(['sh600519'])
      expect(quotes).toBeDefined()
      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].name).toBe('贵州茅台')
      expect(quotes[0].price).toBeGreaterThan(0)
    })

    test('查询多只股票', async () => {
      const quotes = await getQuotes(['sh600519', 'sh600036'])
      expect(quotes).toBeDefined()
      expect(quotes.length).toBe(2)
      expect(quotes[0].name).toBe('贵州茅台')
      expect(quotes[1].name).toBe('招商银行')
    })

    test('查询ETF - 红利低波50ETF', async () => {
      const quotes = await getQuotes(['sh515450'])
      expect(quotes).toBeDefined()
      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].code).toBe('515450')
    })
  })

  // 基金行情测试
  describe('基金行情', () => {
    test('查询基金 - 南方中债3-5年农发债', async () => {
      const quotes = await getFundQuotes(['006493'])
      expect(quotes).toBeDefined()
      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].name).toContain('南方中债')
      // 基金净值字段为 nav
      expect(quotes[0].nav).toBeDefined()
    })
  })

  // 港股行情测试
  describe('港股行情', () => {
    test('查询港股 - 腾讯控股', async () => {
      const quotes = await getHKQuotes(['00700'])
      expect(quotes).toBeDefined()
      expect(quotes.length).toBeGreaterThan(0)
      expect(quotes[0].name).toBe('腾讯控股')
      expect(quotes[0].price).toBeGreaterThan(0)
    })
  })

  // K线数据测试
  describe('K线数据', () => {
    test('查询日K线 - 贵州茅台', async () => {
      const kline = await getKline('sh600519', 'daily')
      expect(kline).toBeDefined()
      expect(kline.length).toBeGreaterThan(0)
      expect(kline[0]).toHaveProperty('date')
      expect(kline[0]).toHaveProperty('close')
      expect(kline[0]).toHaveProperty('volume')
    })
  })

  // 搜索功能测试
  describe('搜索功能', () => {
    test('搜索股票 - 招商银行', async () => {
      const results = await searchStock('招商银行')
      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.name === '招商银行')).toBe(true)
    })
  })
})
