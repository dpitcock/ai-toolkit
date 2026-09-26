---
kind: task
id: TASK-009
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-008.md]
evidence:
  red: null
  green: null
  qa: null
  commit: null
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-009: Plan and merge state transitions

## Acceptance, interfaces, and verification

Files: `scripts/check-gate.mjs`, `scripts/check-pr.mjs`,
`tests/gates.test.mjs`, `tests/task-assessment.test.mjs`.
Introduce explicit plan-stage and implementation-stage gate behavior. Opening
or updating an implementation PR does not require finished final review;
merging still requires complete tasks/QA and fresh required host approvals.
Retain compatibility for historic plans and immutable preflight bindings.
Ordinary plan edits do not create another initial plan PR. Material scope
changes still reconcile affected authorization, assessments, and required gates.
RED/GREEN: `node --test tests/gates.test.mjs tests/task-assessment.test.mjs`.
Assertions: plan PR cannot contain source, plan verdict cannot satisfy code
review, approval metadata never creates a head-chasing loop, missing final
AppSec blocks merge, task completion still requires only task evidence.
Old metadata-only commit exemptions and historic evidence never satisfy the
new exact-current-head live merge gate. QA-GOV-005/006.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
