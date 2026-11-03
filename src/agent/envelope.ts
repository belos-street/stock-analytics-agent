/**
 * 工具返回统一信封（v3.1 · 1-2）。
 * 成功：{ ok: true, data, meta: { source, asOf, asOfKind, fetchedAt, currency?, unit?, missing?, stale? } }
 * 失败：{ ok: false, error: { code, hint, retryable } }
 * 规则：asOf 只表示“数据时间”，fetchedAt 表示“本次请求时间”；含数字的 data 必须在 meta 标注单位。
 */

export type AsOfKind = 'quote' | 'barDate' | 'navDate' | 'fileMtime' | 'fetch'

export interface MissingField {
  field: string
  reason: string
}

export interface EnvelopeMeta {
  source: string
  /** 数据时间；无数据时间时等于 fetchedAt */
  asOf: string
  asOfKind: AsOfKind
  /** 本次工具执行时间 */
  fetchedAt: string
  /** 单一币种用 CNY/HKD/USD；混合市场用 MIXED */
  currency?: string | null
  /** 字段名 → 单位，例如 { amount: "万元", marketCap: "亿元" } */
  unit?: Record<string, string>
  /** 缺失的字段/代码及原因 */
  missing?: MissingField[]
  stale?: boolean
}

/** 成功信封（JSON 字符串） */
export function ok(data: unknown, meta: EnvelopeMeta): string {
  return JSON.stringify({ ok: true, data, meta }, null, 2)
}

/** 失败信封（JSON 字符串）；错误不抛异常，交给模型继续收尾 */
export function fail(code: string, hint: string, retryable = false): string {
  return JSON.stringify(
    { ok: false, error: { code, hint, retryable } },
    null,
    2
  )
}

/** 本地时区 ISO 时间（带时区偏移），作为 fetchedAt / 文件 mtime */
export function localISO(now: Date = new Date()): string {
  const d = now
  const pad = (n: number) => String(n).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hh = pad(Math.floor(Math.abs(offset) / 60))
  const mm = pad(Math.abs(offset) % 60)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const tzOf = (tz: string | null) => tz || 'Asia/Shanghai'

/** 某时区在给定时刻的 UTC 偏移（分钟） */
function offsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date)
  const v = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUTC = Date.UTC(
    v('year'),
    v('month') - 1,
    v('day'),
    v('hour') % 24,
    v('minute'),
    v('second')
  )
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** 把时刻按指定时区格式化为带偏移的 ISO */
function formatInTz(date: Date, tz: string): string {
  const off = offsetMinutes(date, tz)
  const wall = new Date(date.getTime() + off * 60000)
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${wall.getUTCFullYear()}-${pad2(wall.getUTCMonth() + 1)}-${pad2(wall.getUTCDate())}T${pad2(wall.getUTCHours())}:${pad2(wall.getUTCMinutes())}:${pad2(wall.getUTCSeconds())}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

/** 把“某时区的墙上时间”转成真实时刻（处理夏令时） */
function wallToDate(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  let off = offsetMinutes(new Date(guess), tz)
  off = offsetMinutes(new Date(guess - off * 60000), tz)
  return new Date(guess - off * 60000)
}

/**
 * 行情时间归一：时间戳优先；否则解析 `yyyyMMddHHmmss` 或 `YYYY-MM-DD HH:mm:ss`，
 * 按行情所属市场时区解释。无法解析返回 null（调用方降级为 fetchedAt + stale）。
 */
export function isoFromQuoteTime(
  time: string | null,
  timestamp: number | null,
  tz: string | null
): string | null {
  const zone = tzOf(tz)
  if (
    timestamp !== null &&
    timestamp !== undefined &&
    Number.isFinite(timestamp)
  ) {
    return formatInTz(new Date(timestamp), zone)
  }
  const raw = (time ?? '').trim()
  if (!raw) return null
  let m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (m) {
    return formatInTz(
      wallToDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], zone),
      zone
    )
  }
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    return formatInTz(
      wallToDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], zone),
      zone
    )
  }
  return null
}

/** 一组 ISO 时间中的最新值（按真实时刻比较）；空数组返回 null */
export function latestISO(values: (string | null)[]): string | null {
  let best: string | null = null
  let bestTs = -Infinity
  for (const v of values) {
    if (!v) continue
    const ts = Date.parse(v)
    if (Number.isFinite(ts) && ts > bestTs) {
      best = v
      bestTs = ts
    }
  }
  return best
}
