---
name: grill-with-docs
description: Full grill flow with auto-create and incremental update of root CONTEXT.md for persistent business context
---

# /grill-with-docs — Requirement Clarification with Persistence

Trigger: `/grill-with-docs`

**Description:** Reuse full grill logic from `/grill-me`, auto create & incrementally update root `CONTEXT.md` to persist business rules, terminology and requirement boundaries.

## Instructions

This skill inherits all questioning logic of [grill-me](grill-me.md), with additional file read/write logic for `CONTEXT.md`. Strict workflow as below.

### Step 1: Pre-check file status

1. Check if `CONTEXT.md` exists at project root folder.
2. If missing: Create `CONTEXT.md` with the official template (attached below).
3. If exists: Read all original content, retain all valid historical data, only perform **incremental updates** (never full overwrite).

### Step 2: Run full layered grill flow

Execute all Step 1~Step 3 questioning rules defined in [grill-me](grill-me.md). Still **NO CODE / DESIGN** output during questioning.

### Step 3: Incrementally update CONTEXT.md after each user reply

After every round of user answers, immediately write new clarified information into corresponding sections of `CONTEXT.md`:

1. Core Business Goal
2. User Roles & Core Scenarios
3. Input / Output Data Spec
4. Edge & Exception Handling Rules
5. Tech, Security & Performance Constraints
6. Feature Acceptance Criteria
7. Project Terminology Dictionary (unify naming for interfaces, variables, pages, states)

### Step 4: Self-check and output summary

After the user confirms all details are clear:

1. Run the [Self-Check](../SKILL.md#self-check-before-summary) before proceeding.
2. Output the structured **Requirement Clarification Summary** using the [output template](../SKILL.md#output-requirement-clarification-summary).
3. Remind user: All business context has been persisted to root `CONTEXT.md`; all subsequent development skills can reuse this document automatically.

### Step 5: Transition

Propose the next step using the [Transition Protocol](../SKILL.md#transition-protocol).

### Hard Rules (Must not break)

1. No code / architecture design during grill phase.
2. `CONTEXT.md` update must be incremental: preserve old valid content, only supplement or correct ambiguous descriptions.
3. Prioritize maintaining the Terminology Dictionary to unify naming and eliminate inconsistent business wording.

### Attached CONTEXT.md Initial Template

```markdown
# CONTEXT.md — Project Business Context Doc
Auto maintained by /grill-with-docs, all development workflows reference this doc first.

## 1. Core Business Goal

## 2. User Roles & Core Usage Scenarios

## 3. Data Spec: Input / Output

## 4. Edge & Exception Handling Rules

## 5. Tech Constraints, Security & Performance Requirements

## 6. Feature Acceptance Criteria

## 7. Project Terminology Dictionary

| Business Term | Unified Code Naming | Description |
|---------------|---------------------|-------------|

```
