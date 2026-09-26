---
kind: task
id: TASK-008
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-007.md ]
evidence:
  red: "2026-09-26: node --test tests/review-evidence.test.mjs failed as expected
    before implementation because scripts/lib/review-evidence.mjs did not
    exist."
  green: "2026-09-26: node --test tests/review-evidence.test.mjs passed: 8 tests,
    0 failed. node --check scripts/check-host-reviews.mjs also passed."
  qa: "QA-GOV-005/006 verified: the pure evaluator accepts only mapped human
    actors' latest effective APPROVED verdict on the exact current SHA; old,
    dismissed, request-changes, wrong-actor, bot, duplicate-role-without-role-
    evidence, malformed, and out-of-order evidence fails closed. Plan receipts
    bind plan ID, revision, SHA, actor, role, verdict, and unresolved-request
    state. The trusted CLI collects complete paginated gh API review and check
    data, rechecks the PR head before and after collection and immediately
    before output, records current check receipts, and refuses pending or failed
    checks without retrieving or printing tokens."
  commit: 3f5156e210e62d1e910e98384edba0a15a71793d
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-008: Host review evidence

## Acceptance, interfaces, and verification

Files: create `scripts/lib/review-evidence.mjs`,
`scripts/check-host-reviews.mjs`, `tests/review-evidence.test.mjs`.
Interface: `evaluateReviews({stage,head,requiredRoles,identities,reviews})`.
The authoritative gate reads complete paginated GitHub data through
authenticated `gh api` in the trusted host execution path. Caller-supplied
snapshots are test/diagnostic input only and cannot authorize merge.
Never retrieve or print tokens. Bind repository, PR, current head, review IDs,
actor-role mapping provenance, dismissal state and current checks. Recheck
head after evidence collection and immediately before merge with expected SHA.
Implementation requires latest effective approving verdict from each mapped
actor on current head; dismissed/request-changes and wrong roles fail. Plan
stage receipts bind plan ID/revision/reviewed SHA/role/actor/verdict and unresolved
request state. A receipt remains an approval of that reviewed revision only;
the initial-plan exception may retain it toward that same plan's one initial
approval cycle, not claim approval of later content or a different plan/scope.
Unresolved requests for changes remain blocking. Human mappings are distinct
from bots. Preserve Principal → AppSec → conditional accessibility plan order
and Code Reviewer → AppSec → conditional accessibility final order.
RED/GREEN: `node --test tests/review-evidence.test.mjs`.
Assertions: paginated reviews, outdated heads, dismissed approvals, wrong actor,
same actor reused across distinct roles without role evidence, and races fail.
gh-identity submission lacks a head parameter: verify returned/host commit.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
