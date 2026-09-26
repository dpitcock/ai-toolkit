---
kind: task
id: TASK-013
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-016.md ]
evidence:
  red: "Generated legacy adopter failed at review readiness with human-needed /
    autopilot-policy-required before explicit migration; log
    /tmp/epic006-task013-red.log. Initial full npm test: 263/265 passed, 2
    integration-fixture failures, 0 skipped; /tmp/epic006-task013-full.log."
  green: "Scaffold + lifecycle suites passed 19/19; integration corrections passed
    32/32; final npm test passed 265/265, 0 failed, 0 skipped (176836.806959
    ms), /tmp/epic006-task013-full-green.log."
  qa: "QA-GOV-001..009 regression suite passed. Exact staged root/worktree
    candidates independently matched unchanged active baselines with only
    owner-approved policy fields changed; git diff --check passed. Actual
    adoption, verified release PR route and QA-GOV-010 remain pending."
  commit: "976511818e8ff65e7c71839adc361e419cd9720d"
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

- [x] Run the named regression and record actual RED evidence.
- [x] Implement this contract and run the focused GREEN command.
- [x] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [x] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.

## Implementation and sequencing

Task developer: `/root/implement_task013`, 2026-09-26. The existing approved
bootstrap route governs implementation; active legacy policy still denies
autopilot dispatch. This task preserves plan revision 1, completed task history,
immutable assessment and active root/worktree config/history. The independent
sequencing ruling in `project/EPIC-006-bootstrap-correction.md` permits real
generated-adopter migration plus exact staged candidates at implementation time.

The generated adopter starts with accepted legacy policy and runs its copied
initializer's real `propose-change` / `apply-change`. Assertions cover exact
changed fields, unchanged owner workspace/Slack/role/summary fields, unchanged
history prefix, a single revision-2 change record bound to shared definitions,
matching status digest and retired transaction journal. Proposal alone does
not alter policy or history.

With root-controller agreement, extracted the existing test-only lifecycle
fixture to `tests/helpers/lifecycle-fixture.mjs`; the scaffold and lifecycle
suite share it. The adopter runs its packaged exported controller and CLI
gates through review readiness, exact-head merge eligibility, real merged
transitions, finalization PR, integration, completion and next-epic admission.
S, M and I are asserted distinct. Existing negative matrices remain intact.
Transport/owner/reviewer/session observations are explicitly controlled fixture
data; no test result is claimed as actual host approval or adapter activation.
There are no runtime source changes.

The first full-suite run exposed two integration-test assumptions, with
263/265 passing and zero skips. The root controller assigned their bounded
test-only corrections: package `policy` alongside copied scripts in
`tests/workspace-config-slack.test.mjs`, and update the exact stronger
postmerge/Tier-3 denial in `tests/check-tier2.test.mjs` while preserving the
nonzero exit and rejected-assessment contract. Their focused rerun passed
32/32 with zero skips. No gate or production behavior was weakened.

The RED migration run withheld the explicit transaction and observed
`human-needed` / `autopilot-policy-required` at review readiness, proving that
legacy acceptance cannot silently activate the new workflow. Initial fixture
setup errors were corrected before recording that RED. Adding the real
transaction produced GREEN. The shared fixture accounts for the adopter's ESM
package by explicitly keeping its controlled executable transport CommonJS.

Staged root/worktree candidates and exact baseline/candidate/definition digests
are in `project/EPIC-006-migration-rollout.md`. Active adoption remains pending
approved integration, authorized coordination-root access, and a verified PR
route for postintegration policy/history changes. The status-only finalization
exception does not admit those changes; that release-route gap is explicit for
final reviewers. Root/linked acceptance, actual adapter activation, host
protection, safe cleanup and QA-GOV-010 remain release obligations.

## Local QA mapping

- QA-GOV-003/009: generated legacy acceptance, real migration transaction,
  packaged policy/controller/CLI execution, preserved owner fields/history.
- QA-GOV-005/006/007/008/009: shared lifecycle and negative gate matrices,
  separate original/finalization PRs, current-head observations, typed
  completion and fresh next-epic admission; these use test-only transports.
- QA-GOV-001..009: full-suite regression coverage retains the earlier task
  matrices; migration coverage does not replace those lower-level tests.
- QA-GOV-010 is pending actual-session release evidence and is not satisfied
  by fixture results. Independent final staff/AppSec reviews are still required.

## Verification commands and retained local logs

- `node --test --test-name-pattern='generated legacy adopter' tests/scaffold.test.mjs`:
  observed RED before migration, `/tmp/epic006-task013-red.log`.
- `node --test tests/scaffold.test.mjs tests/lifecycle-finalization.test.mjs`:
  19 passed, `/tmp/epic006-task013-focused.log`.
- `node --test tests/check-tier2.test.mjs tests/workspace-config-slack.test.mjs`:
  32 passed, `/tmp/epic006-task013-integration-green.log`.
- `npm test`: final exit 0, 265 passed, no failures/cancellations/skips/todos;
  `/tmp/epic006-task013-full-green.log`. Earlier complete run retained at
  `/tmp/epic006-task013-full.log` records the two repaired fixture failures.
- Native read-only Node assertions deep-compared each candidate to its current
  root/worktree baseline plus the exact authorized policy field delta and
  confirmed both baseline digests. `git diff --check` passed before commit.

Implementation commit: `976511818e8ff65e7c71839adc361e419cd9720d`.
This task's gated evidence is committed separately to avoid self-reference.
