---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: task
id: TASK-001
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: []
evidence:
  red: "41ccf89 adds UI-plan assertions that the pre-change validator cannot satisfy: it has neither the accessibility approval fields nor accessibility signoff states."
  green: "The conditional validator and accessibility tests added in 41ccf89 pass on the implementation; the scaffold follow-up is 783096728db24849c83e6f215821c485ff865b49."
  qa: "Fresh verification on 2026-09-24: npm test passed 17/17 and git diff --check passed; historical post-7830967 verification also passed 17/17."
  commit: "783096728db24849c83e6f215821c485ff865b49"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-001

## Acceptance criteria
- A plan with `accessibility.ui: true` cannot begin until an independent
  accessibility signoff exists, and cannot become PR-eligible until final
  accessibility review covers the same implementation commit.
- A non-UI plan remains eligible to use the normal low-risk path with explicit
  `accessibility.ui: false` and no accessibility approvals.
- Generated-project scaffold testing remains compatible with the two added
  approval fields.

## Files and dependencies
No prerequisite tasks. The implementation changed `scripts/check-gate.mjs`,
`tests/gates.test.mjs`, `tests/scaffold.test.mjs`, canonical project/epic/task
templates, `skills/accessibility-review/SKILL.md`, governed-plan/governed-ship,
and the corresponding README/workflow/verification documentation.

## TDD steps
RED: the UI-plan assertions introduced by `41ccf89` require approval fields and
states absent from its parent validator. GREEN: `41ccf89` implements the
conditional gate and tests. The scaffold compatibility failure discovered after
the schema expansion is corrected by `7830967`; fresh `npm test` passed 17/17
on 2026-09-24. No refactor beyond the focused fixture update was needed.

## QA mapping
QA-001. Run `npm test` for the gate and scaffold suites, then `git diff --check`.
The task is governance-only: no UI, manual assistive-technology, or runtime
integration testing applies.

## Handoff
Feature implementation: `41ccf89a1f1f938258df778d7c58b61d19eed8a5`.
Scaffold-regression fix and final implementation commit:
`783096728db24849c83e6f215821c485ff865b49`.
Obtain independent Dennis code review and final AppSec review on that exact
final commit before opening a PR.
