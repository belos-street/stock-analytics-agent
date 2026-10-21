---
name: llm-coding-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Invoke when writing, reviewing, or refactoring code to avoid overcomplication and make surgical changes.
license: MIT
metadata:
  author: Andrej Karpathy
  source: https://x.com/karpathy/status/2015883857489522876
  tags: [llm, coding, guidelines, best-practices]
---

# Karpathy Guidelines

> **第三方转引说明**：本文为 Andrej Karpathy 原文转引（英文），保留原样式——示例代码带分号 / 双引号，**与本 skill 集的 [code-style](code-style.md)（无分号、单引号）不一致，示例仅为演示语义，不适用本集风格**。
> **与 [ai-coding](ai-coding.md) 的分工**：本文管「生成代码时的行为准则」（不过度设计 / 不静默假设 / 外科式改动 / 强验收标准），ai-coding 管「把 Agent 工具与工作流用对」（上下文工程 / 产物验收 / AI review）；本文的 Common Pitfalls 是通用编程准则，ai-coding 的「常见坑」是 AI 协作实操场景，二者互补不重复。
>
> Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's insights on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## When to Use

Invoke these guidelines when:
- Writing new code
- Reviewing code (yours or others)
- Refactoring existing code
- Making changes to production code
- Uncertain about the right approach

## Core Principles

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Example:**
```
Before coding, I need to clarify:
1. Should this handle edge case X or assume it won't happen?
2. Is performance critical here, or is readability more important?
3. Should I use approach A (simpler) or approach B (more flexible)?
```

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

**Ask yourself:** "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Anti-pattern:**
```typescript
// ❌ Over-engineered for a one-time use
abstract class DataProcessor<T> {
  protected abstract transform(data: T): T;
  // ... 100 lines of abstraction
}
```

**Better:**
```typescript
// ✅ Simple and direct
function processData(data) {
  // Direct transformation
  return data.map(item => item.value);
}
```

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

**Anti-pattern:**
```diff
- // Old comment style
- const oldVar = getValue();
+ // New comment style with better naming
+ const newValue = getBetterValue();
+ 
+ // Also cleaned up unrelated code
- const unused = something();
```

**Better:**
```diff
- const oldVar = getValue();
+ const newValue = getValue(); // Only change what's needed
```

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

**Strong success criteria** let you loop independently. **Weak criteria** ("make it work") require constant clarification.

## Common Pitfalls

### Over-complication

**Problem:** Writing more code than necessary.

**Signs:**
- Creating abstractions before understanding the problem
- Adding "just in case" features
- Multiple layers of indirection for simple logic

**Solution:** Start with the simplest working solution. Only add complexity when proven necessary.

### Silent Assumptions

**Problem:** Making assumptions without stating them.

**Signs:**
- Picking one interpretation without mentioning alternatives
- Not asking when requirements are unclear
- Implementing based on guesswork

**Solution:** Explicitly state assumptions before coding. Get confirmation.

### Unrelated Changes

**Problem:** Making changes beyond the scope of the request.

**Signs:**
- "While I'm here, let me fix..."
- Refactoring code that doesn't affect your changes
- Updating comments/style in unrelated sections

**Solution:** Every changed line should trace to the user's request.

### Weak Success Criteria

**Problem:** Vague goals that can't be verified.

**Signs:**
- "Make it work"
- "Improve performance"
- "Better error handling"

**Solution:** Define concrete, testable criteria:
- "Tests pass for inputs X, Y, Z"
- "Response time < 100ms for 1000 requests"
- "Handle errors A, B, C with specific messages"

## Application Examples

### Code Review

```markdown
Reviewing this code against Karpathy Guidelines:

✅ Simple: Direct solution, no over-engineering
⚠️ Assumptions: Assumes input is always valid - should we validate?
❌ Scope: Removed unrelated dead code (lines 45-50) - should only fix the bug
⚠️ Success criteria: "Make it faster" is vague - suggest "Reduce from 500ms to 100ms"
```

### Before Implementation

```markdown
Before I implement this feature, let me clarify:

1. **Assumption**: Should this handle empty arrays or assume non-empty?
2. **Approach**: I see two ways:
   - Simple: Direct iteration (10 lines)
   - Flexible: Higher-order function (25 lines)
   Recommendation: Simple, unless you need composability
3. **Success criteria**: 
   - ✅ Tests pass for normal cases
   - ✅ Tests pass for edge cases (empty, null)
   - ✅ No performance regression
```

### Surgical Change

```markdown
Making minimal changes to fix the authentication bug:

**Files to change:**
- `src/auth.ts:45-52` (fix token validation)
- `src/auth.ts:12` (remove unused import from my fix)

**Not changing:**
- `src/auth.ts:78-85` (dead code, but unrelated to this fix)
- Comments in `src/auth.ts:20` (unrelated to fix)
```

## Checklist

Before submitting code, verify:

- [ ] **Simplicity**: Is this the simplest working solution?
- [ ] **Assumptions**: Have I stated all assumptions explicitly?
- [ ] **Scope**: Does every changed line trace to the request?
- [ ] **Success criteria**: Can I verify this works with tests?
- [ ] **Cleanup**: Did I remove only what MY changes made unused?

## Resources

- **Original Source**: [Karpathy on X](https://x.com/karpathy/status/2015883857489522876)
- **Related**: [brainstorming](../../superpowers/brainstorming/SKILL.md) - Design exploration
- **Related**: [writing-plans](../../superpowers/writing-plans/SKILL.md) - Implementation planning
