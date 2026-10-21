---
name: testing-philosophy
description: 测试理念与 TDD：测试金字塔、AAA 原则、单元/集成/E2E 比例、测试写法约定。写测试或定测试策略时读。
---

# Testing Philosophy

个人编码习惯 - 测试理念

## 测试金字塔

```
        /\
       /  \
      / E2E \          # 少量 E2E 测试
     /--------\
    /          \
   / Integration \      # 适中集成测试
  /--------------\
 /                \
/    Unit Tests    \   # 大量单元测试
-------------------
```

推荐比例：**单元测试 : 集成测试 : E2E ≈ 70 : 20 : 10**

## 测试原则

### AAA 原则

```ts
describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    // Arrange - 准备测试数据
    const amount = 1234.56
    const currency = 'USD'

    // Act - 执行被测函数
    const result = formatCurrency(amount, currency)

    // Assert - 验证结果
    expect(result).toBe('$1,234.56')
  })
})
```

### 测试行为而非实现

```ts
// ✅ Good - 测试行为
it('should calculate discount correctly', () => {
  const price = calculateDiscount(100, 0.2)
  expect(price).toBe(80)
})

// ❌ Bad - 测试实现细节
it('should multiply price by 0.8', () => {
  const price = 100 * 0.8  // 测试实现而非行为
  expect(price).toBe(80)
})
```

### 测试名称要描述意图

```ts
// ✅ Good - 描述预期行为
it('should return null for invalid email', () => {})
it('should throw error when user is not authenticated', () => {})

// ❌ Bad - 模糊不清
it('should work 1', () => {})
it('test validate', () => {})
```

## 测试驱动开发 (TDD)

TDD 流程：**红 → 绿 → 重构**

```
1. 写一个失败的测试 (红)
2. 写最少的代码让测试通过 (绿)
3. 重构代码 (重构)
4. 重复
```

### TDD 示例：工具函数

假设要实现一个 `formatPhone` 函数：

#### Step 1: 先写测试（红）

```ts
// utils/format-phone.test.ts
import { formatPhone } from './format-phone'

describe('formatPhone', () => {
  // 测试用例 1
  it('should format 10-digit number with parentheses and dash', () => {
    const result = formatPhone('13812345678')
    expect(result).toBe('(138) 1234-5678')
  })

  // 测试用例 2
  it('should return empty string for invalid input', () => {
    const result = formatPhone('')
    expect(result).toBe('')
  })

  // 测试用例 3
  it('should handle number with country code', () => {
    const result = formatPhone('+8613812345678')
    expect(result).toBe('+86 (138) 1234-5678')
  })
})
```

运行测试 → 全部失败（红色）

#### Step 2: 写最少的代码让测试通过（绿）

```ts
// utils/format-phone.ts
export function formatPhone(phone: string): string {
  if (!phone) return ''

  // 简单实现，只处理中国大陆手机号
  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }

  if (phone.startsWith('+86') && cleaned.length === 13) {
    return `+86 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`
  }

  return phone
}
```

运行测试 → 全部通过（绿色）

#### Step 3: 重构

```ts
// utils/format-phone.ts
const CHINA_MOBILE_REGEX = /^1[3-9]\d{9}$/
const COUNTRY_CODE = '86'

export function formatPhone(phone: string): string {
  if (!phone) return ''

  const cleaned = phone.replace(/\D/g, '')

  // 中国手机号 11 位
  if (CHINA_MOBILE_REGEX.test(cleaned)) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }

  // 带 +86 的手机号
  if (phone.startsWith(`+${COUNTRY_CODE}`) && cleaned.length === 13) {
    return `+${COUNTRY_CODE} (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`
  }

  return phone
}
```

### TDD 适用场景

| 适用 ✅ | 不适用 ❌ |
|---------|-----------|
| 工具函数 | UI 组件 |
| 业务逻辑 | 复杂交互 |
| 算法实现 | 第三方库封装 |
| 数据转换 | 样式文件 |

## 适合单元测试的

| 类型 | 示例 | 原因 |
|------|------|------|
| **工具函数** | `formatDate()`, `validateEmail()`, `calcTotal()` | 纯函数，输入输出明确 |
| **业务逻辑** | 折扣计算、权限判断、状态机 | 逻辑复杂，容易出错 |
| **Store/状态管理** | Pinia store、Zustand | 逻辑集中，易于测试 |
| **Composables/Hooks** | `useAuth()`, `useFetch()` | 逻辑独立，依赖明确 |
| **算法** | 排序、搜索、数据转换 | 输入输出明确 |

### 示例：Store 单元测试

```ts
// stores/cart-store.test.ts
import { useCartStore } from './cart-store'
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useCartStore', () => {
  it('should add item to cart', () => {
    const store = useCartStore()

    store.addItem({ id: 1, name: 'Apple', price: 5 })

    expect(store.items).toHaveLength(1)
    expect(store.items[0].name).toBe('Apple')
  })

  it('should calculate total correctly', () => {
    const store = useCartStore()

    store.addItem({ id: 1, name: 'Apple', price: 5, quantity: 2 })
    store.addItem({ id: 2, name: 'Banana', price: 3, quantity: 1 })

    expect(store.total).toBe(13)
  })
})
```

## 不需要单元测试的

| 类型 | 示例 | 原因 |
|------|------|------|
| **简单 Getter** | `const name = computed(() => state.name)` | 只是透传数据 |
| **UI 组件** | 按钮、卡片、布局组件 | 应该用组件测试/E2E |
| **第三方库配置** | axios 实例、路由配置 | 只需确保不报错 |
| **样式文件** | CSS/SCSS | 无逻辑可测 |

### 简单 Getter 不需要测试

```ts
// ❌ 不需要测试
const userName = computed(() => state.userName)

// ✅ 简单转发，直接使用即可
```

## 测试优先级

```
高优先级 🔴
├── 核心业务逻辑（订单处理、支付、权限）
├── 工具函数（日期、验证、计算）
├── 用户登录/注册流程
└── 数据转换/处理逻辑

中优先级 🟡
├── Store 状态管理
├── Composables/Hooks
└── API 请求封装

低优先级 🟢
├── 简单展示组件
├── 页面布局
└── 样式文件
```

## 测试工具推荐

| 类型 | 工具 |
|------|------|
| 测试框架 | Vitest (推荐) / Jest |
| 组件测试 | Vue Test Utils / Testing Library |
| E2E 测试 | Playwright / Cypress |
| Mock | Vitest Mock / MSW |
| 覆盖率 | V8 内置 / Istanbul |

## 总结

1. **测试是有回报的投资** - 减少 bug，提高代码质量
2. **TDD 适合工具函数和业务逻辑** - 先写测试，再写实现
3. **不要为了测试而测试** - 优先测试核心业务和高风险代码
4. **测试金字塔** - 大量单元测试，少量 E2E
5. **保持测试简洁** - AAA 原则，测试名称清晰
