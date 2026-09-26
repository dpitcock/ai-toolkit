---
kind: task
id: TASK-008
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [tasks/TASK-001.md]
evidence: {red: null, green: null, qa: null, commit: null}
approvals: {principal_engineer: null, appsec: null, qa_lead: null, code_review: null, appsec_review: null, accessibility: null, accessibility_review: null}
---

# TASK-008: Remove the Out-of-Scope UI-Designer Schema

## Acceptance criteria

- The lifecycle parser no longer normalizes an optional `approvals.ui_designer` value.
- The canonical epic-plan template has no `ui_designer` field, and the associated normalization test is removed.
- Existing accessibility approvals and all other approval parsing remain unchanged.

## Files and dependencies

Modify `scripts/check-gate.mjs`, `epics/EPIC-XXX/epic-plan.md.template`, and `tests/gates.test.mjs`. Depends on completed TASK-001.

## TDD steps

First restore a focused failing assertion that a legacy plan exposes `undefined` for an absent `ui_designer` property; run `node --test tests/gates.test.mjs` and expect it to fail because TASK-001 currently normalizes that field to `null`. Remove only the normalization, template field, and focused test; rerun the focused suite and then `npm test` to prove lifecycle parsing and existing accessibility gates still pass.

## QA mapping

QA-005-ROLE-RESOLUTION. Record the RED output, GREEN output, and full-suite result; confirm the diff removes no accessibility approval or UI accessibility-gate behavior.
