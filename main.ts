#!/usr/bin/env bun

/**
 * Stock Analytics Skill V3.0 - 薄入口
 *
 * 只做参数解析与分发：
 * - AI agent 模式（--agent / --ask）→ src/agent/
 * - 数据查询模式（-s/-f/--hk/...）→ src/cli/
 *
 * 约定：stdout 只输出数据，标题、提示、错误一律走 stderr，
 * 保证输出可被大模型或管道直接解析。
 */

import chalk from 'chalk'
import { buildProgram } from './src/cli/program'
import { runQuery, printUsage } from './src/cli/query'

async function main() {
  const options = buildProgram()

  // AI agent 模式
  if (options.agent || options.ask) {
    try {
      const { askOnce, chatLoop } = await import('./src/agent/run')
      if (options.ask) {
        console.log(await askOnce(options.ask))
      } else {
        await chatLoop()
      }
    } catch (error) {
      console.error(
        chalk.red(
          `启动 AI 助手失败：${error instanceof Error ? error.message : String(error)}`
        )
      )
      process.exit(1)
    }
    return
  }

  // 数据查询模式
  const hasOptions =
    options.stocks ||
    options.funds ||
    options.hk ||
    options.us ||
    options.dividend ||
    options.kline ||
    options.search

  if (!hasOptions) {
    printUsage()
    process.exit(1)
  }

  await runQuery(options)
}

main()
