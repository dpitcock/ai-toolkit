---
kind: task
id: TASK-003
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-002.md ]
evidence:
  red: "2026-09-26: node --test tests/task-tier.test.mjs tests/preflight.test.mjs
    failed as expected before implementation: selectEffectiveTier was not
    exported, and a Tier 2 workspace-policy fixture failed because preflight did
    not record tierPolicy provenance."
  green: "2026-09-26: node --test tests/task-tier.test.mjs
    tests/preflight.test.mjs passed: 21 tests, 0 failed."
  qa: "QA-GOV-001 and QA-GOV-002: verified max(configured minimum, risk result,
    earlier preflight tier), accepted shared-definition version/digest
    persistence, and low-risk routing under an accepted Tier 2 minimum. Extended
    focused verification including task-assessment tests passed: 30 tests, 0
    failed."
  commit: "91df68d5b7f84e63b331e6beaf66bcb40961dcbd"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-003: Effective tier throughout checks

## Acceptance, interfaces, and verification

Files: `scripts/lib/task-tier.mjs`, `scripts/lib/task-assessment.mjs`,
`tests/task-tier.test.mjs`, `tests/preflight.test.mjs`.
Select max(configured minimum, risk result, earlier preflight tier) and record
definition/provenance in new assessments. Do not trust claimed tier alone.
RED/GREEN: `node --test tests/task-tier.test.mjs tests/preflight.test.mjs`.
Assertions: Tier 1 config plus auth change becomes Tier 3; stricter workspace
minimum survives low-risk answers; stale provenance and final downgrade fail.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
