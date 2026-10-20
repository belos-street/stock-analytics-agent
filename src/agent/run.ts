/**
 * 对话式运行入口（模式 2 · 独立 CLI）
 * 读取用户问题 → 调用 agent（模型 + 工具循环）→ 输出回答。
 * 支持单次提问与交互式多轮对话。
 *
 * 过程透明化：
 * - 思考/调工具时实时展示进度（正在干什么）；
 * - 回答后输出溯源清单（调了哪些 skill、查了哪些数据）。
 */

import { createInterface } from 'readline'
import { createInvestAgent } from './index'
import { describeToolCall, renderTrace, type ToolCallRecord } from './trace'
import {
  renderMarkdown,
  createSpinner,
  saveCursor,
  restoreCursorAndClear,
  writeStream
} from '../cli/render'

/** 消息片段：宽松形状，兼容 LangChain BaseMessage（content 类型复杂，用 unknown 收窄） */
interface MessageLike {
  role?: string
  /** LangChain 消息判别字段：ai / human / tool 等 */
  type?: string
  content?: unknown
}

/** agent invoke 返回的最小结构（结构兼容 LangChain 返回，无需断言） */
interface AgentResultLike {
  messages?: MessageLike[]
}

/** agent 类型：从 createInvestAgent 推导，避免 any 且与真实签名匹配 */
type AgentLike = ReturnType<typeof createInvestAgent>

/** 是否为 assistant / AI 回答消息（兼容 role 与 type 两种标识） */
function isAssistantMessage(msg: MessageLike): boolean {
  return msg?.role === 'assistant' || msg?.type === 'ai'
}

/** 从单个消息 content 中提取文本 */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) => {
        if (typeof c === 'string') return c
        const part = c as { text?: unknown }
        return typeof part?.text === 'string' ? part.text : ''
      })
      .join('')
  }
  return ''
}

/** 从 agent 输出中提取最终文本回答 */
function extractText(result: AgentResultLike): string {
  const messages = result?.messages ?? []
  // 最后一条 assistant / AI 消息即最终回答
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg && isAssistantMessage(msg)) {
      const text = contentToText(msg.content)
      if (text) return text
    }
  }
  return JSON.stringify(result, null, 2)
}

/**
 * 运行 agent 并实时展示工具调用进度。
 * 通过 streamEvents 捕获 on_tool_start 事件，展示"正在干什么"，
 * 同时收集工具调用记录用于回答后的溯源清单。
 */
async function runWithProgress(
  agent: AgentLike,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ answer: string; calls: ToolCallRecord[] }> {
  const calls: ToolCallRecord[] = []
  let answer = ''

  // 流式打字机效果仅在真实终端（TTY）生效；管道/脚本调用走一次性渲染
  const isTTY = process.stdout.isTTY === true

  const stream = await agent.streamEvents({ messages }, { version: 'v2' })

  // loading 动画：思考/调工具期间持续旋转，文案随动作更新（TTY 才有意义）
  const spinner = createSpinner('思考中…')
  if (isTTY) spinner.start()

  // 流式输出：首个 token 到来时停止 spinner、保存光标，随后逐 token 实时输出
  let streaming = false

  for await (const ev of stream) {
    // 工具开始：spinner 文案实时更新 + 恢复动画（覆盖工具执行的停顿期）
    if (ev.event === 'on_tool_start') {
      const call: ToolCallRecord = {
        name: ev.name ?? 'tool',
        input: ev.data?.input ?? {}
      }
      calls.push(call)
      if (isTTY) {
        if (streaming) writeStream('\n') // 已有流式文本，换行避免 spinner 覆盖
        spinner.text = describeToolCall(call)
        if (!spinner.isSpinning) spinner.start()
      }
      continue
    }

    // 模型流式增量 token：实时输出原始 markdown，营造"打字机"效果
    // 仅 TTY 时流式，避免管道下原始流+渲染成品双份输出
    if (ev.event === 'on_chat_model_stream') {
      const chunk = (ev.data?.chunk ?? ev.data?.output) as
        | { content?: unknown }
        | undefined
      const delta = chunk ? contentToText(chunk.content) : ''
      if (!delta || !isTTY) continue
      if (spinner.isSpinning) spinner.stop() // 有 token 可写，先停动画避免混排
      if (!streaming) {
        streaming = true
        saveCursor()
      }
      writeStream(delta)
      continue
    }

    // chain 结束且输出含 messages：更新最终回答（用于重绘 + history）
    const output = ev.data?.output as AgentResultLike | undefined
    if (output?.messages && Array.isArray(output.messages)) {
      const text = extractText(output)
      if (text && text.trim().startsWith('{')) continue // 兜底 JSON 不采纳
      if (text) answer = text
    }
  }

  spinner.stop()

  // 回退清屏、重绘彩色 markdown 成品（流式源码 → 格式化成品）
  if (streaming && answer) {
    restoreCursorAndClear()
  }

  return { answer, calls }
}

/** 运行一次单次问答 */
export async function askOnce(question: string): Promise<string> {
  const agent = createInvestAgent()
  const { answer, calls } = await runWithProgress(agent, [
    { role: 'user', content: question }
  ])
  const trace = renderTrace(calls)
  return trace ? `${renderMarkdown(answer)}\n${trace}` : renderMarkdown(answer)
}

/** 交互式多轮对话（REPL） */
export async function chatLoop(): Promise<void> {
  const agent = createInvestAgent()
  console.error('投资分析 Agent 已启动（输入 exit / quit 退出）\n')

  // 多轮对话历史
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []

  while (true) {
    // REPL 逐轮读取用户输入，顺序 await 是交互式对话的必然结构
    // eslint-disable-next-line no-await-in-loop
    const question = await prompt('你 > ')
    if (!question) continue
    const trimmed = question.trim()
    if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) break

    history.push({ role: 'user', content: trimmed })
    try {
      // 对话循环需逐轮顺序处理（上一轮回答进入下一轮上下文），await-in-loop 是设计必然
      // eslint-disable-next-line no-await-in-loop
      const { answer, calls } = await runWithProgress(agent, history)
      history.push({ role: 'assistant', content: answer })
      // 回答走 markdown 彩色渲染（stdout）；history 存纯文本避免重复转义
      console.log(`\n${renderMarkdown(answer)}`)
      // 溯源清单
      const trace = renderTrace(calls)
      if (trace) console.log(`${trace}\n`)
    } catch (error) {
      console.error(
        `\n出错：${error instanceof Error ? error.message : String(error)}\n`
      )
    }
  }
  console.error('再见 👋')
}

/** 简易异步输入：readline 支持行编辑（方向键移动光标、退格、历史） */
function prompt(label: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr
  })
  return new Promise((resolve) => {
    rl.question(label, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
