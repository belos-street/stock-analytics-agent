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
