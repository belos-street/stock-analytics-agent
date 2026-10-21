---
name: error-handling
description: 错误处理约定：永不静默吞错（review 红线）、catch 三选一、typed error、入口 fail-fast、异步三连、服务端结构化错误 { code, message, details? }。写错误处理/日志时调用。
---

# Error Handling

个人编码习惯 - 错误处理

## 红线：永不静默吞错

`catch {}` / 失败返回 null 且无日志 / 丢掉错误不上抛 = **review 红线**（呼应 [code-review-dimensions](code-review-dimensions.md) 红线熔断第 3 条），命中即阻断。错误要可观测：要么上抛、要么落日志、要么转结构化返回，三选一，不能让错误无声消失。

```ts
// ❌ Bad: 静默吞掉，出错完全不可见
try {
  await save(data)
} catch {}

// ❌ Bad: 失败返回 null 且无日志，调用方不知道为何失败
async function loadConfig(): Promise<Config | null> {
  try {
    return await readConfig()
  } catch {
    return null
  }
}
```

## catch 后三选一

| 方案 | 适用 | 要点 |
|------|------|------|
| 日志 + 上抛 / 兜底 | 可恢复场景 | 落日志（含 cause），再决定继续 or 抛给上层 |
| 转换后显式抛出 | 跨层语义转换 | 自定义错误类包装，**保留 `cause`** |
| 返回结构化错误 | 上游要分支处理 | 判别联合（typed error）返回 |

```ts
// ✅ 方案一：日志 + 兜底后上抛含义不变
const data = await fetchData().catch((err) => {
  logger.error('fetchData failed', err)
  return fallbackData()  // 兜底后继续走
})

// ✅ 方案二：转换后显式抛出（保留 cause）
try {
  await updateUser(id, body)
} catch (err) {
  throw new UpdateUserError('更新用户失败', { cause: err })
}

// ✅ 方案三：返回结构化错误，上游走判别联合
type Try<T> = { ok: true; data: T } | { ok: false; code: string; message: string }
const r: Try<User> = await createUser(body)
if (!r.ok) return { code: r.code, message: r.message }
```

## typed error（不裸 throw string）

裸 `throw 'xxx'` 无法 `instanceof`、无堆栈、无 cause，一律禁止。用**自定义错误类**或**判别联合**表达错误语义。

```ts
// ❌ Bad
throw 'user not found'

// ✅ Good: 自定义错误类（可携带 cause / code）
class NotFoundError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NotFoundError'
  }
}
```

## 校验在入口 fail-fast

外部输入（请求体 / 环境变量 / 第三方响应）在入口用 zod 校验，fail-fast，不给脏数据进入内部的机会（呼应 [code-review-dimensions](code-review-dimensions.md) 健壮性维度与 [typescript-strictness](typescript-strictness.md)「校验在边界」）。

```ts
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000)
})
const env = EnvSchema.parse(process.env)  // 启动即校验，错就立刻崩
```

## 异步三连

1. **async 必有兜底**：顶层 `await` / Promise 链末端必须能捕获，未处理 rejection 要可观测（进程可配 `unhandledRejection` 日志）；
2. **定时器 / 事件回调自 catch**：回调里抛错不会冒泡到主流程，必须自己 catch；
3. **超时与资源释放**：网络 / IO 设超时；`clearTimeout`、DB 连接、临时文件用完释放。

```ts
// ❌ Bad: 回调内 rejection 无人接 → UnhandledRejection
setInterval(() => {
  refreshToken()
}, 60_000)

// ✅ Good: 回调自 catch
setInterval(async () => {
  try {
    await refreshToken()
  } catch (err) {
    logger.error('refreshToken failed', err)
  }
}, 60_000)
```

```ts
// ✅ 超时：Promise.race 保底
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    )
  ])
}
```

## 日志约定（写日志时对照）

- **单一 logger 入口**：项目统一一个 logger（如 `logger.ts` 单例），不各文件 new 实例；工具链用 bun / 框架自带 logger 即可，别引重型日志库
- **结构化字段**：`logger.error('event:xxx', { 字段, err })` 形式，事件名统一 `domain:action`，禁止拼接字符串日志
- **敏感信息不过日志**：token / 密钥 / 完整认证头不打印（呼应 [code-review-dimensions](code-review-dimensions.md) 安全维度「敏感信息是否进日志」）

```ts
// ✅ 事件名 + 结构化字段
logger.error('user:update failed', { userId, err })

// ❌ 字符串拼接 + 敏感字段进日志
logger.error(`update user ${userId} failed: ${err} token=${sessionToken}`)
```

## 服务端错误响应结构化

- 服务端错误统一 `{ code, message, details? }`，客户端按 `code` 分支处理，不解析英文文案
- **敏感信息不进日志 / 不返回给客户端**：密钥、堆栈、内部路径、SQL（呼应 [code-review-dimensions](code-review-dimensions.md) 安全维度）

```ts
// ✅ 对外统一结构，对内留完整堆栈
app.onError((err) => {
  logger.error('unhandled error', err)  // 详细堆栈只进服务端日志
  return Response.json(
    { code: 'INTERNAL', message: '服务器内部错误' },
    { status: 500 }
  )
})
```

## 速查

| 场景 | 做法 |
|------|------|
| catch 到错误 | 日志 + 上抛 / 转换抛出（保 cause）/ 结构化返回，三选一 |
| 抛错误 | 自定义错误类 / 判别联合，禁止 throw string |
| 外部输入 | 入口 zod 校验，fail-fast |
| 定时器 / 回调 | 自 catch，不让 rejection 裸奔 |
| 服务端出错 | `{ code, message, details? }`，敏感信息不进日志 |