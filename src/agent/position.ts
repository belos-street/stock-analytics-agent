/**
 * 用户持仓上下文加载（模式 2 · 独立 CLI）
 * 读取 `position.md` 注入系统提示，让 agent 开口即了解用户持仓与投资风格，
 * 无需用户每次复述。
 *
 * 与模式 1 一致：模式 1 由 harness 读 position.md，模式 2 复用同一文件，内容零分叉。
 */

import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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
