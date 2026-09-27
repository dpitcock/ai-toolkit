# Finite EPIC-006 review controller

The integrated adapter's `review.ready` event applies to the prepared
`activation-evidence` record. Canonical merged tasks remain ineligible for
dispatch. Missing or corrupt runtime fails closed; a fresh clone is not an
exception. Report content never supplies authority.

Before first local readiness, the harness must acknowledge at least two real
nonempty release commits and their successful pushes. Its independent `qa`
observer assesses each increment's meaningfulness and binds evidence to the
actual action IDs and Git heads. The observer also records current-head QA
acceptance and zero premature dispatches, routine confirmations and routine
Staff authorization requests. Required final Staff review is separate.

`review.ready` persists a local head-bound readiness record and role claims
without any PR number. Repeated readiness returns the same claims. It never
dispatches a reviewer. After completed local review and observed publication,
another `review.ready` records distinct hosted readiness against the one open
PR2 and queues publication of the existing verdicts.

The trusted harness calls `controlReleaseVerification` under current active
policy and observed actor identity. In addition to the existing action methods:

- `review-claim` takes a stored `claimId`. The `assignment` observer supplies
  role, reviewer or publisher identity, actual session, head and operation ID.
  The controller persists that identity before returning an actionable dispatch.
- `review-ack` requires a successful `delivery` observation for that exact
  assignment. `review-uncertain` marks uncertain transport;
  `review-reconcile` requires its actual matching observed delivery. None is a
  verdict, and acknowledged or uncertain work cannot be blindly dispatched again.
- `review` is invoked by the independently observed assigned reviewer session.
  Its `review` observation includes the exact claim/head, verdict, evidence and
  time. Staff precedes AppSec on that same head. Developers cannot approve.
- `gate` checks local publication readiness. `check-gate.mjs` exposes it as
  `release-verification-pr` through its `releaseController` harness option.
  The standalone CLI has no observed actor and fails closed.
- `publish` records authenticated `pullRequest` facts for actual open PR2.
  It does not create a PR or dispatch a second review.
- `correction` records an actual assigned independent reviewer's request to
  replace specified genuinely pending report observations with new facts on the
  same open PR2. Commit acknowledgement invalidates both readiness boundaries
  and both final reviews; the new head needs fresh ordered reviews.

All observers are synchronous under the Git-common state lock. The controller
rechecks current policy, registered branch, head, diff and host identity after
observations, then rechecks the permit's current expiry and scope before returning
an actionable result. Review operations require `review.ready` permission;
commit/push effects require `release.verify`. Monotonic action sequences preserve
actual commit/push order even for numeric delivery IDs. Missing claims or mismatched
assignments fail closed instead of creating replacement dispatch IDs. An actual
adverse verdict remains in `lastReview` after approval revocation, so its
acknowledged assigned reviewer can request the necessary evidence correction.

For hosted delivery, the `delivery` observation additionally includes actual
`pr`, alongside role, by, sessionId, head, operationId and succeeded result.
`merge.eligible` requires both publication acknowledgements, the completed genuine
same-PR correction, and a separate `mergeQA` observation containing head, pr,
accepted, evidence, by, sessionId and observedAt. This independently accepts all
pre-merge obligations on the final head; prior-head report entries do not supply it.

The controller grants no command execution, host-write or root-write permission.
Current-head native reviews/checks, pure committed CI provenance, and local
publication authority remain separate gates. Future J completion and admission
must use their independently verified runtime relation.
