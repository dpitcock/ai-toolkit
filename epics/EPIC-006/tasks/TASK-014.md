---
kind: task
id: TASK-014
owner: "Codex"
status: in-progress
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-003.md ]
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

# TASK-014: Reconstruct tier policy in final checks

## Acceptance, interfaces, and verification

Files: `scripts/check-tier1.mjs`, `scripts/check-tier2.mjs`,
`tests/check-tier1.test.mjs`, `tests/check-tier2.test.mjs`.
Consume the resolver and assessment provenance from TASK-003. Reconstruct
effective tier from committed accepted policy and actual diff; legacy evidence
still validates by its original contract. New evidence cannot weaken floors.
RED/GREEN: `node --test tests/check-tier1.test.mjs tests/check-tier2.test.mjs`.
Assertions: stale definition, forged tier, root/worktree weakening and scope
expansion fail; higher preflight tier persists. QA-GOV-001/002/003.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
