import { describe, test, expect } from 'bun:test'
import { loadPositionBrief, renderPositionContext } from '../src/agent/position'

/**
 * 持仓上下文加载单元测试（纯离线，读取 position.md）
 */

describe('loadPositionBrief', () => {
  test('加载到 position.md 内容', () => {
    const brief = loadPositionBrief()
    expect(brief.length).toBeGreaterThan(0)
  })

  test('包含投资者概况与持仓明细', () => {
    const brief = loadPositionBrief()
    expect(brief).toContain('投资者概况')
    expect(brief).toContain('资产配置')
  })

  test('已去除首尾空白', () => {
    const brief = loadPositionBrief()
    expect(brief).toBe(brief.trim())
  })
})

describe('renderPositionContext', () => {
  test('渲染出持仓内容', () => {
    const ctx = renderPositionContext()
    expect(ctx.length).toBeGreaterThan(0)
  })

  test('包含投资风格关键信息（风险偏好）', () => {
    const ctx = renderPositionContext()
    expect(ctx).toContain('风险偏好')
  })
})
