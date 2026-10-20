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
 * 块流式渲染器：按 markdown 块边界（空行）分段渲染输出。
 *
 * 设计要点：
 * - 只在块完整（遇 `\n\n`）时渲染并一次性写出，stdout 始终行对齐，
 *   因此 spinner（stderr）动画与之互不干扰，也无需光标回退清屏；
 * - 弃用 DECSC/DECRC 光标存取——那只在一屏内有效，投资分析长回答滚屏后会花屏。
 */
export function createBlockStreamer(): {
  push: (text: string) => void
  end: () => void
} {
  let buffer = ''
  let flushed = 0

  const flush = (upto: number): void => {
    if (flushed >= upto) return
    const chunk = buffer.slice(flushed, upto)
    const rendered = renderMarkdown(chunk)
    process.stdout.write(rendered.endsWith('\n') ? rendered : `${rendered}\n`)
    flushed = upto
  }

  return {
    push(text: string): void {
      buffer += text
      // 最后一个块分隔（\n\n）之前为完整块，可安全渲染
      const sep = buffer.lastIndexOf('\n\n')
      if (sep > flushed) flush(sep + 2)
    },
    end(): void {
      flush(buffer.length)
    }
  }
}
