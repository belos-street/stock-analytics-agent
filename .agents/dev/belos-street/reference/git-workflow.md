---
name: git-workflow
description: Git 工作流约定：commit message 格式、main/dev/feature 分支策略、原子提交与 WIP、pull --rebase 多端协作、提交前安全检查。提交/推送/分支时调用。
---

# Git Workflow

个人编码习惯 - Git 工作流

## Commit Message

格式：`<type>: <subject>`，type 用小写英文，subject 用简短祈使句（像给系统下指令），单行。

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `docs` | 文档 |
| `fix` | 修 bug |
| `refactor` | 重构（行为不变） |
| `chore` | 杂务 / 构建 / 依赖 / 配置 |
| `perf` / `test` | （可选）性能优化 / 测试 |

```bash
# ✅
feat: add user profile page
fix: correct token refresh race
docs: explain timeout behavior in README
refactor: extract fetchWithRetry helper
chore: bump oxlint to 1.x

# ❌ 信息量为零
update stuff
bug fix
wip
```

## 分支策略

`main`（稳定）+ `dev`（日常）+ `feature/*`（可选）。小改动直接在 `dev`；大功能 / 实验开 `feature/*`，完成后合入 `dev`，发版时 `dev → main`。

| 分支 | 用途 | 合入方式 |
|------|------|----------|
| `main` | 稳定，可发布 | 从 `dev` 合入（测试通过后） |
| `dev` | 日常开发主线 | 直接提交 / 合并 feature |
| `feature/*` | 大功能 / 实验（可选） | 完成合入 `dev`，删除分支 |

## 原子提交

一次提交只做一件事。提交前 `git diff` 看自己改了什么，确认没有夹带无关改动（呼应 [code-review-dimensions](code-review-dimensions.md) 一致性维度与 llm-coding-guidelines 的「外科式改动」）；半成品用 `WIP` 标注，方便识别先把活干完再说。

```bash
# ✅ 提交前 review 自己的 diff，只加本功能相关文件
git diff                 # 看未暂存改动
git add src/user-profile    # 只加相关文件
git commit -m "feat: add user profile page"

# ❌ 一股脑全塞
git add .
git commit -m "一堆改动"
```

```bash
# ✅ 半成品显式标注
git add src/xxx.ts
git commit -m "feat: WIP user profile layout"
```

## 多端协作（pull --rebase → 改 → add → commit → pull --rebase → push）

标准流转：先同步远端 → 本地改 → 精确暂存 → 提交 → 再同步（吸收远端新提交）→ 推送。**共享分支不用 force push**，rebase 解决冲突即可，force push 只在未共享的个人分支可用。

```bash
git pull --rebase        # 先同步远端
git add src/xxx.ts       # 改完精确暂存
git commit -m "fix: ..."
git pull --rebase        # 提交后再同步，吸收远端新提交
git push
```

## 提交前安全检查

- `.env` 永不提交，进 `.gitignore`
- key / token / 连接串 / 大文件不进库（大文件用对象存储，按需 Git LFS）
- **误提交密钥：立即轮换**——删除历史没用，密钥已经泄露；先轮换，再从库中移除

| 检查项 | 做法 |
|--------|------|
| `.env` / 密钥文件 | 进 `.gitignore`，永不提交 |
| token / key / 连接串 | 环境变量 / 密钥管理，不硬编码（呼应 [code-review-dimensions](code-review-dimensions.md) 安全维度） |
| 大文件 / 二进制 | 不进库 |
| 误提交密钥 | 先轮换，后移除（删历史不解决泄露） |

## 速查

| 场景 | 命令 / 约定 |
|------|-------------|
| 提交信息 | `<type>: <subject>`，type ∈ feat/docs/fix/refactor/chore(+perf/test) |
| 提交前 | `git diff` 自查，只 add 相关文件，原子提交 |
| 半成品 | commit message 加 `WIP` 标注 |
| 多端协作 | pull --rebase → 改 → add → commit → pull --rebase → push |
| 共享分支 | 不 force push |
| 密钥泄露 | 立即轮换 |