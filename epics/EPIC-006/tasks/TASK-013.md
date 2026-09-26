---
kind: task
id: TASK-013
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-016.md]
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

# TASK-013: Migration and adopter verification

## Acceptance, interfaces, and verification

Files: `tests/scaffold.test.mjs`, `docs/verification.md`,
`epics/EPIC-006/epic-plan.md`, accepted config/history and task records.
Exercise a generated adopter from old config through explicit migration and
the complete new workflow. Apply the owner's approved config migration using
the existing transaction flow once supported; inspect the exact changed fields.
Run `npm test` and record local migration/scaffold evidence. This implementation
task ends before final review, merge, activation, or cleanup. QA-GOV-001..009.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
