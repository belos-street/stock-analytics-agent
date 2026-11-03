/**
 * 对话式运行入口（模式 2 · 独立 CLI）
 * 读取用户问题 → 调用 agent（模型 + 工具循环）→ 输出回答。
 * 支持单次提问与交互式多轮对话。
 *
 * 过程透明化：
 * - 思考/调工具时实时展示进度（正在干什么）；
 * - 回答后输出溯源清单（调了哪些 skill、查了哪些数据）。
 */

import { createInterface, type Interface } from 'readline'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import {
  createInvestAgent,
  renderRulesBrief,
  renderRuntimeContext,
  resetToolRuntime
} from './index'
import { checkCompliance } from './compliance'
import { loadPositionBrief } from './position'
import { describeToolCall, renderTrace, type ToolCallRecord } from './trace'
import {
  renderMarkdown,
  createSpinner,
  createBlockStreamer
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
  // 每轮重置工具预算与同参 memo：生命周期 = 单次 askOnce / 单轮 REPL
  resetToolRuntime()

  const calls: ToolCallRecord[] = []
  let answer = ''

  // 流式打字机效果仅在真实终端（TTY）生效；管道/脚本调用走一次性渲染
  const isTTY = process.stdout.isTTY === true

  // 块流式渲染器：按 markdown 块边界输出彩色成品，stdout 始终行对齐
  const streamer = createBlockStreamer()
  const spinner = createSpinner('思考中…')
  let streaming = false

  try {
    const stream = await agent.streamEvents({ messages }, { version: 'v2' })

    // loading 动画：思考/调工具期间持续旋转（TTY 才有意义）
    if (isTTY) spinner.start()

    for await (const ev of stream) {
      // 工具开始：spinner 文案实时更新 + 恢复动画（覆盖工具执行的停顿期）
      if (ev.event === 'on_tool_start') {
        const call: ToolCallRecord = {
          name: ev.name ?? 'tool',
          input: ev.data?.input ?? {}
        }
        calls.push(call)
        if (isTTY) {
          spinner.text = describeToolCall(call)
          if (!spinner.isSpinning) spinner.start()
        }
        continue
      }

      // 模型流式增量 token：推入块流式器，按块边界实时渲染
      if (ev.event === 'on_chat_model_stream') {
        const chunk = (ev.data?.chunk ?? ev.data?.output) as
          | { content?: unknown }
          | undefined
        const delta = chunk ? contentToText(chunk.content) : ''
        if (!delta || !isTTY) continue
        if (spinner.isSpinning) spinner.stop() // 有 token 可写，先停动画避免混排
        streaming = true
        streamer.push(delta)
        continue
      }

      // chain 结束且输出含 messages：更新最终回答（用于 history 与非 TTY 渲染）
      const output = ev.data?.output as AgentResultLike | undefined
      if (output?.messages && Array.isArray(output.messages)) {
        const text = extractText(output)
        if (text && text.trim().startsWith('{')) continue // 兜底 JSON 不采纳
        if (text) answer = text
      }
    }
  } finally {
    // 无论正常/异常都停掉 spinner，避免错误提示上残留动画
    if (spinner.isSpinning) spinner.stop()
  }

  // TTY：冲刷剩余块（最后未闭合部分）
  if (isTTY && streaming) streamer.end()

  return { answer, calls }
}

/** 合规命中后让模型重写一次；请求失败时保留原文 */
async function rewriteForCompliance(
  agent: AgentLike,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  answer: string,
  terms: string[]
): Promise<string> {
  const instruction = `请重写上一条回答，删除或改写以下违规表述：${terms.join('、')}。要求：不得出现收益承诺、概率承诺、保本表述、精确买卖点；保留数据、来源与时点。只输出重写后的回答。`
  try {
    const result = await agent.invoke({
      messages: [
        ...messages,
        { role: 'assistant', content: answer },
        { role: 'user', content: instruction }
      ]
    })
    return extractText(result as AgentResultLike) || answer
  } catch {
    return answer
  }
}

/** 写入报告并运行结构检查；所有提示走 stderr，保持 stdout 只有回答 */
function saveReport(out: string, content: string): void {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, content.endsWith('\n') ? content : `${content}\n`, 'utf-8')
  console.error(`报告已写入：${out}`)
  const proc = Bun.spawnSync(
    [
      'bun',
      'run',
      '.agents/business/report-review/scripts/check-report.ts',
      out
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const text = `${proc.stdout.toString()}${proc.stderr.toString()}`.trim()
  if (text) console.error(text)
  if (proc.exitCode !== 0) {
    console.error('check-report 未通过，请按上方问题修正报告')
  }
  console.error(
    '提示：交付前请运行 report-review 审查（.agents/business/report-review/SKILL.md）'
  )
}

/** 运行一次单次问答；out 非空时把最终回答写入 markdown 并做结构检查 */
export async function askOnce(question: string, out?: string): Promise<string> {
  const agent = createInvestAgent(await renderRuntimeContext())
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: question }
  ]
  const { answer: raw, calls } = await runWithProgress(agent, messages)
  let answer = raw
  let revised = false

  const lint = checkCompliance(answer)
  if (lint.hit) {
    const original = answer
    answer = await rewriteForCompliance(agent, messages, answer, lint.terms)
    const again = checkCompliance(answer)
    if (again.hit) {
      answer = original
      console.error(
        `合规警告：回答仍含 ${again.terms.join('、')}，已保留原文，请人工复核`
      )
    } else {
      revised = true
    }
  }

  if (out) saveReport(out, answer)

  // 非 TTY（管道/脚本）：runWithProgress 未流式，此处一次性渲染成品 + 溯源
  // TTY：块流式已写 stdout；若合规重写则补打修订版，避免用户只看到原回答
  if (process.stdout.isTTY === true) {
    if (revised) console.log(`\n[合规修订]\n${renderMarkdown(answer)}`)
    return ''
  }
  const trace = renderTrace(calls)
  return trace ? `${renderMarkdown(answer)}\n${trace}` : renderMarkdown(answer)
}

/** 交互式多轮对话（REPL） */
export async function chatLoop(): Promise<void> {
  console.error(
    '投资分析 Agent 已启动（/reload 重载持仓与口径，exit / quit 退出）\n'
  )

  // 多轮对话历史
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // readline 全程复用一个实例：跨问题保留输入历史（↑ 调出上一条），不反复抢 stdin
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    historySize: 100
  })

  try {
    while (true) {
      // REPL 逐轮读取用户输入，顺序 await 是交互式对话的必然结构
      // eslint-disable-next-line no-await-in-loop
      const question = await prompt(rl, '你 > ')
      if (!question) continue
      const trimmed = question.trim()
      if (trimmed === '/reload') {
        // 每轮重建 agent 已自动重读；这里显式读取并回显，方便确认文件已生效
        const pos = loadPositionBrief()
        const rules = renderRulesBrief()
        console.error(
          `已重新加载：position.md ${pos.length} 字符、agent_brief.md ${rules.length} 字符；下一轮生效`
        )
        continue
      }
      if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) break

      history.push({ role: 'user', content: trimmed })
      try {
        // 每轮重建 agent：运行时上下文（日期/交易日）随轮次更新
        const agent = createInvestAgent(await renderRuntimeContext())
        // 对话循环需逐轮顺序处理（上一轮回答进入下一轮上下文），await-in-loop 是设计必然
        // eslint-disable-next-line no-await-in-loop
        const { answer, calls } = await runWithProgress(agent, history)
        history.push({ role: 'assistant', content: answer })
        // TTY：块流式已输出，仅补溯源；非 TTY 不适用（REPL 必为 TTY），此处兜底渲染
        if (process.stdout.isTTY !== true) {
          console.log(`\n${renderMarkdown(answer)}`)
        }
        const trace = renderTrace(calls)
        if (trace) console.log(`${trace}\n`)
      } catch (error) {
        console.error(
          `\n出错：${error instanceof Error ? error.message : String(error)}\n`
        )
      }
    }
  } finally {
    rl.close()
  }
  console.error('再见 👋')
}

/** 复用 readline 实例读取一行（保留输入历史与行编辑） */
function prompt(rl: Interface, label: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(label, (answer) => {
      resolve(answer.trim())
    })
  })
}
