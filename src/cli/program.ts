/**
 * CLI 参数定义（commander program 构建）
 * 从 main.ts 抽离，保持入口文件为纯分发逻辑。
 */

import { Command } from 'commander'

/** CLI 解析后的选项（类型化，避免散落的 any） */
export interface CliOptions {
  stocks: string
  funds: string
  hk: string
  us: string
  dividend: string
  kline: string
  period: string
  search: string
  format: 'json' | 'table' | 'csv'
  pretty: boolean
  agent: boolean
  ask: string
}

/** 构建并解析 CLI program，返回类型化选项 */
export function buildProgram(): CliOptions {
  const program = new Command()

  program
    .name('stock-analytics')
    .description('股市投资分析助手 V3.0 - 基于 stock-sdk')
    .version('3.0.0')
    .option(
      '-s, --stocks <codes>',
      'A股/ETF/指数代码列表（逗号分隔，sh/sz前缀可省略）',
      ''
    )
    .option('-f, --funds <codes>', '基金代码列表（逗号分隔）', '')
    .option('--hk <codes>', '港股代码列表（逗号分隔）', '')
    .option('--us <codes>', '美股代码列表（逗号分隔）', '')
    .option('--dividend <codes>', '查询股息率（逗号分隔多个代码）', '')
    .option('--kline <code>', '查询K线数据', '')
    .option('--period <period>', 'K线周期: daily | weekly | monthly', 'daily')
    .option('--search <keyword>', '搜索股票/基金', '')
    .option('-o, --format <type>', '输出格式: json | table | csv', 'json')
    .option('--pretty', 'JSON美化输出', false)
    .option('--agent', '进入 AI 投资分析对话（需配置 .env 的 LLM 密钥）')
    .option('--ask <question>', '向 AI 投资分析助手提单个问题')
    .parse(process.argv)

  return program.opts<CliOptions>()
}
