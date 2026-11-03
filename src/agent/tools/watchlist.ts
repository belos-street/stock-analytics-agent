/**
 * Watchlist 只读工具：列出 / 读取 `watchlist/` 下的调查报告。
 * D21 白名单扩展：仅 watchlist/ 下的 md/html，不支持任意路径。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import { fileURLToPath } from 'url'
import { tool } from 'langchain'
import { z } from 'zod'
import { fail, localISO, ok } from '../envelope'
import type { EnvelopeMeta } from '../envelope'
import { governTool } from './runtime'

/** 项目根目录（src/agent/tools/ → 上三级） */
const PROJECT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

/** watchlist 目录（模式 2 读取白名单） */
const WATCHLIST_DIR = join(PROJECT_ROOT, 'watchlist')

/** 单次读取上限，避免超长报告挤爆上下文 */
const MAX_CONTENT = 30000

/** 文档条目 */
export interface WatchlistDoc {
  name: string
  bytes: number
  modifiedAt: string
}

/**
 * 文件名白名单：仅 watchlist/ 下的 md/html。
 * 拒绝路径分隔符与 `..`，防止目录穿越（D21）。
 */
export function isSafeDocName(name: string): boolean {
  const n = name.trim()
  if (!n || n.includes('/') || n.includes('\\') || n.includes('..')) return false
  return /\.(md|html)$/i.test(n)
}

/** 列出 watchlist 下的报告（按文件名排序）；目录缺失返回空数组 */
export function listWatchlistDocs(): WatchlistDoc[] {
  if (!existsSync(WATCHLIST_DIR)) return []
  return readdirSync(WATCHLIST_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && isSafeDocName(e.name))
    .map((e) => {
      const full = join(WATCHLIST_DIR, e.name)
      return {
        name: e.name,
        bytes: statSync(full).size,
        modifiedAt: localISO(statSync(full).mtime)
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 读取单份报告正文；不存在 / 越界 / 超限由调用方判定 */
export function readWatchlistDoc(name: string): {
  name: string
  bytes: number
  modifiedAt: string
  content: string
  truncated: boolean
} | null {
  if (!isSafeDocName(name)) return null
  const target = resolve(join(WATCHLIST_DIR, name))
  if (!target.startsWith(WATCHLIST_DIR + sep) || !existsSync(target)) {
    return null
  }
  const stat = statSync(target)
  if (!stat.isFile()) return null
  const raw = readFileSync(target, 'utf-8')
  const content = raw.slice(0, MAX_CONTENT)
  return {
    name,
    bytes: stat.size,
    modifiedAt: localISO(stat.mtime),
    content,
    truncated: raw.length > MAX_CONTENT
  }
}

/** 文件 mtime 信封（asOf = 数据时间，而非请求时间） */
function fileMeta(asOf: string): EnvelopeMeta {
  return {
    source: 'local-watchlist',
    asOf,
    asOfKind: 'fileMtime',
    fetchedAt: localISO()
  }
}

export const readWatchlistTool = tool(
  governTool('read_watchlist', async ({ name }: { name?: string }) => {
    if (!name) {
      const docs = listWatchlistDocs()
      if (docs.length === 0) {
        return fail('NO_DATA', 'watchlist/ 下没有 md/html 报告')
      }
      return ok(docs, fileMeta(docs.map((d) => d.modifiedAt).sort().at(-1)!))
    }
    if (!isSafeDocName(name)) {
      return fail(
        'PATH_NOT_ALLOWED',
        '只允许读取 watchlist/ 下的 md/html 文件名，不支持路径'
      )
    }
    const doc = readWatchlistDoc(name)
    if (!doc) {
      const available = listWatchlistDocs()
        .map((d) => d.name)
        .join(', ')
      return fail(
        'DOC_NOT_FOUND',
        `watchlist/ 下未找到 ${name}。可用：${available || '（空）'}`
      )
    }
    return ok(doc, fileMeta(doc.modifiedAt))
  }),
  {
    name: 'read_watchlist',
    description:
      '读取 watchlist/ 下的历史调查报告（候选标的对比、行业 ETF 观察等）。不传 name 时返回文件清单（文件名 / 大小 / 修改时间）；传 name 时返回正文（超过 30000 字截断，truncated=true）。只读，仅允许 watchlist/ 下的 md/html，不能读其他目录。文件内容属于用户历史记录，回答时须标注其修改时间。',
    schema: z.object({
      name: z
        .string()
        .optional()
        .describe('文件名（含扩展名），如 高风险行业ETF对比观察_20261015.md；省略则列出全部')
    })
  }
)
