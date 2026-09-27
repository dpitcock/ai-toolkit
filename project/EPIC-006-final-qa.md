# EPIC-006 implementation QA before final review

Recorded by root controller `/root`, 2026-09-26. All 17 canonical tasks are
`done` through their validated transitions. Plan revision 1, accepted active
policy/history and immutable assessment remain unchanged. This records test
evidence, not independent Staff/AppSec approval or release activation.

## Corrective verification

At `2026-09-27T15:44:04Z`, an overlong `host-review-events.test.mjs` run was
terminated under a one-time operator override. It was replaced in this session
by a completed `node --test tests/host-review-events.test.mjs` run: 39/39
tests passed, with zero failed,
cancelled, or skipped (16919.914208 ms). The override is therefore superseded;
this is completed corrective QA evidence, not a waiver or a future exception.

## Current production-continuation verification

The earlier personal-use checkpoint is historical. For the authorized
production continuation, the controller completed the full originally affected
regression scope without interruption:

`node --test tests/bootstrap-policy.test.mjs tests/check-tier2.test.mjs tests/epic-policy-adoption.test.mjs`

Result: 128 passed, zero failed, cancelled, or skipped (946436.536834 ms).
Together with the completed `host-review-events.test.mjs` corrective run above,
this is the current QA evidence for PR #12. It does not replace independent
Principal/Staff, QA, or AppSec review, host checks, or merge evidence.

The current session found and corrected ordinary PR stage routing and
pre-merge materialization regressions; separate source/evidence commits are
documented in `EPIC-006-qa-routing-correction.md` and
`EPIC-006-qa-materialization-correction.md`. The subsequent completion schema
correction is recorded in `EPIC-006-qa-completion-correction.md`.
Historic interrupted broad runs remain diagnostic evidence only. The current
production-continuation result above, not the historical personal-use result,
is the QA basis for this PR.

## Current correction verification

The 265-test result below describes the original implementation snapshot and
is retained only as history. The current 128-test production-continuation run
and 39-test corrective run above establish the QA reruns for this exact PR
head's preceding implementation. The canonical plan remains in progress until
the independent review, host-check, and merge gates complete.

Root independently verified prerequisite repair
`205db48a025ef90ade691ae7a04f1f2003e22fd6` in a detached clone:
`node --test --test-name-pattern='release commit authorization rejects hidden index'
tests/epic-policy-adoption.test.mjs` passed 1/1, with zero failed, skipped,
cancelled or todo (87837.589417 ms). The regression covers hidden staged source,
whitespace-prefixed unauthorized paths, mismatched staged evidence and a branch
change during observation. Log: `/tmp/epic006-effect-fix-independent.log`.

Root independently ran `node --test tests/release-review-integrity.test.mjs`
against the readiness worker's frozen source. Both tests passed, with zero
failed, skipped, cancelled or todo (3371.889458 ms). This verifies missing-claim
and assignment rejection plus numeric delivery-ID ordering, not the complete
release lifecycle. Log: `/tmp/epic006-readiness-integrity-independent-sh.log`.
The tested file SHA-256 was
`69f5588232cff4e3450f19e5233b6c29c4d2499ef640c64efdb1d14e0fb43bdf`.
The frozen readiness implementation was subsequently committed as
`70d21cbaedce52889e2d1cf8659670fd92fb5ef5`. Root then independently ran
`node --test --test-name-pattern='finite release readiness|same open PR2 correction'
tests/epic-policy-adoption.test.mjs` in a detached clone of that exact commit.
Both runtime tests passed, with zero failed, skipped, cancelled or todo
(498146.36225 ms). They exercise local readiness, independent ordered reviews,
separate hosted publication, and renewed reviews after the same-PR evidence
correction. Log: `/tmp/epic006-readiness-runtime-independent.log`.

### Failed runs retained for diagnosis

The independent eight-file run on
`10e09fb8ccd32df52817b97d4387c7d1d37e81a0` passed 90/95 tests and failed five
real-CLI positive cases (1449020.758458 ms). It is not a passing QA run.
Log: `/tmp/epic006-release-proof-independent.log`. A diagnostic rerun of those
five cases passed 0/5 (all five failed; 1375765.473875 ms), with unchanged
assertions and production timeout. Log: `/tmp/epic006-observation-diagnostic-rerun.log`.
Each failed CLI recorded a local controlled `gh` subprocess timing out after
approximately 30000 ms, with `ETIMEDOUT`, `SIGTERM` and empty stderr. An
outside-sandbox rerun of the real CI release route also passed 0/1; sandbox
causality is therefore not established.

Independent read-only debugging by `/root/diagnose_host_mock_timeout`
reproduced a generated shell mock blocked before its code ran: direct execution
stalled for 118.09 seconds, while `/bin/sh` executing the same script returned
in 0.00 seconds. A sample showed `_dyld_start+0` and a 96 KiB footprint.
One-line Node startup also took 56.58 seconds. Executable launch blocking is
observed; attribution to macOS executable-policy validation remains an inference.
No operating-system security control or production timeout was changed.

The test transport correction and full affected rerun remain required. Negative
tests that merely returned status 1 during the failed run cannot establish their
intended rejection behavior when an unrelated API timeout could explain it.
Fixtures and diagnostic observations never count as live activation evidence.

Root's dependency audit reported zero vulnerabilities with
`npm audit --omit=dev --ignore-scripts --cache .npm-cache` on Node v24.11.0,
npm 11.6.1, package-lock blob
`24902f510e4e61fb9c1c4c9ffa47292da7eff5b0`. Verify that lock identity again at
the final QA snapshot. Hosted Node 22 verification remains a separate obligation.

## Verified implementation

TASK-013 implementation: `976511818e8ff65e7c71839adc361e419cd9720d`.
Task evidence: `63257a6e4e1e5d75840f5d89d0f5178977ce6190`.
No implementation changed between its passing full run and the independent
root verification below. The worktree was clean before this QA record.

- Full `npm test`: 265 passed; zero failed, skipped, cancelled or todo.
  Executed by `/root/implement_task013`; root inspected the completed log
  `/tmp/epic006-task013-full-green.log` (176836.806959 ms).
- Root independently ran `node --test tests/scaffold.test.mjs
  tests/lifecycle-finalization.test.mjs tests/check-tier2.test.mjs
  tests/workspace-config-slack.test.mjs`: 51 passed; zero failed or skipped.
  Log: `/tmp/epic006-task013-independent.log` (60446.0435 ms).
- Root verified every shell script with `bash -n`: passed.
- Root ran `npm audit --omit=dev --ignore-scripts --cache .npm-cache`:
  zero reported vulnerabilities.
- `git diff --check`: passed. Local runtime: Node v24.11.0; hosted CI must
  separately verify the configured Node 22 environment.

The full-run RED was 263/265: an adopter fixture omitted shared policy assets,
and a negative test expected the former merged-plan rejection wording. Both
test-only assumptions were corrected while retaining rejection and exit checks.
The successful rerun contains no suppressed or skipped assertions.

## QA contract coverage

QA-GOV-001/002: tier floors, risk/UI escalation, shared definition/provenance,
invalid overrides, root/worktree policy binding and PR-only constraints.
QA-GOV-003: explicit legacy migration, preserved old history/fields, candidate
and base digests, interruption/recovery and generated-adopter transaction.
QA-GOV-004: bounded authority, actual controller boundary, stale policy and
actor/revocation checks, both autopilot modes and no environment identity.
QA-GOV-005/006: plan versus implementation gates, authenticated exact-head
review/check evidence, dismissals, roles, pagination, races and trusted events.
QA-GOV-007: durable scheduling, readiness-only claims, duplicates/restarts,
transport ambiguity, acknowledgements and distinct publication PRs.
QA-GOV-008: typed completion, fresh integration, separate submitted/merge/main
identities, actual PR-based finalization, safe owned cleanup and admission.
QA-GOV-009: real CLI and packaged embedding entrypoints, shared adopter assets,
new-epic admission, complete generated migration/lifecycle and documentation.

Per-task RED/GREEN and correction details remain in their task records and
`EPIC-006-{bootstrap,dispatch,task015,lifecycle}-correction.md` evidence.
Controlled GitHub transports and fixture identities are test data; they are
not real approvals, protections, integration or activation receipts.

## Release obligations and review attention

QA-GOV-010 is the explicitly separate release phase. Independent final Staff
then AppSec review must cover the same final implementation revision before
the implementation PR. Hosted checks/reviews, actual PR integration, trusted
status observation, verified native protections, accepted root/worktree policy,
loaded integrated controller, actual session transcript and owned cleanup are
still required. EPIC-007 remains blocked.

Review `EPIC-006-migration-rollout.md`: exact candidates are staged, but current
exclusive-worktree authorization does not permit coordination-root writes.
The route for committing post-integration policy/history adoption has not been
established or exercised; it cannot use the status-only finalization exception.
Resolve that release boundary before applying either active transaction.
Reviewers should distinguish expected release obligations from implementation
defects and report any blocking gap; this document grants no waiver.

The shared GitHub Actions app identity is not a cryptographic identity for one
workflow. Native independent reviews and protected governance paths remain
required alongside the trusted exact-head publisher; do not claim otherwise.
