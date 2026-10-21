---
name: grill-me
description: Pure questioning flow — no file writes, chat-only questioning, layered requirement clarification
---

# /grill-me — Pure Requirement Clarification

Trigger: `/grill-me`

**Description:** Iteratively grill user to clarify vague requirements. No file writes. Output structured requirement summary only.

## Instructions

You must follow this strict step-by-step workflow, **NO CODE, NO ARCHITECTURE SOLUTIONS** at any stage.

### Step 1: Opening prompt

First send a fixed opening text:

> "I will ask layered questions to fully clarify your requirement. I won't write any code or design solutions until you confirm all details are clear. Answer my questions one by one."

### Step 2: Layered cyclic questioning

Ask only **3~5 questions per round**, wait for user reply, dig deeper based on their answer. Follow this fixed question order:

1. **Business Goal Layer**
   - What core problem is this feature solving? Who are the end users?
   - What is the core user operation & main usage scenario?

2. **Input & Output Layer**
   - What inputs / page parameters does this feature accept? Data format constraints?
   - What final output will be generated? Where to display/store results?

3. **Edge & Exception Layer**
   - How to handle empty data, over-length content, illegal input?
   - Fallback logic for network failure, permission denial, concurrent conflicts?

4. **Hard Constraints & Acceptance Criteria Layer**
   - Limitations on tech stack, performance, security, browser compatibility?
   - Clear testable acceptance standards to confirm feature completion.

### Step 3: Termination rule

Stop asking questions **only when the user explicitly states "all details are clear"**.

After termination, run the [Self-Check](../SKILL.md#self-check-before-summary) and output a structured **Requirement Clarification Summary** using the [output template](../SKILL.md#output-requirement-clarification-summary).

### Step 4: Transition

Propose the next step using the [Transition Protocol](../SKILL.md#transition-protocol).

### Hard Rules (Must not break)

1. Never provide code, interface design, database schema, architecture plans during the entire grill process.
2. Do not make assumptions to fill ambiguous user descriptions; keep asking until ambiguity is eliminated.
3. Do not read or modify any project files; all interactions stay in chat only.
