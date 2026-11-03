import { beforeEach, describe, expect, test } from 'bun:test'
import {
  computeSeriesStatsTool,
  getFundQuote,
  getStockQuote,
  governTool,
  loadSkillTool,
  readWatchlistTool,
  resetToolRuntime,
  webSearchTool
} from '../src/agent/tools'
import {
  isSafeDocName,
  listWatchlistDocs,
  readWatchlistDoc
} from '../src/agent/tools/watchlist'
import { buildKlineWindow } from '../src/data/stats'
import { fail, isoFromQuoteTime, localISO, ok } from '../src/agent/envelope'
import { parsePositionHoldings } from '../src/agent/position'
import { checkCompliance } from '../src/agent/compliance'
import { isSearchConfigured, normalizeUsCode, searchWeb } from '../src/data/sdk'
import type { KlineBar } from '../src/types'

/** 300 根等值 bar，仅用于验证窗口截断 */
const B300: KlineBar[] = Array.from({ length: 300 }, (_, i) => ({
  date: `d${i}`,
  open: 1,
  high: 1,
  low: 1,
  close: 1
}))

describe('agent 工具调用治理', () => {
  beforeEach(() => resetToolRuntime())

  test('1. K线默认窗口 daily 250 / weekly 104 / monthly 120，且带 windowStart', () => {
    const monthly = buildKlineWindow('x', B300, 'monthly')
    expect(monthly).toMatchObject({ windowBars: 120, truncated: false })
    expect(monthly.windowStart).toBe('d180')
    expect(monthly.bars.length).toBe(120)
    const weekly = buildKlineWindow('x', B300, 'weekly')
    expect(weekly).toMatchObject({ windowBars: 104, truncated: false })
    const daily = buildKlineWindow('x', B300, 'daily')
    expect(daily).toMatchObject({
      windowBars: 250,
      truncated: true,
      windowStart: 'd50'
    })
    expect(daily.bars.length).toBe(20)
    expect(daily.summary).toBeDefined()
    const limited = buildKlineWindow('x', B300, 'monthly', 60)
    expect(limited.windowBars).toBe(60)
  })

  test('2. 单轮第 9 次调用返回 TOOL_BUDGET_EXCEEDED', async () => {
    let hits = 0
    const stub = governTool('stub', async () => {
      hits += 1
      return 'ok'
    })
    const outputs: string[] = []
    for (let i = 0; i < 9; i++) outputs.push(await stub({ i }))
    expect(hits).toBe(8)
    expect(JSON.parse(outputs[8]).error.code).toBe('TOOL_BUDGET_EXCEEDED')
  })

  test('3. 同参第二次调用命中 memo，不再执行', async () => {
    let hits = 0
    const stub = governTool('stub', async () => {
      hits += 1
      return `r${hits}`
    })
    const first = await stub({ code: 'sh600519' })
    const second = await stub({ code: 'sh600519' })
    expect(hits).toBe(1)
    expect(second).toBe(first)
  })

  test('5. envelope：成功带 source/asOf/unit，失败带 code/hint/retryable', () => {
    const out = JSON.parse(
      ok([{ price: 10 }], {
        source: 'tencent',
        asOf: localISO(),
        asOfKind: 'fetch',
        fetchedAt: localISO(),
        currency: 'CNY',
        unit: { price: '元' }
      })
    )
    expect(out).toMatchObject({
      ok: true,
      meta: {
        source: 'tencent',
        asOfKind: 'fetch',
        currency: 'CNY',
        unit: { price: '元' }
      }
    })
    expect(typeof out.meta.asOf).toBe('string')
    const err = JSON.parse(fail('X', 'hint'))
    expect(err).toMatchObject({
      ok: false,
      error: { code: 'X', hint: 'hint', retryable: false }
    })
  })

  test('6. 持仓表解析：金额 / 份额 / 成本与续行分类', () => {
    const text = [
      '| 资产大类 | 标的 | 代码 | 查询参数 | 目标金额 | 当前金额 | 持有份额 | 成本价 | 单标的金额上限 | 买入理由/备注 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| 固收类 | 南方中债 | 006493 | -f | 10w | 15w | — | — | 19.5w | 备注 |',
      '| <br /> | 恒生科技ETF | sh513010 | -s | 5w | 2w | ≈35,700 | ≈0.565 | 6.5w ⚠️ | 定投 |'
    ].join('\n')
    const rows = parsePositionHoldings(text)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      targetAmount: 100000,
      currentAmount: 150000,
      shares: null,
      cost: null,
      limitAmount: 195000
    })
    expect(rows[1]).toMatchObject({
      category: '固收类',
      targetAmount: 50000,
      shares: 35700,
      cost: 0.565,
      limitAmount: 65000
    })
  })

  test('7. 空参统一 envelope，无裸字符串', async () => {
    const results = [
      JSON.parse(await getStockQuote.invoke({ codes: '' })),
      JSON.parse(await getFundQuote.invoke({ codes: '' })),
      JSON.parse(await computeSeriesStatsTool.invoke({ codes: '' }))
    ]
    for (const r of results) {
      expect(r.ok).toBe(false)
      expect(r.error.code).toBe('INVALID_ARGUMENT')
    }
  })

  test('8. 上游抛出 → UPSTREAM_ERROR，且失败不写 memo', async () => {
    let hits = 0
    const stub = governTool('stub-throw', async () => {
      hits += 1
      throw new Error('boom')
    })
    const a = JSON.parse(await stub({ x: 1 }))
    const b = JSON.parse(await stub({ x: 1 }))
    expect(a.error.code).toBe('UPSTREAM_ERROR')
    expect(b.error.code).toBe('UPSTREAM_ERROR')
    expect(hits).toBe(2)
  })

  test('9. load_skill 路径白名单：../ 拒绝', async () => {
    const r = JSON.parse(
      await loadSkillTool.invoke({ name: '../business/report-review' })
    )
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('PATH_NOT_ALLOWED')
  })

  test('10. US 代码归一（含后缀白名单与 BRK.B 保护）', () => {
    expect(normalizeUsCode('usaapl.oq')).toBe('AAPL')
    expect(normalizeUsCode('AAPL.OQ')).toBe('AAPL')
    expect(normalizeUsCode('usAAPL')).toBe('AAPL')
    expect(normalizeUsCode('BRK.B')).toBe('BRK.B')
    expect(normalizeUsCode('USB')).toBe('USB')
  })

  test('11. 行情时间归一：时间戳 / CN 紧凑格式 / US 墙钟 / 非法值', () => {
    expect(isoFromQuoteTime(null, 1793340220000, 'Asia/Shanghai')).toMatch(
      /^2026-10-30T/
    )
    expect(isoFromQuoteTime('20261030140601', null, 'Asia/Shanghai')).toBe(
      '2026-10-30T14:06:01+08:00'
    )
    expect(
      isoFromQuoteTime('2026-10-29 16:00:01', null, 'America/New_York')
    ).toMatch(/-04:00$/)
    expect(isoFromQuoteTime('bad', null, null)).toBeNull()
  })

  test('12. 搜索未配置：SEARCH_NOT_CONFIGURED，不假装能搜', async () => {
    const savedKey = process.env.SEARCH_API_KEY
    const savedLlm = process.env.OPENAI_API_KEY
    const savedProvider = process.env.SEARCH_PROVIDER
    delete process.env.SEARCH_API_KEY
    delete process.env.OPENAI_API_KEY
    process.env.SEARCH_PROVIDER = 'tavily'
    try {
      const r = JSON.parse(
        await webSearchTool.invoke({ query: '中国移动 政策' })
      )
      expect(r.ok).toBe(false)
      expect(r.error.code).toBe('SEARCH_NOT_CONFIGURED')
    } finally {
      if (savedKey !== undefined) process.env.SEARCH_API_KEY = savedKey
      if (savedLlm !== undefined) process.env.OPENAI_API_KEY = savedLlm
      if (savedProvider !== undefined) {
        process.env.SEARCH_PROVIDER = savedProvider
      } else {
        delete process.env.SEARCH_PROVIDER
      }
    }
  })

  test('13. 合规 lint：概率承诺命中，正常引用 / 否定句不误伤', () => {
    expect(checkCompliance('大概率上涨').hit).toBe(true)
    expect(checkCompliance('年报披露的股息率为 3%').hit).toBe(false)
    expect(checkCompliance('债基并非无风险').hit).toBe(false)
    expect(checkCompliance('无风险利率').hit).toBe(false)
  })

  test('14. watchlist 只读：白名单、列目录、路径穿越拒绝', async () => {
    expect(isSafeDocName('风险观察.md')).toBe(true)
    expect(isSafeDocName('观察.html')).toBe(true)
    expect(isSafeDocName('观察.txt')).toBe(false)
    expect(isSafeDocName('../position.md')).toBe(false)
    expect(isSafeDocName('sub/report.md')).toBe(false)

    const docs = listWatchlistDocs()
    for (const d of docs) {
      expect(d.name).toMatch(/\.(md|html)$/i)
      expect(d.bytes).toBeGreaterThan(0)
    }
    if (docs.length > 0) {
      const doc = readWatchlistDoc(docs[0].name)
      expect(doc?.content.length).toBeGreaterThan(0)
      expect(typeof doc?.truncated).toBe('boolean')
    }

    const crossed = JSON.parse(
      await readWatchlistTool.invoke({ name: '../position.md' })
    )
    expect(crossed.error.code).toBe('PATH_NOT_ALLOWED')

    const missing = JSON.parse(
      await readWatchlistTool.invoke({ name: 'not-exist.md' })
    )
    expect(missing.error.code).toBe('DOC_NOT_FOUND')

    const listed = JSON.parse(await readWatchlistTool.invoke({}))
    expect(listed.ok).toBe(docs.length > 0)
  })

  test('15. DeepSeek 搜索：复用 LLM key、summary 优先、丢无 url 条目', async () => {
    const savedProvider = process.env.SEARCH_PROVIDER
    const savedLlm = process.env.OPENAI_API_KEY
    const savedFetch = globalThis.fetch
    process.env.SEARCH_PROVIDER = 'deepseek'
    process.env.OPENAI_API_KEY = 'test-key'
    let captured: { url: string; init?: RequestInit } = { url: '' }
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      captured = { url: String(url), init }
      return new Response(
        JSON.stringify({
          results: [
            {
              title: '<b>政策</b> 标题',
              url: 'https://example.com/a',
              snippet: '短摘要',
              summary: '长摘要，面向模型阅读',
              date: '2026-11-01T00:00:00+00:00'
            },
            { title: '无链接条目', snippet: '应被过滤' }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as unknown as typeof fetch
    try {
      expect(isSearchConfigured()).toBe(true)
      const items = await searchWeb('中国移动 政策', 3)
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        title: '政策 标题',
        url: 'https://example.com/a',
        snippet: '长摘要，面向模型阅读',
        publishedAt: '2026-11-01T00:00:00+00:00',
        source: 'deepseek'
      })
      expect(captured.url).toBe('https://api.deepseek.com/v1/tools/search')
      const headers = captured.init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-key')
      expect(JSON.parse(String(captured.init?.body))).toEqual({
        query: '中国移动 政策',
        count: 3,
        need_content: false
      })
    } finally {
      globalThis.fetch = savedFetch
      if (savedLlm !== undefined) {
        process.env.OPENAI_API_KEY = savedLlm
      } else {
        delete process.env.OPENAI_API_KEY
      }
      if (savedProvider !== undefined) {
        process.env.SEARCH_PROVIDER = savedProvider
      } else {
        delete process.env.SEARCH_PROVIDER
      }
    }
  })
})
