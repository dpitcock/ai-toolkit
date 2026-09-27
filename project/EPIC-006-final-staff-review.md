# EPIC-006 independent final Staff review

Verdict: **REQUEST CHANGES**.

Reviewer: Codex Staff reviewer `/root/final_staff_review`, independently
assigned review session, 2026-09-26. Canonical plan revision: 1.
Reviewed revision: `379cba3d027b4c9c8fa2770564ff6c10c46e1ac2`.
Base: `553daf9fb49df58e55c3c5a6fbb68df6a0be0a41`, verified as
`origin/main` and its merge base with the reviewed revision. Local `main`
is older (`f6f0d42`) and was not used as the review baseline.

This is an actual independent code review, not AppSec approval, a host
review, release verification, or permission to create a PR. Source remained
frozen throughout review. Only this report and canonical review fields are
owned by this review session.

## Required findings

### CR-006-001 — The actual implementation PR fails its own admission check

Severity: Required, P1. Locations: `scripts/check-tier2.mjs:309`,
`project/task-assessments/governance-activation.yaml:36`.

In a fresh single-checkout clone of the exact reviewed commit, the real
`check-pr.mjs` with BASE_SHA `553daf9...`, HEAD_SHA `379cba3...`, and
HEAD_REF `epic/EPIC-006` exits 1. It permits the implementation stage, then
rejects: `intended source path config/workspace-config.yaml changed before
initial assessment evidence relative to PR base history`.

The accepted-policy setup commit `74c7c7f` precedes startingHead `a91beb9`
and the immutable assessment, but config/history are intended implementation
paths in that assessment. This is real candidate history, not a fixture.
The remote base also contains neither accepted config nor its history;
the CI fallback in `acceptedConfigAt` cannot reconstruct that base policy
from the local coordination checkout. The branch includes a linked-worktree
configuration with `worktree_overrides: []`, which cannot simply become a
coordination-root policy without its own accepted transition.

Fix: establish and independently review a concrete bootstrap baseline and
policy-provenance route that validates this immutable history in a single
checkout. Distinguish the genuinely authorized setup from implementation
using explicit, bounded evidence; do not delete intended paths, rewrite the
first assessment, invent base acceptance, or broadly exempt policy changes.
Add a regression using this actual historical shape and run the real PR
entrypoint against the real remote base before another final review.

A strictly recognized provisioning baseline could preserve the gate's intent
if it requires all of these facts together: both policy files were absent in
the PR base; only those policy paths receive special treatment; their exact
startingHead contents bind the assessment's accepted raw/effective digests,
revisions and unmodified acceptance history; root policy can be deterministically
reconstructed and its recorded digest checked; policy/history remain unchanged
after startingHead; every other intended source path still satisfies the
existing before-preflight check; and the original first assessment remains
the sole-path direct child of startingHead. Test each failed predicate and
ordinary existing-policy cases. This is a precise candidate correction for
Principal/AppSec evaluation, not advance approval of unseen implementation.

### CR-006-002 — New Tier 1 direct-merge selection is ignored

Severity: Required, P2. Location: `scripts/check-tier1.mjs:157`.

`acceptedEffectivePolicy` still derives `directMergeEnabled` exclusively
from `task_tiers.tier_1_direct_merge`. New policies cannot contain that legacy
field alongside `task_tier`/`tier_overrides`. A clean adopter with accepted
`task_tier: tier_1` and `tier_overrides: {direct_merge: true}`, valid initial
assessment, and a single low-risk implementation file therefore returns
`directMergeEligible: false` and says the policy is disabled. I reproduced
this through `createTaskAssessment` and `checkTier1` in a temporary Git repo.

Fix: resolve effective direct-merge rules through the shared tier resolver
for new policies, retain the legacy contract, and retain this template's
PR-only floor. Test omitted/false/true legacy and new selections through the
final checker, including higher tiers and the template floor. Existing
initializer and pure-resolver tests do not exercise this connection.

### CR-006-003 — Accepted autopilot overlays cannot pass final checks

Severity: Required, P1. Locations: `scripts/check-tier1.mjs:111` and
`scripts/check-tier2.mjs:133`.

The canonical resolver now accepts explicitly marked `workflow.autopilot`
worktree overrides, but both final-check overlay implementations still know
only provider and approval overrides. An accepted root with autopilot false
and accepted linked override true passes preflight; after the one-file
implementation, Tier 1 fails with `Accepted coordination config is stale or
unavailable`. I reproduced this using the existing linked fixture setup
with only the accepted workflow field/marker added. Tier 2's same missing
branch rejects the marker directly or suppresses it while looking for a
coordination candidate. Repeating preflight cannot repair this valid policy.

Fix: share the pure effective-overlay semantics between preflight and both
final checkers, including new tier equality and autopilot marker rules.
Preserve committed-base reconstruction in CI. Add linked-root and isolated
CI tests for both accepted autopilot directions and rejection of unmarked
or tier-weakening overlays.

### CR-006-004 — Postintegration adoption has no verified completion route

Severity: Required, P1. Locations: `scripts/lib/epic-integration.mjs:31`,
`scripts/lib/epic-finalization.mjs:33`, and
`project/EPIC-006-migration-rollout.md:80`.

The rollout correctly defers real policy adoption until after integration,
but the lifecycle accepts main advancement after the original implementation
merge only through status/PR-marker finalization. An ordinary independently
reviewed policy/history adoption PR changes other paths, so its integration
cannot satisfy the original epic's completion relation. The generated
adopter test migrates before constructing the implementation lifecycle;
it does not exercise the required postintegration order.

Merely deferring merged markers and revising the still-ready plan is not a
demonstrated solution: adoption after preflight invalidates accepted-policy
provenance; committing adoption before a replacement preflight conflicts
with the intended-path history check and CI's old base-policy reconstruction.
Recording a new PR as though it were the original also conflicts with the
documented preserved-original-PR contract. A new epic remains blocked until
this epic completes. These are validator constraints, not missing live
credentials or expected pending host observations.

Fix: define, independently approve, and exercise a governed release
continuation that binds policy adoption, fresh reviews, original and later
PR identities, final integrated SHA, and fresh activation/cleanup. It may
use existing stages if a complete successful trace proves them sufficient.
Do not broaden status-only finalization, waive immutable assessment checks,
mark completion under stale policy, or admit EPIC-007 early. Root-write
authorization remains a separate owner decision at execution time.

## Optional observation

`scripts/workflow-event.mjs:108` returns pre-PR local review work without a
durable role/head claim. Two valid `review.ready` events with different
delivery IDs at the same local head both return `code_reviewer`, while
`state.reviews` remains empty; I reproduced this. Hosted readiness does use
durable claims. Consider an explicit PR-less review identity and claim/ack
contract, or document the harness's durable deduplication responsibility.
The existing PR-keyed contract does not specify that local identity, so this
observation is not independently a blocking finding here.

## Five-axis assessment and verification

- Correctness: request changes for the real PR admission failure, inconsistent
  policy resolution, and incomplete release lifecycle. Tests were reviewed
  before implementation. Negative tests are substantive, but their fixtures
  omit the actual bootstrap/adoption ordering and accepted overlay combinations.
- Readability/simplicity: focused state, authorization, review, integration,
  and finalization modules are understandable. The duplicated policy-overlay
  implementations have already drifted; reuse is a concrete correctness fix.
- Architecture: locked shared runtime state and separate host observations
  are appropriate. Status-only finalization is deliberately narrow and should
  stay narrow. Release continuation needs an explicit supported relationship.
- Security: inspected input boundaries, policy provenance, runtime lock/atomic
  writes, observed identity separation, exact-head checks, trusted workflow
  execution and cleanup receipts. No secrets or new dependencies found in this
  diff. Shared Actions app identity cannot authenticate one workflow; the
  documented native independent reviews and protected paths remain essential.
  Final AppSec must review the corrected final revision after Staff approval.
- Performance: no demonstrated blocking regression. Synchronous callbacks
  under one lock are an intentional serialized contract. The host publisher
  scans open PRs and paginated evidence; deployers should monitor latency and
  API failure behavior. This review does not claim load or outage testing.

Reported full QA is 265/265 with no skips, root verification 51/51, audit zero,
and shell/whitespace checks passing. I inspected that evidence and independently
ran `node --test tests/check-tier1.test.mjs tests/workspace-config.test.mjs
tests/review-scheduling.test.mjs`: 34 passed, zero failed/skipped. I also ran
the temporary Git reproductions above. Review metadata `git diff --check` passed.
The actual candidate PR check fails despite those passing fixtures. No real
host status, review, protection, policy adoption, or activation was performed.

Release controller owns approved integration, effective root/worktree adoption,
loaded adapter/session evidence, QA-GOV-010, and owned cleanup. Repository
administrators own installed and verified native protections/role mappings.
Expected pending live release observations are not themselves a code-review
failure; the concrete admission and lifecycle gaps above are. EPIC-007 remains
blocked. Both final reviews must cover the corrected implementation revision.
