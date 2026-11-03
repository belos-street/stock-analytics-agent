/**
 * 合规红线词表（v3.1 · 步骤 4）。
 * 只做机械命中：收益承诺 / 概率承诺 / 保本 / 精确买卖点。
 * 正常引用（如“年报披露的股息率为 3%”）不应命中。
 */

const RULES: Array<{ name: string; re: RegExp }> = [
  {
    name: '收益承诺',
    re: /(稳赚|包赚|保证收益|必涨|必跌|躺赚)|(?<!并非)(?<!不是)(?<!绝非)无风险(?!利率)/
  },
  { name: '概率承诺', re: /大概率(上涨|下跌|赚钱|盈利)|必然(上涨|下跌)/ },
  { name: '保本', re: /保本|稳赚不赔|本金安全/ },
  {
    name: '精确买卖点',
    re: /(买入价|卖出价|目标价)\s*[:：]?\s*\d+(\.\d+)?\s*元|精确(买点|卖点)/
  }
]

export interface ComplianceResult {
  hit: boolean
  terms: string[]
}

/** 命中的红线类别；hit=false 表示未命中 */
export function checkCompliance(text: string): ComplianceResult {
  const terms = RULES.filter((r) => r.re.test(text)).map((r) => r.name)
  return { hit: terms.length > 0, terms }
}
