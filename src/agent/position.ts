/**
 * 用户持仓上下文加载（模式 2 · 独立 CLI）
 * 读取 `position.md` 注入系统提示，让 agent 开口即了解用户持仓与投资风格，
 * 无需用户每次复述。
 *
 * 与模式 1 一致：模式 1 由 harness 读 position.md，模式 2 复用同一文件，内容零分叉。
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { localISO } from './envelope'

/** 项目根目录（src/agent/ → 上两级） */
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 持仓配置文件路径 */
const POSITION_FILE = join(PROJECT_ROOT, 'position.md')

/**
 * 加载持仓配置文本（用于注入系统提示）。
 * 文件缺失时返回空字符串，由调用方决定兜底文案。
 */
export function loadPositionBrief(): string {
  if (!existsSync(POSITION_FILE)) return ''
  return readFileSync(POSITION_FILE, 'utf-8').trim()
}

/** 生成注入系统提示的持仓上下文块（含缺失兜底） */
export function renderPositionContext(): string {
  const brief = loadPositionBrief()
  if (!brief) {
    return (
      '（未找到 position.md，不了解用户持仓。可建议用户按 position.example.md 创建，' +
      '或在对话中直接告知持仓与投资偏好）'
    )
  }
  return brief
}

/** 持仓明细行（来自 position.md 第二节的表格） */
export interface PositionHolding {
  category: string
  name: string
  code: string
  query: string
  targetAmount: number | null
  currentAmount: number | null
  shares: number | null
  cost: number | null
  limitAmount: number | null
  note: string
}

/** 解析金额/数量：支持 10w、7.5w、≈35,700、0、—；无法解析返回 null */
function parseAmount(cell: string): number | null {
  if (!cell || cell.includes('—')) return null
  const m = cell.replace(/,/g, '').match(/\d+(?:\.\d+)?\s*([wW万]?)/)
  if (!m) return null
  const value = Number(m[0].replace(/[wW万\s]/g, ''))
  if (Number.isNaN(value)) return null
  return m[1] ? value * 10000 : value
}

/**
 * 解析「持仓明细」表；只认表头含“目标金额 + 当前金额”的那张表。
 * 资产大类列用 <br /> 续行时继承上一行。
 */
export function parsePositionHoldings(text: string): PositionHolding[] {
  const lines = text.split('\n')
  const start = lines.findIndex(
    (l) => l.includes('目标金额') && l.includes('当前金额')
  )
  if (start < 0) return []

  const holdings: PositionHolding[] = []
  let category = ''
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cells = line.split('|').map((c) => c.trim())
    cells.shift()
    cells.pop()
    if (cells.length < 10 || cells[0].includes('---')) continue
    if (cells[0] && cells[0] !== '<br />') category = cells[0]
    holdings.push({
      category,
      name: cells[1],
      code: cells[2],
      query: cells[3],
      targetAmount: parseAmount(cells[4]),
      currentAmount: parseAmount(cells[5]),
      shares: parseAmount(cells[6]),
      cost: parseAmount(cells[7]),
      limitAmount: parseAmount(cells[8]),
      note: cells[9] ?? ''
    })
  }
  return holdings
}

/** position.md 的修改时间（本地 ISO）；文件缺失返回 null */
export function positionMtimeISO(): string | null {
  if (!existsSync(POSITION_FILE)) return null
  return localISO(statSync(POSITION_FILE).mtime)
}
