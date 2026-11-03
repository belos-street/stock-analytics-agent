/**
 * Agent Tools（模式 2）· barrel
 * 具体实现拆分在 src/agent/tools/ 下；对外导入路径保持不变。
 */

import {
  getStockQuote,
  getFundQuote,
  getDividendYield,
  getKlineData,
  searchStockTool
} from './tools/quotes'
import { loadSkillTool } from './tools/skill'
import { computeSeriesStatsTool } from './tools/analytics'
import { getMarketOverview } from './tools/market'
import { getPortfolioSnapshot } from './tools/portfolio'
import { webSearchTool } from './tools/web'

export { governTool, resetToolRuntime } from './tools/runtime'

export {
  getStockQuote,
  getFundQuote,
  getDividendYield,
  getKlineData,
  searchStockTool,
  loadSkillTool,
  computeSeriesStatsTool,
  getMarketOverview,
  getPortfolioSnapshot,
  webSearchTool
}

/** agent 工具集：模型可调用的全部工具 */
export const agentTools = [
  getStockQuote,
  getFundQuote,
  getDividendYield,
  getKlineData,
  searchStockTool,
  loadSkillTool,
  computeSeriesStatsTool,
  getMarketOverview,
  getPortfolioSnapshot,
  webSearchTool
]
