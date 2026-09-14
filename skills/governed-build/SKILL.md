---
name: governed-build
description: Use when implementing tasks, running /build or /test, or starting subagent-driven-development in an agent-workflow-blueprint project.
---

# Governed Build

1. Before invoking Superpowers subagent-driven-development or executing-plans, run `node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md in-progress --write`. Substitute the actual epic. On resumed work, validate current approvals by checking the next task transition; never reset status to avoid a check.
2. Confirm this is the assigned epic worktree. Pass each task worker the approved plan revision, its single task, QA requirements and interface contracts. With no subagent tool, use a fresh developer session per task.
3. Transition task draft → approved → in-progress using the gate. Use only Superpowers test-driven-development: RED evidence, GREEN evidence, refactor, upstream task reviews, individual implementation commit. Record actual outputs and QA mapping in task evidence, then transition in-review → done. Never manufacture a passing test or reviewer.
4. Complete tasks serially within this epic unless separately isolated task worktrees and dependency ownership were agreed. Run all QA-required integration and special tests before epic review.
5. Transition plan to in-review, invoke agent-skills code-reviewer and code-review-and-quality through Superpowers requesting-code-review. Address findings using receiving-code-review. Then follow appsec-gate and governed-ship. Changes to approved scope require a new revision and renewed signoffs; implementation fixes invalidate final reviews.
