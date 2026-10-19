/**
 * Skill 注入（模式 2 · 独立 CLI）
 * 把 `.agents/skills/` 的投资分析方法论暴露给 agent。
 *
 * 采用「渐进式披露」而非全文塞入：25 个 skill 正文很大，全量注入会爆上下文。
 * - 目录（name + description）注入系统提示，让 agent 知道有哪些方法论可用；
 * - 需要时调用 load_skill(name) 按需加载单个 skill 的完整正文。
 *
 * 与模式 1 的关系：模式 1 由 harness 直接读 skill 文档；模式 2 复用同一批文档，
 * 只是把"读取动作"封装成工具，内容零分叉。
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** 单个 skill 的元信息 */
export interface SkillInfo {
  name: string
  description: string
}

/** skill 正文（含 frontmatter 之后的完整方法论） */
export interface SkillContent {
  name: string
  description: string
  content: string
}

/** 项目根目录（src/agent/ → 上两级） */
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** skills 目录 */
const SKILLS_DIR = join(PROJECT_ROOT, '.agents', 'skills')

/**
 * 解析 SKILL.md 的 frontmatter（name / description）与正文。
 * 仅提取用到的字段，不引入 YAML 依赖。
 */
function parseSkillFile(raw: string, fallbackName: string): SkillContent {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { name: fallbackName, description: '', content: raw }
  }
  const [, frontmatter, body] = match

  const nameMatch = frontmatter.match(/^name:\s*["']?(.*?)["']?\s*$/m)
  const descMatch = frontmatter.match(/^description:\s*["']?(.*?)["']?\s*$/m)

  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    description: descMatch?.[1]?.trim() || '',
    content: body.trim()
  }
}

/** 加载全部 skill 的元信息（目录缓存，进程内不变） */
let skillCatalog: SkillInfo[] | null = null

export function listSkills(): SkillInfo[] {
  if (skillCatalog) return skillCatalog

  if (!existsSync(SKILLS_DIR)) {
    skillCatalog = []
    return skillCatalog
  }

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))

  skillCatalog = entries.map((e) => {
    const file = join(SKILLS_DIR, e.name, 'SKILL.md')
    if (!existsSync(file)) return { name: e.name, description: '' }
    const { name, description } = parseSkillFile(
      readFileSync(file, 'utf-8'),
      e.name
    )
    return { name, description }
  })

  return skillCatalog
}

/**
 * 加载单个 skill 的完整正文。
 * @param name skill 名称（目录名或 frontmatter 中的 name）
 * @returns skill 正文，未找到时返回 null
 */
export function loadSkill(name: string): SkillContent | null {
  const target = name.trim()

  // 目录名直接命中
  const byDir = join(SKILLS_DIR, target, 'SKILL.md')
  if (existsSync(byDir)) {
    return parseSkillFile(readFileSync(byDir, 'utf-8'), target)
  }

  // frontmatter name 命中（目录名与 name 不一致时）
  for (const info of listSkills()) {
    if (info.name === target) {
      // 需要找到对应目录——重新扫描
      const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
      for (const dir of entries) {
        const file = join(SKILLS_DIR, dir, 'SKILL.md')
        if (!existsSync(file)) continue
        const parsed = parseSkillFile(readFileSync(file, 'utf-8'), dir)
        if (parsed.name === target) return parsed
      }
    }
  }

  return null
}

/** 生成 skill 目录文本（注入系统提示用） */
export function renderSkillCatalog(): string {
  const skills = listSkills()
  if (skills.length === 0) return '（无可用 skill）'

  return skills
    .map((s) => `- ${s.name}${s.description ? `：${s.description}` : ''}`)
    .join('\n')
}
