---
kind: task
id: TASK-007
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-006.md ]
evidence:
  red: "2026-09-26: node --test tests/review-scheduling.test.mjs failed as
    expected before implementation because scripts/lib/review-scheduling.mjs did
    not exist."
  green: "2026-09-26: node --test tests/review-scheduling.test.mjs passed: 7
    tests, 0 failed."
  qa: "QA-GOV-007 verified: review records are keyed by repository, PR, role, and
    head; ready events create one immutable queued claim per key; push
    invalidates only old-head readiness and produces no dispatch. A claim can
    move queued to claimed, then acknowledged or uncertain; uncertain claims
    reconcile only after matching observed operation ID, reviewer identity,
    role, and head. Wrong, replayed, stale-head, missing, and corrupt inputs
    fail closed, so no stale acknowledgement can advance a new head."
  commit: 267eec0c40dbaad043a34e6e540ace4f01f680f5
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-007: Review readiness and durable claims

## Acceptance, interfaces, and verification

Files: create `scripts/lib/review-scheduling.mjs`,
`tests/review-scheduling.test.mjs`.
Interface: `applyReviewEvent(state,event)` accepts ready, push, claim, ack,
and reconcile events. Key by repository, PR, role, head. Push clears readiness
for the old head without launching reviewers. Reconcile ambiguous dispatch
using observed external identity/commit before any retry.
Each claim has a generated immutable claim ID and legal transitions queued →
claimed → acknowledged or uncertain; uncertain → reconciled only with observed
external operation ID/role/head matching that claim. Replayed/wrong-ID ack
fails. Missing/corrupt state blocks progression, never implies completion.
RED/GREEN: `node --test tests/review-scheduling.test.mjs`.
Assertions: zero dispatch on pushes, duplicates have one claim, parallel claims
serialize, crash leaves uncertain claim, old-head ack cannot approve new head.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
