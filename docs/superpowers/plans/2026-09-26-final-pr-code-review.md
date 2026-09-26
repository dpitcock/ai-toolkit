# Final-PR Code Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the template require independent staff code review only for the final PR implementation revision and later implementation revisions.

**Architecture:** Preserve task-local RED/GREEN/QA evidence and commits. Align the lifecycle prose and governed wrappers around the existing plan-level final-review gate, whose validator already binds code and AppSec approvals to one implementation commit and rejects later implementation changes.

**Tech Stack:** Markdown workflow guidance, Node.js gate tests, built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-26-final-pr-code-review-design.md`

## Global Constraints

- Do not weaken task testing, task evidence, final AppSec review, or PR-only merge policy.
- Metadata-only updates under `epics/` and `project/` remain permitted after final review.
- An implementation change must invalidate both final approvals and trigger a new final code review.

## Review Focus

- A task may complete with test/QA evidence but no staff code-review approval.
- The final implementation revision, not an intermediate task commit, is the only required staff-review target.
- A code change after the final review remains rejected until a new review occurs.
- Metadata-only approval evidence does not invalidate a current review.
- Workflow instructions do not accidentally reintroduce a per-task staff-review mandate.

---

### Task 1: Align final-review workflow and gate regression coverage

**Files:**
- Modify: `AGENTS.md`, `docs/roles.md`, `docs/workflow.md`, `docs/gates.md`, `skills/governed-build/SKILL.md`, `skills/governed-ship/SKILL.md`
- Modify: `tests/gates.test.mjs`
- Create: `epics/EPIC-004/tasks/TASK-007.md`

**Interfaces:**
- Consumes: Plan-level `review_commit`, `approvals.code_review`, and `approvals.appsec_review` validation in `scripts/check-gate.mjs`.
- Produces: Consistent final-PR-only review guidance and a task with exact TDD/evidence requirements.

- [ ] **Step 1: Write failing gate/workflow behavior tests**

Add tests that prove a completed task does not require `approvals.code_review`, while `in-appsec-review` and PR eligibility still require a code review bound to the final implementation commit. Add behavior-oriented workflow coverage only where a consuming command can exercise it.

- [ ] **Step 2: Run the focused test to verify the intended gap**

Run: `node --test tests/gates.test.mjs`

Expected: FAIL until the workflow-facing regression is represented by the updated test or existing validator behavior is explicitly demonstrated.

- [ ] **Step 3: Make the smallest wording and test changes**

Remove only language that requires or implies staff code review for each task/commit. State that task verification is local, and that the independent five-axis code review occurs after all tasks on the final implementation revision; retain the existing re-review rule for later implementation changes.

- [ ] **Step 4: Verify focused behavior and full suite**

Run: `node --test tests/gates.test.mjs && npm test && git diff --check`

Expected: all focused and full tests pass; no whitespace errors.

- [ ] **Step 5: Commit implementation separately**

```bash
git add AGENTS.md docs/roles.md docs/workflow.md docs/gates.md skills/governed-build/SKILL.md skills/governed-ship/SKILL.md tests/gates.test.mjs epics/EPIC-004/tasks/TASK-007.md
git commit -m "docs: require code review only for final PR revisions"
```

## Self-review

The single task covers every policy requirement: it preserves task evidence,
states one final code-review moment, preserves re-review after implementation
changes, retains AppSec/PR gates, and tests the consumed plan-state behavior.
No API or data-model changes are needed because the plan-level validator already
encodes the exact-commit and post-review implementation-diff requirements.
