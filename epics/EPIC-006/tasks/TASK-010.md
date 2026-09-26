---
kind: task
id: TASK-010
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-009.md]
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

# TASK-010: Epic completion and sequential admission

## Acceptance, interfaces, and verification

Files: create `scripts/lib/epic-completion.mjs`,
`tests/epic-completion.test.mjs`.
Interface: `evaluateCompletion(evidence)` and `admitEpic(state,nextEpic)`.
Require remote-main merge result, current integrated checks/smoke evidence,
resolved epic debt/findings, current documentation, safe cleanup, and active
agent-path adoption. Evidence distinguishes submitted head and integration SHA.
Typed receipts bind repository, epic, PR, integration SHA, check IDs/results,
smoke revision, policy digest and loaded revision, plus observation time and
source. Fetch merge/check facts from the authenticated host at admission;
arbitrary all-green JSON cannot authorize next-epic start. Harness/session
observations supply actual activation and cleanup evidence with resource IDs.
Cleanup ownership must identify registered worktrees/branches/processes,
containment, clean status and pushed changes; reject repo root, other owners,
symlink escapes and forced cleanup. Revalidate deferred actions immediately
before execution. A new corrective PR or changed integrated state invalidates
earlier completion. Deleted state requires explicit recovery, not fresh success.
RED/GREEN: `node --test tests/epic-completion.test.mjs`.
Assertions: squash/rebase allowed; unavailable/pending checks, intermediate
merge, incomplete cleanup/activation, unresolved findings and restart fail.
Corrective PRs keep the same epic active. Legacy merged epics receive an
explicit historical baseline, not fabricated verification evidence.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
