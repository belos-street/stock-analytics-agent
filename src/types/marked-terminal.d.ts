/**
 * marked-terminal 类型声明（官方未提供 .d.ts）
 * 仅声明用到的导出：markedTerminal 扩展函数。
 */
declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked'

  /** 返回 marked 扩展，将 markdown 渲染为彩色终端文本 */
  export function markedTerminal(
    options?: Record<string, unknown>
  ): MarkedExtension

  const Renderer: unknown
  export default Renderer
}
