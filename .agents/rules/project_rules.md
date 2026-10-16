---
name: project_rules
description: 项目代码规则总纲，声明 AI 生成代码必须遵循的规范来源（编码规范 / 业务交付 / 口径纪律）
alwaysApply: true
---

# Overview

本规则约束 AI 生成代码与交付物的规范来源，按用途分三层（详见 `agents.md` 技能路由表）：

1. **基础代码规范**：AI 生成的代码需遵循 `.agents/dev/belos-street/SKILL.md` 中的编码规范及 LLM coding 行为准则；涉及 Bun API 时参考 `.agents/dev/bun/SKILL.md`（用 Bun API，不用 Node 写法）；
2. **交付物规范**：生成/修改 `reports/`、`watchlist/` 下的 md/html 报告，须遵循 `.agents/business/` 下的业务技能（`html-report`、`report-review`），交付前自动跑 report-review 审查；
3. **口径纪律**（投资分析专属硬约束）：
   - 量化指标（估值分位、回撤、股息率等）必须标注计算口径与时间窗口；
   - 标的阈值按各标的历史区间单独校准，不搞一刀切；
   - 报告需包含空方论点，避免选择性乐观；
   - 价格参考位需注明性质（持有参考位 / 反弹减仓位等）。
4. **一致性约束**：`agents.md` 中声明的技能必须在 `.agents/` 对应目录下存在 skill 文件，且包含详细描述。
