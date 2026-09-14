---
name: governed-plan
description: Use when decomposing an epic or preparing a developer implementation plan in an agent-workflow-blueprint project.
---

# Governed Plan

1. Read docs/roles.md and the approved project plan. Use agent-skills planning-and-task-breakdown for epic boundaries; EM and Principal agree decomposition.
2. Load Superpowers using-git-worktrees, then run `bash scripts/new-epic.sh EPIC-001` from the coordination checkout (substitute the ID). A shell cannot invoke a conversational skill: the script displays it and performs its git fallback. Prefer harness-native worktree creation when available.
3. Circulate the epic: use appsec-gate for conditional triage and test-engineer for mandatory QA requirements. Transition epic draft → awaiting-review → approved → in-progress through check-gate.
4. Use Superpowers writing-plans to produce epic-plan.md and tiny task files; use canonical templates instead of upstream plan-file placement. Map QA requirements and every security concern. Each task has exact files, a RED/GREEN command, acceptance criteria, dependencies, and its own commit.
5. Transition plan to awaiting-principal-signoff. Principal reviews and records approval. If plan touches a flagged concern or auth/data/external boundary, transition to awaiting-appsec-signoff and obtain AppSec approval. Otherwise explicitly record appsec: not-required with rationale. Transition to approved using the validator. No build until governed-build succeeds.
