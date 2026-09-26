# EPIC-006 bounded policy-adoption correction

This implements the approved CR006004 POLICY-ADOPTION design through adopted
integration I. It does not implement release.verify, the finite release report,
J, actual activation, or epic completion. Original plan revision 1, immutable
assessment A, and original PR0 markers remain unchanged. Staff findings remain
open until independent final review on the eventual complete implementation.

## Implementation boundary

The original bootstrap recognizer revalidates pinned B/P/S/A and original H0,
even when the assessment is unchanged in the adoption diff. Original H0/M and
status-only M/F remain separate relations. `assertFinalizationSnapshots` is
unchanged. F must contain both merged markers retaining PR0.

The approved root candidate with digest
`7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd`
is the only candidate. F/H1 and F/I must change exactly the two regular policy
files. Every intermediate commit is restricted to those paths and regular file
modes; hidden source/document/assessment edit-and-revert commits fail. The
candidate and exact one-record ledger-append contract are checked at the final
snapshots; this is not a claim that intermediate edits confined to those two
policy files are independently rejected when their final result is valid.

Raw revision 2 becomes canonical revision 3 under the future actual owner's
decision. The earlier root-2/linked-3 sequence is superseded. Historical candidate
files remain intact; the linked candidate is unused. Exact canonical-mirror
inheritance was delivered separately at `610b025`; the adopted H1 release
checkout need not mirror the still-old coordination root before authorized
reconciliation.

The initializer now transactionally preserves validated candidate text instead
of serializing it again. Its persistent advisory lock has an exact ignore rule;
the lock is never unlinked to make a worktree appear clean.

## APIs and records for the next serial worker

`scripts/lib/epic-policy-adoption.mjs` exports:

- `policyAdoptionStage({root,baseSha})`: trusted-base stage discovery, never authority.
- `materializePolicyAdoptionHistory({root,baseSha,headSha,api})`: materializes only
  observed immutable objects from the fixed canonical public repository, needed
  when a fresh clone lacks squashed H0. It does not checkout or execute them.
- `provePolicyAdoption({root,baseSha,headSha,headRef,api,integration})`: provenance
  without runtime state or adoption PR's own unfinished checks. Optional
  `integration:{pr,sha}` proves both submitted and integrated policy deltas.
- `evaluatePolicyAdoptionHostGate(...)` and `trustedPolicyAdoptionGate(...)`:
  trusted F independently checks old authority, candidate, main, exact head,
  native reviews/checks and races. Candidate status/branch cannot choose a weaker
  stage. The write-token workflow never checks out or executes candidate code.
- `controlPolicyAdoption({root,operation,actor,observers,baseSha,headSha,integration})`:
  operations `prepare`, `recover`, `review`, `gate`, `publish`, `integrate`.
  It observes publication/integration; it does not create or merge a PR.

The typed relation has `kind:'epic-policy-adoption'`, version 1, pinned
epic/repository/branch, and `original`, `finalization`, `assessment`, `plan`,
`candidate`, `policy`, `adoption`. The final member binds F/H1 and optional PR1/I.
`validateAdoptionRelation` and `validateAdoptionRecord` live in
`scripts/lib/policy-adoption-record.mjs`.

Runtime state uses the existing Git-common lock and atomic writer under
`epics['EPIC-006'].policyAdoption`. Its exact members are `version`, `phase`,
`proof`, `owner`, `developer`, `developerSession`, `reviews`, `lastReview`,
`publishedPr`, `observedAt`. Phases are prepared, locally-reviewed, published,
integrated. Actual out-of-band owner/harness context and separate observed Staff
then AppSec sessions are required. Identity relabeling/session reuse fails.
Changed heads and fresh adverse verdicts invalidate both reviews. Standalone
`policy-adoption-pr` fails without the controller context; CLI/CI cannot mint it.

## Verification evidence

Source commit: `a6e851920a27abf85036ee2db7c841730a3fde00`.
Controlled host/API/fetch transports in fixtures are test observations, not actual
GitHub authorization, reviews, or release evidence.

Completed checks, with snapshot boundaries preserved:

- `node --test --test-concurrency=2 tests/epic-policy-adoption.test.mjs tests/init-workspace.test.mjs tests/host-review-events.test.mjs tests/lifecycle-finalization.test.mjs tests/workflow-state.test.mjs tests/bootstrap-policy.test.mjs tests/gates.test.mjs`:
  183/183 passed in the earlier implementation snapshot. That run preceded the
  last selector, object-materialization and historical-fixture corrections; it
  is regression evidence, not a claim about the final exact source revision.
- Adoption suite after materialization: 23/23 passed. Targeted final CI selector
  and fresh non-local materialization cases: 2/2 passed.
- `node --test --test-concurrency=2 tests/epic-policy-adoption.test.mjs tests/bootstrap-policy.test.mjs`:
  80/80 passed after historical fixture pinning, including nested current-source
  execution at status-finalized and adopted snapshots. The dedicated final
  fixture uses a distinct synthetic squash I with the accepted H1 tree.
- Fresh single-checkout clone of the exact source commit, executing its own
  `scripts/check-pr.mjs` with
  `BASE_SHA=553daf9fb49df58e55c3c5a6fbb68df6a0be0a41`,
  `HEAD_SHA=a6e851920a27abf85036ee2db7c841730a3fde00`, and
  `HEAD_REF=epic/EPIC-006`: exit 0, `implementation-pr permitted` and immutable
  assessment `Tier 3 epic-gate-required`. This separately verifies the actual
  current implementation candidate, including the new ignore rule/modules;
  it is not the pinned historical-positive fixture.
- From that same committed fresh clone,
  `node --test --test-name-pattern='historical bootstrap and adoption fixtures' tests/epic-policy-adoption.test.mjs`:
  1/1 passed, including the two nested historical checks at each of F and the
  distinct synthetic squash I. The initializer/ignore rule came from the
  committed source; its own fixture asserts only config/history are changed and
  the worktree is clean after their scoped commit.
- `git diff --check` passed before source commit.

Historical fixture tests require the real pinned Git objects to be available.
The ancestry-preserving original merge retains them. The separate fresh
non-local-clone materialization test proves the production missing-H0 wrapper;
it does not claim that `npm test` itself authenticates/fetches missing historical
fixture objects before the later workflow `check-pr` step.
CR004 remains open; pre-test historical-object preparation for an ancestry-
discarding merge remains an integration obligation for the next serial worker
and final QA. This evidence does not claim whole-workflow squash support.

Transient macOS subprocess startup delays occurred during verification. A
one-second sample of the later running test worker showed an initialized Node
waiting in synchronous subprocess polling, with subsequent initializer progress;
that particular wait was not independently proven to be a loader stall. No
passing assertion was substituted for an unavailable observation.

RED observations included missing bounded proof/controller/host APIs, initializer
loss of candidate formatting, stale readiness after an adverse verdict, candidate
stage/branch fallback, missing immutable-object materialization, and historical
fixtures seeded from released HEAD. The historical fixtures now retain pinned
real Git objects at `b2b742b` while executing current source modules/entrypoints.
Actual current candidate admission against B is verified separately before PR0.

The next worker must consume the typed I relation for the separately approved
finite release.verify/J stage; it must not stretch status-only M/F finalization
into a whole M/I proof or treat I alone as completion. See the approved release
design, independent AppSec review and QA trace for that remaining contract.
