---
name: bun-project-conventions
description: Bun 工程约定：bun install/run/test 默认、lockfile 提交、依赖纪律（运行时 vs dev、少引依赖、升级独立）、scripts 标准集、bun init 初始化模板。搭 Bun 项目或定工程脚本时调用。
---

# Bun Project Conventions

个人编码习惯 - Bun 工程约定

## 默认 Bun

- 默认 `bun install` / `bun run` / `bun test`，不用 npm / yarn / pnpm 切换
- **lockfile（bun.lock）提交进库**，依赖版本可复现；`node_modules` 进 `.gitignore`
- 临时执行用 `bunx <pkg>`，不装全局工具

```bash
bun install
bun run dev
bun test
bunx oxfmt .   # 不全局安装 oxfmt
```

## 依赖纪律

| 原则 | 说明 |
|------|------|
| 运行时 vs dev 分清 | 项目跑起来需要的（运行时依赖）进 `dependencies`；构建 / 类型 / lint / 格式工具进 `devDependencies` |
| 少引依赖 | 能用 Bun 内置（`Bun.serve` / `Bun.Glob` / `Bun.file` 等）就不引第三方 |
| 升级是独立任务 | 升级依赖单独开 commit，不混在日常改动里（呼应 [git-workflow](git-workflow.md) 原子提交） |

参考源项目 `02-customer-service/package.json` 的依赖分布：`devDependencies` 只装 `@types/bun` / `oxfmt` / `oxlint` / `typescript` 四个，运行时按需；以下约定均已内联，不依赖源项目。

## package.json scripts 标准集

参考 `02-customer-service/package.json` 实际脚本，Web / 服务项目补齐 `dev`/`build`/`start`，TS 项目加 `typecheck`：

```jsonc
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",            // Web / 服务项目
    "build": "bun build src/index.ts --outdir dist",  // 需要打包时
    "start": "bun run dist/index.js",                 // 服务项目
    "test": "bun test",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "oxfmt .",
    "format:check": "oxfmt --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

> 实际情况核对（`02-customer-service/package.json`）：`test = bun test`、`lint = oxlint .`、`lint:fix = oxlint --fix .`、`format = oxfmt .`、`format:check = oxfmt --check .` 已落地；`typecheck` 用 `tsc --noEmit`（其 tsconfig 已开 `noEmit`）。

## 初始化模板

1. `bun init` 生成骨架
2. 装 devDependencies：`bun add -d typescript vite oxlint oxfmt`
3. 复制 `.oxlintrc.json` / `.oxfmtrc.jsonc`（完整配置见 [code-style](code-style.md)）
4. 三条验收命令过一遍：`bun run typecheck` / `bun run lint` / `bun run format:check`

```bash
bun init
bun add -d typescript vite oxlint oxfmt
# 复制 code-style.md 中的 .oxlintrc.json / .oxfmtrc.jsonc 到项目根
bun run lint && bun run format:check && bun run typecheck
```

## 速查

| 要做什么 | 命令 |
|----------|------|
| 安装依赖 | `bun install` |
| 跑脚本 | `bun run <script>` |
| 测试 | `bun test` |
| 临时执行 | `bunx <pkg>` |
| 加开发依赖 | `bun add -d <pkg>` |
| 加运行时依赖 | `bun add <pkg>` |