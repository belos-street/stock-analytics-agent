/**
 * 终端渲染工具（模式 2 · CLI 美化）
 * - markdown → 彩色终端文本（标题/表格/加粗/列表）
 * - ora spinner：思考/调工具期间的 loading 动画
 *
 * 仅用于 agent 对话输出；数据查询模式的 JSON/table/csv 输出不走这里，
 * 保持机器可解析。
 */

import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import ora, { type Ora } from 'ora'

/** 复用一个 marked 实例（终端渲染配置只初始化一次） */
const terminalMarked = new Marked(markedTerminal({ showSectionPrefix: false }))

/** markdown 文本 → 彩色终端文本 */
export function renderMarkdown(text: string): string {
  return terminalMarked.parse(text, { async: false }) as string
}

/** 创建 spinner（loading 动画） */
export function createSpinner(text = '思考中…'): Ora {
  return ora({ text, spinner: 'dots' })
}

/**
 * 流式渲染支持：保存/回退光标 + 清屏。
 * 流式阶段逐 token 输出原始 markdown（实时感），
 * 结束后回退清屏重绘彩色成品，兼顾"流式"与"格式化"。
 */

/** 保存当前光标位置（流式输出前调用） */
export function saveCursor(): void {
  process.stdout.write('\x1b[s')
}

/** 回退到保存的光标并清屏至末尾（流式结束后调用） */
export function restoreCursorAndClear(): void {
  process.stdout.write('\x1b[u\x1b[J')
}

/** 逐 token 写出原始文本（流式） */
export function writeStream(text: string): void {
  process.stdout.write(text)
}
