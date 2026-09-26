# Finite release verification correction

Developer session: `/root/correct_release_verification`, 2026-09-26.
This is the independently approved bounded review repair described in the
release-continuation addendum, independent QA trace and AppSec design assessment.
Canonical task, plan, assessment, policy and approval history remain unchanged.
The developer records implementation evidence, not independent approval.

## Increment 1: report and Git history boundary

Implementation: `af5d406`.

RED: `node --test tests/activation-report.test.mjs` failed 3/3 assertions because
the strict report/renderer APIs were absent. The subsequent
`node --test tests/activation-history.test.mjs` failed 9/9 assertions because
the bounded history API was absent.

GREEN: `node --test tests/activation-report.test.mjs tests/activation-history.test.mjs`
completed with 12 passed, zero failed/cancelled/skipped. `git diff --check` passed.
Coverage includes the deterministic fixed-marker renderer, exact outside bytes,
observed/pending/not-exercised semantics, bounded schemas and opaque references,
injection and path rejection, regular modes, source edits, hidden edit/revert,
and submitted/squash snapshot validation. These are generated development tests.

The marker is installed before original implementation review. No actual report
has been created: live I, activation and QA-GOV-010 remain pending. Runtime
authority, readiness, host integration and completion through J are subsequent
increments; this first increment alone grants no release capability.

## Increment 2: provenance and authenticated effect boundary

Implementation: `10e09fb`.

Historical adoption verification now reconstructs the pinned original
assessment and PR0/M/F/PR1/I chain independently of current-main authorization.
The existing live adoption gate still insists on F or I. The separate finite
release proof checks each submitted commit and the integrated J snapshot,
preserves PR0/PR1/PR2 identity, and verifies current main. CI selects the route
from the trusted base before candidate branch/status; native host review/check
enforcement is separate. Neither proof grants local publication authority.

`release.verify` accepts only prepare, commit and push. It resolves current
accepted policy through the same resolver as ordinary events. Preparation
requires the integrated adoption runtime, exact accepted revision-3 mirrors,
observed loaded I and a current routine permit in the registered isolated
worktree. The returned decision is `continue` / `authorized-routine`; it does
not execute commands or grant new tool/root-write permission.

The trusted `controlReleaseVerification` harness API provides dispatch, ack,
uncertain and reconcile operations for a stored delivery ID. Dispatch rechecks
the head, full working/staged fingerprint, main and policy before returning an
actionable result. Acknowledgement proves the actual Git child/snapshot or
observed push head, then rechecks state after the observation. An acknowledged
delivery cannot produce another actionable result. Pending effects require
acknowledgement or actual reconciliation before another action. Commits/pushes
do not dispatch reviewers. Canonical EPIC-006 completion is explicitly denied
until the future runtime integration path establishes verified J.

The pure scheduling kernel can now represent local `EPIC-006` /
`activation-evidence` claims without inventing a PR number. This is the identity
primitive only: local/host release readiness, ordered review orchestration and
publication are still subsequent work.

### Observed RED and GREEN

- Historical proof, release proof, trusted release host gate and real CI route
  tests each first failed because the relevant API/route was absent. Local
  release claim test first failed because scheduling required a PR identity.
- Authenticated action test first failed for absent runtime controller. A later
  test caught use of a noncanonical temporary root path; the controller now uses
  the resolver's canonical worktree path throughout.
- Root-relayed independent development findings were reproduced: array-coerced
  report SHA/digest values and replacement refs concealing outside-marker bytes.
  Both regressions failed before strict scalar checks and consistent
  `--no-replace-objects` snapshot reads were added. Status-only finalization
  semantics were not changed. Explicit rebase, allowed integration merge,
  unrelated merge and nonempty-count coverage were also added.
- The final race/pre-J assertions failed 2/2 before repair: completion reached
  the older generic observation route, and an observation-time document edit
  could be acknowledged. After the narrow repairs, the two action tests passed
  with zero failed/cancelled/skipped, duration 84355.821125 ms.

Completed focused commands and snapshot boundaries:

1. `node --test tests/activation-report.test.mjs tests/activation-history.test.mjs tests/epic-policy-adoption.test.mjs`
   passed 42/42 on the initial provenance implementation, before the final
   scalar/replacement/rebase and action additions; this is an earlier snapshot.
2. `node --test --test-name-pattern='historical adoption proof remains|release provenance proves|trusted release stage|release trusted host|real CI release route' tests/epic-policy-adoption.test.mjs`
   passed 5/5 after those proof fixes, duration 57472.828667 ms.
3. `node --test tests/lifecycle-finalization.test.mjs` passed 8/8 after the
   shared immutable-snapshot fix, duration 83024.355583 ms.
4. `node --test tests/workflow-event.test.mjs tests/workflow-state.test.mjs tests/workflow-authorization.test.mjs tests/review-scheduling.test.mjs tests/activation-report.test.mjs tests/activation-history.test.mjs`
   passed 56/56 after runtime extraction/wiring, before the last explicit
   pre-J guard and effect-observation race fix, duration 48122.82475 ms.
5. `node --test --test-name-pattern='active release preparation|release effects reject' tests/epic-policy-adoption.test.mjs`
   passed 2/2 on the final source snapshot, duration 84355.821125 ms.
   `git diff --check` passed before the implementation commit.

These fixtures perform real local Git commits and use controlled synchronous
host/activation/transport observations. They are development evidence, not an
actual push, installed protection, user-session activation or live QA-GOV-010.
No actual policy acceptance, PR, push, activation or completion occurred.

## Remaining serial integration

The next worker must implement explicit local readiness before review claims,
independent meaningfulness of two authorized nonempty commits/pushes, ordered
Staff then AppSec review, separate actual-PR2 publication claims, observed
correction on the same PR, and stale-head invalidation of all durable claims.
The runtime record reserves localReviews/localReady/hostReady/publishedPr/qa/
correction/proof fields, but these do not yet authorize any review or publication.
Strengthen their schemas when implementing those transitions.

Then connect typed J completion/admission, refreshed current checks/smoke/loaded
adapter/activation/cleanup, and a complete generated real-entrypoint trace.
The current action fixture executes current validators over generated historical
Git snapshots; it is not yet the required complete B/P/S/A-through-J trace.
Add historical-object preparation before npm's pinned suites in genuinely
ancestry-discarding fresh clones, using a fixed canonical anonymous data fetch.
Review existing/new history materializers for inherited Git config/credentials
when centralizing that transport. Finish adapter/rollout documentation and full
QA before independent final Staff and AppSec review. Actual QA-GOV-010 remains
pending the real release and independent QA acceptance.
