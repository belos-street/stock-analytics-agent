import { describe, test, expect } from 'bun:test'
import { listSkills, loadSkill, renderSkillCatalog } from '../src/agent/skills'

/**
 * Skill 加载单元测试（纯离线，读取 .agents/skills/ 本地文件）
 * 验证 frontmatter 解析、目录发现、按需加载、容错。
 */

describe('listSkills', () => {
  test('能发现全部 skill，且每个含 name 与 description', () => {
    const skills = listSkills()
    expect(skills.length).toBeGreaterThanOrEqual(25)
    for (const s of skills) {
      expect(s.name.length).toBeGreaterThan(0)
      expect(typeof s.description).toBe('string')
    }
  })

  test('包含已知 skill stock-deep-analysis', () => {
    const names = listSkills().map((s) => s.name)
    expect(names).toContain('stock-deep-analysis')
  })

  test('重复调用返回一致结果（目录缓存）', () => {
    const first = listSkills()
    const second = listSkills()
    expect(second.length).toBe(first.length)
  })
})

describe('loadSkill', () => {
  test('按目录名加载完整正文', () => {
    const skill = loadSkill('valuation-framework')
    expect(skill).not.toBeNull()
    expect(skill!.name).toBe('valuation-framework')
    expect(skill!.content.length).toBeGreaterThan(100)
  })

  test('解析出 frontmatter 的 description', () => {
    const skill = loadSkill('valuation-framework')
    expect(skill!.description.length).toBeGreaterThan(0)
  })

  test('正文不包含 frontmatter 分隔符', () => {
    const skill = loadSkill('stock-deep-analysis')
    expect(skill!.content.startsWith('---')).toBe(false)
  })

  test('不存在的 skill 返回 null', () => {
    expect(loadSkill('not-exist-skill')).toBeNull()
  })

  test('空字符串返回 null', () => {
    expect(loadSkill('')).toBeNull()
  })

  test('任意已发现的 skill 均可加载', () => {
    // 抽样验证：所有 skill 的 name 都能被 loadSkill 命中
    const skills = listSkills()
    for (const s of skills.slice(0, 5)) {
      const loaded = loadSkill(s.name)
      expect(loaded).not.toBeNull()
      expect(loaded!.name).toBe(s.name)
    }
  })
})

describe('renderSkillCatalog', () => {
  test('渲染出每个 skill 名称', () => {
    const catalog = renderSkillCatalog()
    expect(catalog).toContain('stock-deep-analysis')
    expect(catalog).toContain('valuation-framework')
  })

  test('每行以 - 开头', () => {
    const lines = renderSkillCatalog().split('\n')
    for (const line of lines) {
      expect(line.startsWith('- ')).toBe(true)
    }
  })
})
