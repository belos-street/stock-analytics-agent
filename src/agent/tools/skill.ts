/**
 * Skill 加载工具：读取投资方法论全文（路径白名单）。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { isSafeSkillName, loadSkill, listSkills } from '../skills'
import { fail, ok } from '../envelope'
import { fetchMeta, governTool } from './runtime'

export const loadSkillTool = tool(
  governTool('load_skill', async ({ name }: { name: string }) => {
    if (!isSafeSkillName(name)) {
      return fail(
        'PATH_NOT_ALLOWED',
        'skill 名称只允许字母、数字、下划线与短横线'
      )
    }
    const skill = loadSkill(name)
    if (!skill) {
      const available = listSkills()
        .map((s) => s.name)
        .join(', ')
      return fail(
        'SKILL_NOT_FOUND',
        `未找到 skill：${name}。可用：${available}`
      )
    }
    return ok(
      {
        name: skill.name,
        description: skill.description,
        content: skill.content
      },
      fetchMeta('local-skill')
    )
  }),
  {
    name: 'load_skill',
    description:
      '加载一个投资分析 skill 的完整方法论（如估值框架、个股深度分析、持仓分析流程）。在做相应分析前先加载对应 skill 获取分析框架与口径要求。skill 列表见系统提示。',
    schema: z.object({
      name: z
        .string()
        .describe('skill 名称，如 stock-deep-analysis、valuation-framework')
    })
  }
)
