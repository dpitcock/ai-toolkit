# Finite release readiness correction

Developer: `/root/correct_release_readiness`, 2026-09-26. This records bounded
implementation evidence under the existing bootstrap and finite release design
approvals. It is not final Staff/AppSec approval or live QA-GOV-010 acceptance.

## Prerequisite effect boundary

Source: `205db48a025ef90ade691ae7a04f1f2003e22fd6`.

Independent development inspection identified a hidden staged-source path that
could pass working-tree authorization, whitespace trimming of NUL-delimited Git
path identities, and cached branch authority across observation callbacks.

RED: the new real-entrypoint regression failed for missing expected rejection
of staged source (24689 ms total); its whitespace-path extension also failed
for missing expected rejection (63765 ms total).

GREEN: `node --test --test-name-pattern='release commit authorization rejects hidden index' tests/epic-policy-adoption.test.mjs`
passed 1/1, zero failed/cancelled/skipped, duration 62490.430417 ms. The test
exercises hidden source staging, partially staged inconsistent evidence, the
whitespace-prefixed path, valid complete staging, and an observation-time
same-SHA branch switch. `git diff --cached --check` passed before commit.

The controller resolves current registered policy under the state lock and
rechecks branch/policy before dispatch. Staged paths/modes/bytes must match the
authorized evidence snapshot; Git NUL-path output retains exact whitespace.
These generated Git fixtures are development evidence, not actual remote pushes
or session activation. Readiness implementation remains a separate increment.

## Finite readiness, ordered review and same-PR correction

Source: `70d21cbaedce52889e2d1cf8659670fd92fb5ef5`.

The real event route now persists explicit local release/head readiness and
role claims only after two actual acknowledged nonempty commits and successful
pushes, plus independent meaningfulness/QA observations bound to their receipt
IDs and heads. Monotonic action sequences preserve chronology for numeric IDs.
Independent observed Staff and AppSec sessions supply actual verdicts in order;
claim, dispatch, acknowledgement, reconciliation and verdict remain distinct.

The `release-verification-pr` gate requires local runtime authority and reviews.
Observed publication binds one actual PR2. Hosted readiness queues publication
of those completed verdicts, without dispatching duplicate independent reviews.
An acknowledged independent reviewer can request a genuine pending-to-observed
correction even after an adverse verdict revokes approvals. The adverse verdict
is retained separately; the changed head invalidates both readiness boundaries
and both reviews, requires a successful push on the same PR, and receives fresh
Staff then AppSec review. Native exact-head reviews/checks and separate final
independent QA acceptance remain required for `merge.eligible`.

Missing claims/assignments, corrupt runtime, stale or replaced PR2, stale native
reviews, absent QA, unsupported scope, and observation-time permit expiry deny
progress. Report claims are never authority. The internal runtime proof permits
only the acknowledged published head while a local correction awaits its push;
CI and native-host proof remain exact-head. A successful push receipt cannot
override the actual stale host head. APIs and observer fields are documented in
`docs/release-verification-controller.md`.

### Observed verification

Meaningful RED results included the old merged-plan readiness fallback,
successful receipt overriding stale PR2, review operations using commit-only
authority, absent claim-integrity API, numeric-ID chronology rejection, and
missing retained adverse verdict. The initial test fixture's unsupported
reference type was corrected before counting the readiness RED result.
Root-relayed interim independent development inspection identified the adverse
review correction dead end, numeric ordering, and post-observation expiry gap;
their regressions are included in the final run. That inspection is not final
Staff or AppSec implementation approval.

The source was frozen before these final commands. All assertions and production
timeouts remained unchanged. Commands ran outside the sandbox as a controlled
environment comparison; substantial process-startup delays persisted.

1. `node --test --test-name-pattern='finite release readiness persists|same open PR2 correction|release commit authorization rejects hidden index|active release preparation|release effects reject' tests/epic-policy-adoption.test.mjs`
   passed **5/5**, zero failed/cancelled/skipped, duration **1182730.118625 ms**.
2. `node --test tests/release-review-integrity.test.mjs tests/review-scheduling.test.mjs tests/workflow-state.test.mjs tests/workflow-event.test.mjs tests/activation-report.test.mjs tests/activation-history.test.mjs tests/workflow-authorization.test.mjs`
   passed **58/58**, zero failed/cancelled/skipped, duration **599391.684167 ms**.
3. `node --test --test-name-pattern='release provenance proves|trusted release stage|release trusted host gate' tests/epic-policy-adoption.test.mjs`
   passed **3/3**, zero failed/cancelled/skipped, duration **737599.640292 ms**.

Total: **66 scoped development tests passed**. `git diff --cached --check`
passed before the source commit. Earlier passing and failing iterations are
earlier snapshots, not substitutes for this frozen-source result.

These fixtures use real local Git commits and controlled synchronous observations.
They do not establish actual remote pushes, policy adoption, session activation,
installed host protections, independent final approval, or live QA-GOV-010.
No canonical status, plan, task, assessment or actual policy was changed.

## Serial work still pending

Root separately recorded real-CLI test transport failures with measured native
child launch timeouts. This scoped passing run does not erase that full-QA issue;
the serial test-only transport correction remains pending, without weakening
production timeouts or host gates. Typed J integration/completion/admission,
the full generated through-J trace, final independent Staff/AppSec review and
actual release/QA-GOV-010 remain subsequent work. Root owns the final QA record.
