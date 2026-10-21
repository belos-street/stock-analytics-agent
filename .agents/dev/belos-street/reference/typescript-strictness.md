---
name: typescript-strictness
description: TS 严格模式约定：strict 全家桶（noUncheckedIndexedAccess/exactOptionalPropertyTypes/noImplicitOverride/verbatimModuleSyntax/bundler）、as 断言纪律（禁双重断言、>3 处触发 review）、unknown>any 与 zod 边界验证。写类型代码时对照。
---

# TypeScript Strictness

个人编码习惯 - TS 严格模式

## 严格模式全家桶（新建项目默认开启）

`strict` 只是起点。把下面一整套都打开，每个开关「换来什么」见下表。以下为**已内联配置片段**，源项目见 `02-customer-service/tsconfig.json`（已启用：`strict` / `verbatimModuleSyntax` / `moduleResolution: bundler` / `noEmit` / `allowImportingTsExtensions` / `paths: {"@/*": ["./src/*"]}`），源项目变更不影响本文使用。

| 选项 | 开它换来什么 | 代价 / 注意 |
|------|-------------|------------|
| `strict` | 隐式 `any` 报错、null/undefined 严格检查、函数参数严格检查等一揽子严格行为 | 新项目必须开；老代码迁移成本高 |
| `noUncheckedIndexedAccess` | 数组 / 索引访问返回 `T \| undefined`，逼你处理越界 / 空值 | 每次 `arr[0]` 都要判空，可用循环 / `at()` 缓解 |
| `exactOptionalPropertyTypes` | 可选属性 `x?: number` 不能赋 `undefined`，显式区分「缺省」与「显式 undefined」 | 向函数传 `{ x: undefined }` 会报错，需省略或改代码 |
| `noImplicitOverride` | 覆盖父类方法必须写 `override` 关键字 | 每次覆盖都要显式标记 |
| `verbatimModuleSyntax` | 类型导入必须 `import type { ... }`，产物与源码类型严格 1:1 | import 语句要分清「值导入」与「类型导入」 |
| `moduleResolution: "bundler"` | 允许无扩展名导入、`paths` 别名、直接 import `.ts` 文件 | 仅 Bun / Vite 等 bundler 场景适用，非 Node 原生 |

```jsonc
// tsconfig.json 核心片段（对应 02-customer-service 实际配置）
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    // 建议再开
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

## `as` 断言纪律

1. **禁止 `as unknown as X` 双重断言**——先真正收窄（type guard / 判别联合），再做窄断言；
2. **外部响应先校验再断言**——API / 第三方库返回值到手里是 `any` 或 `unknown`，先过校验再定类型；
3. **单文件 > 3 处 `as` 触发 review 提醒**——`as` 是绕过类型系统的逃生门，过量说明类型建模有问题（呼应 [code-review-dimensions](code-review-dimensions.md) 健壮性维度：「外部输入 / 第三方响应有校验，而非裸 `as` 断言吞掉 undefined」）。

```ts
// ❌ Bad: 双重断言绕过类型系统，等于用 any
const user = data as unknown as User

// ✅ Good: 先做运行期检查收窄，再断言
interface RawUser { name?: string; age?: number }
const raw = data as RawUser
if (typeof raw.name !== 'string') throw new Error('invalid user')
const user = { name: raw.name, age: Number(raw.age) }
```

```ts
// ❌ Bad: 外部响应直接 as，吞掉 undefined 风险
const list = (await getUsers()).data as User[]

// ✅ Good: zod 边界校验 fail-fast
const UsersResponse = z.object({ data: z.array(UserSchema) })
const { data: list } = UsersResponse.parse(await getUsers())
```

## unknown > any

- 外部输入一律 `unknown` 起步，收窄后才可使用；禁止用 `any` 直接关闭类型检查
- 优先**判别联合**（discriminated union）穷尽分支，少用 `as`

```ts
// ❌ Bad: any 让类型系统完全失去保护
function handle(raw: any) {
  console.log(raw.name)  // 运行时才可能炸
}

// ✅ Good: unknown 必须收窄
function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null && 'name' in v
}
function handle(raw: unknown) {
  if (isUser(raw)) {
    console.log(raw.name)  // 收窄后可类型安全访问
  }
}
```

```ts
// ✅ 判别联合：状态穷尽，无需 as
type Result<T> =
  | { status: 'ok'; data: T }
  | { status: 'err'; code: number; message: string }

function handle(r: Result<string>) {
  switch (r.status) {
    case 'ok':
      return r.data
    case 'err':
      return `${r.code}: ${r.message}`
  }
}
```

## 校验在边界，内部不重复防御

- zod 校验放在**系统边界**（入参、环境变量、第三方响应），fail-fast；
- 边界校验过后，内部不再做冗余防御（呼应 [code-review-dimensions](code-review-dimensions.md)：「校验是否放在系统边界，内部无冗余防御（过度防护）」）。

## 速查

| 场景 | 做法 |
|------|------|
| 新建 tsconfig | strict 全家桶 + `verbatimModuleSyntax` + `moduleResolution: bundler` |
| 类型导入 | `import type { X }` |
| 外部数据 | zod 边界解析，`unknown` 起步 |
| 状态分支 | 判别联合，不用 `as` |
| `as` 泛滥 | 单文件 > 3 处 → review 提醒 |