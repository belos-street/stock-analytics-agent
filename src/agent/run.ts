/**
 * 对话式运行入口（模式 2 · 独立 CLI）
 * 读取用户问题 → 调用 agent（模型 + 工具循环）→ 输出回答。
 * 支持单次提问与交互式多轮对话。
 */

import { createInvestAgent } from './index'

/** 从 agent 输出中提取最终文本回答 */
function extractText(result: any): string {
  const messages = result?.messages ?? []
  // 最后一条 assistant 消息即最终回答
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.role === 'assistant') {
      const content = msg.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .map((c: any) => (typeof c === 'string' ? c : (c?.text ?? '')))
          .join('')
      }
    }
  }
  return JSON.stringify(result, null, 2)
}

/** 运行一次单轮问答 */
export async function askOnce(question: string): Promise<string> {
  const agent = createInvestAgent()
  const result = await agent.invoke({
    messages: [{ role: 'user', content: question }]
  })
  return extractText(result)
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
      const result = await agent.invoke({ messages: history })
      const answer = extractText(result)
      history.push({ role: 'assistant', content: answer })
      console.error(`\n助手 > ${answer}\n`)
    } catch (error: any) {
      console.error(`\n出错：${error.message}\n`)
    }
  }
  console.error('再见 👋')
}

/** 简易异步输入（Bun/Node 通用） */
function prompt(label: string): Promise<string> {
  process.stderr.write(label)
  return new Promise((resolve) => {
    const onData = (data: Buffer) => {
      process.stdin.off('data', onData)
      resolve(data.toString().trim())
    }
    process.stdin.on('data', onData)
  })
}
