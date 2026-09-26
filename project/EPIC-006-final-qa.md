# EPIC-006 implementation QA before final review

Recorded by root controller `/root`, 2026-09-26. All 17 canonical tasks are
`done` through their validated transitions. Plan revision 1, accepted active
policy/history and immutable assessment remain unchanged. This records test
evidence, not independent Staff/AppSec approval or release activation.

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
