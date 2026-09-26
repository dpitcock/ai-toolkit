---
kind: task
id: TASK-005
owner: "Codex"
status: in-progress
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-004.md ]
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

# TASK-005: Durable workflow state

## Acceptance, interfaces, and verification

Files: create `scripts/lib/workflow-state.mjs`, `tests/workflow-state.test.mjs`.
Interface: `withWorkflowState(root,mutate)` locks repository-local shared state,
validates its version, invokes one synchronous mutation, persists atomically,
then unlocks. Store authorization, dispatch, review, and epic records separately.
RED/GREEN: `node --test tests/workflow-state.test.mjs`.
Assertions: concurrent writers preserve both updates, interrupted writes retain
last valid state, malformed/symlinked state fails, linked worktrees share state.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
