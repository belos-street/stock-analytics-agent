/**
 * Agent 骨架（模式 2 · 独立 CLI）
 * 基于 LangChain.js `createAgent` 组装：模型 + 工具 + 系统提示。
 * 复用 src/ 数据层作为工具实现，与模式 1 共享，不重复造数据逻辑。
 */

import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { loadModelConfig } from './config'
import { agentTools } from './tools'
import { renderSkillCatalog } from './skills'
import { renderPositionContext } from './position'

/** 系统提示：投资分析助手定位 + 口径纪律 + 用户持仓 + skill 目录 */
const SYSTEM_PROMPT = `你是个人长期投资分析助手，帮助用户做行情查询、持仓分析、估值判断与资产配置建议。

工作原则：
- 数据一律通过工具实时查询，不要凭记忆编造价格、估值、股息率等数字。
- 做具体分析前，先用 load_skill 加载对应的方法论 skill，遵循其分析框架与口径要求。
- 量化指标（估值分位、回撤、股息率）必须说明计算口径与时间窗口。
- 股息率工具返回的 yield_basis 标注了口径（单期分红口径，非年度化），呈现时必须一并说明，避免用户误当年度化口径。
- 判断"年内最高价/年内回撤"等长窗口口径时，K线必须用 monthly 周期，不可用局部窗口冒充全年。
- 报告需包含空方论点，保持客观，不选择性乐观。
- 长期投资导向：不鼓励短线炒作、不追热点。
- 给建议时结合下方用户持仓与投资风格，个性化分析；不需用户每次复述持仓。
- 所有分析仅供参考，不构成投资建议；市场有风险，投资需谨慎。

## 用户持仓与投资风格（来自 position.md）

${renderPositionContext()}

## 可用分析 Skill（用 load_skill 加载查看完整方法论）

${renderSkillCatalog()}`

/** 创建投资分析 agent */
export function createInvestAgent() {
  const config = loadModelConfig()

  const model = new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0.3,
    configuration: config.baseURL ? { baseURL: config.baseURL } : undefined
  })

  return createAgent({
    model,
    tools: agentTools,
    systemPrompt: SYSTEM_PROMPT
  })
}

export { loadModelConfig } from './config'
export type { ModelConfig } from './config'
export { agentTools } from './tools'
