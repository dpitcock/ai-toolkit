# EPIC-006 bootstrap and release-continuation design assessment

Independent Principal: Codex `/root/bootstrap_release_design`, 2026-09-26.
Assessment covers CR-006-001 and CR-006-004 from the Staff review of
`379cba3d027b4c9c8fa2770564ff6c10c46e1ac2`; it is a design ruling, not approval
of implementation, policy acceptance, final review, host changes or activation.

## Scope ruling and authority

The correction below is a **bounded restoration of approved EPIC-006 scope**.
It does not require a new product decision or changing canonical plan revision 1.
The detailed plan's common contracts explicitly anticipated accepted bootstrap
config before implementation, committed with the epic. TASK-002 requires explicit
migration with preserved history and root authority; TASK-013 requires this
owner-approved migration; TASK-010 requires same-epic corrective PRs and verified
completion. A narrowly checked route for those existing obligations is within
the owner's recorded bootstrap-correction authorization.

This ruling is conditional on the exact restrictions below. It does not cover a
generic corrective-PR framework, arbitrary policy changes, changing role maps,
weakening review floors, altering immutable evidence, or activating before
reviewed integration. Those are outside this correction. Independent AppSec
design signoff must precede implementation. Both final implementation reviews
must subsequently cover all corrections on the same new revision.

No coordination-root write is authorized now. At release, obtain the owner's
explicit authority for the actual root adoption, citing the inspected candidate,
old/new digests and history lineage. The existing rollout's assumed root revision
2 and linked revision 3 are not valid predictions after integrating the tracked
linked configuration. Do not substitute a different base into old authority.

Sources read: AGENTS.md, docs/roles.md, docs/workflow.md, governed-plan,
appsec-gate, upstream planning-and-task-breakdown, canonical plan, detailed plan,
bootstrap correction, rollout and Staff findings. The installed upstream agents
directory has no Principal persona; this assessment uses the repository's actual
Principal role and planning contracts, without inventing a replacement persona.

## CR-006-001: recognize the actual provisioning baseline

Observed immutable history:

- PR base B: `553daf9fb49df58e55c3c5a6fbb68df6a0be0a41`; both policy paths absent.
- Provisioning P: `74c7c7f66924f43319e1850ad6728708a5adc96b`; adds only
  `config/workspace-config.yaml` and `project/workspace-config-history.jsonl`.
  Config is the accepted root policy; history has proposal then acceptance.
- Starting head S: `a91beb92f858c4be00e09f23de39de3ccee3c17f`; materializes
  approved plan/tasks and adds only the empty worktree override marker to policy,
  with an appended revision-2 change record naming that field.
- First assessment A: `2a51c8fe0a35ebe224840d702ef5ae30f271407e`, the original
  sole-path direct child of S adding
  `project/task-assessments/governance-activation.yaml` (initial Git blob
  `d4c633fc8387df67422861cb87508fa7c2af75b4`).

This recognizer is confined to `dpitcock/ai-toolkit`, `epic/EPIC-006`, canonical
`EPIC-006-PLAN` revision 1, and the exact B/P/S/A and assessment path/blob above.
Its production entrypoints must match these identities before applying any
exception. Shape-compatible history in another repository, epic, branch or new
assessment is not eligible. Do not expose an event, environment, CLI or candidate
config option that replaces these pinned identities. The historical predicates
remain mandatory after the identity check; pinned SHAs alone are not proof that
all subsequent constraints hold. Tests may use isolated clones retaining these
actual objects; generic fixtures must not enable a production allowlist escape.

Implement one pure committed-history recognizer shared by the before-preflight
check and CI accepted-policy reconstruction. Its success returns the proven
root snapshot, raw linked snapshot and two allowed provisioning paths; it never
turns absence of base policy into an assumed acceptance. Require ALL predicates:

1. Both paths are absent at B. Neither may be a symlink, submodule or executable.
2. Discover P from actual path history between B and S. P adds exactly the two
   paths, with accepted root config (no override marker) and valid history.
3. The root digest/revision at P exactly match assessment coordination provenance;
   effective digest and recorded coordination revision match too.
4. At S, raw config equals that root config plus `worktree_overrides: []` only.
   Raw digest/revision equal assessment worktree provenance. Empty markers are
   mandatory here; ordinary nonempty-overlay semantics are not a bootstrap route.
5. S history preserves P history byte-for-byte, appending exactly one valid change
   at the next revision whose only changed field is `worktree_overrides`, whose
   digest matches S and whose acceptor/reason/date are present. Validate existing
   parser/history rules and recorded root acceptance; invent no acceptance facts.
6. Policy-path history between P and S contains only that exact materialization;
   policy/history have no changes in any commit after S through candidate head,
   including edit/revert sequences. The proven snapshots must match working HEAD.
7. A retains the original sole-path/direct-parent/absence-at-S constraints. All
   original assessment fields, plan/task/branch and policy bindings stay immutable.
8. Every other intended source path retains its existing preflight-before-change
   check. The exception covers only the proven provisioning changes on two paths.

Use the returned root snapshot for isolated CI reconstruction. Do not first
trust an arbitrary registered worktree when committed bootstrap proof is needed.
Keep ordinary existing-policy PR behavior unchanged. Fail closed on ambiguous
history, unavailable objects, partially present base policy, digest mismatch,
unexpected marker or any later policy edit.

The real entrypoint regression must use this actual historical shape and the
actual B/S/A lineage in a fresh single-checkout clone. Run `check-pr.mjs` with
BASE_SHA=B, HEAD_SHA=the corrected candidate and HEAD_REF=epic/EPIC-006 before
the next final review. Fixture success alone is insufficient.

## CR-006-004: one explicit policy-adoption continuation

Do not relax `assertFinalizationSnapshots`. First complete the existing original
implementation PR and its status-only finalization PR. Introduce a separate,
non-status-mutating `policy-adoption-pr` gate. It authorizes exactly one reviewed
EPIC-006 release migration after those integrations, never new implementation.

Names used below: H0 is original submitted head, M its merge commit, F the
status-only finalization integration, H1 the adoption PR head, and I its merge
result. The original canonical plan `pr_url` always names PR0. The later PRs
have separate identities. The canonical plan remains merged throughout adoption;
its body, original review metadata, revision, tasks and assessment never change.

The adoption gate proves all of the following from trusted integrated code:

- PR0 actually merged H0 as M into canonical main. F is a proven existing
  status-only finalization of M; its plan and epic are merged and retain PR0.
- The original B/S/A assessment proof is explicitly revalidated against H0,
  including its approved plan/task binding and original accepted-policy facts.
  This check is mandatory although the assessment is absent from adoption's diff.
- The candidate root YAML is the exact reviewed
  `project/EPIC-006-root-migration.yaml` from the original reviewed integration.
  Its normalized digest is `7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd`.
  The definition, source candidate and all role/PR-only floors are unchanged.
- The complete F..H1 diff changes exactly the two policy paths, with regular
  file modes. Every intermediate commit obeys the same path restriction; reject
  hidden edit/revert implementation, new assessments, docs and plan alterations.
- Config becomes that canonical root candidate, without an override marker.
  History preserves F bytes exactly and appends one normal `change` record:
  previous revision + 1, expected digest/definition, actual accepted identity,
  date/reason, and the exact derived changed-field list. No history replacement.
- With today's lineage F contains raw linked revision 2/digest `d58b8020...`;
  canonical adoption is revision 3/digest `7911a503...`. The record explains the
  representation conversion as well as the already-approved policy migration.
- Prospective policy cannot authorize its own adoption. Governing role floors
  and authority come from the independently proven original accepted root and
  trusted F code/host mappings. Any disagreement or weaker rule fails closed.
- Separate actual independent Staff then AppSec local reviews cover H1 before
  even a draft adoption PR. Current-head native host reviews/checks are required
  again for that PR before merge; original review receipts do not satisfy them.
  A new H1 invalidates both local release reviews and hosted readiness.
- Current main/base must still be F when admitting/merging this narrow route.
  Reject concurrent main advancement or any second/corrective adoption PR until
  explicitly reconciled; this first correction need not solve arbitrary chains.

An immutable original assessment authorizes the original scoped migration work;
it is not relabeled as an assessment made under the new policy. The new gate
validates the migration as a bounded output of that work, under old authority.
It does not call the ordinary current-policy checker and suppress its failure.

## Separate validation boundaries; no CI review dependency cycle

The adoption design has three distinct entrypoints. Shared pure predicates are
reused, but evidence sources and authority are deliberately different:

1. **Committed-provenance CI validation:** `check-pr.mjs` calls the pure adoption
   snapshot/history/assessment predicate for F..H1. It obtains original PR and
   finalization identities from unchanged committed canonical markers and, when
   needed, authenticated read-only host observation, then verifies their actual
   Git objects and relations. It neither reads nor recreates the developer's
   Git-common release store. It does not require PR1's own `gates` result, PR1
   reviews or local prepublication review receipts to produce its first result.
   Its success means only that the committed candidate meets the restricted
   provenance contract; it grants neither publication nor merge permission.
2. **Local prepublication gate:** `check-gate.mjs PLAN policy-adoption-pr` is the
   controller boundary before any draft/public PR1. It requires the same pure
   candidate proof plus actual owner authority and Staff-then-AppSec H1 review
   receipts recorded by observed independent harness sessions in the locked
   runtime store. The trusted controller must supply observed identities and
   authority separately from document/event JSON. A standalone invocation without
   that context fails closed. Missing runtime state requires explicit recovery
   and review/authority reacquisition, never a fresh-clone exception. It does not
   require PR1 to exist or require a status that only PR1's CI can create.
3. **Trusted hosted merge gate:** after PR1 exists, base F's trusted enforcement
   rechecks the pure candidate contract, current open PR identity/head/base and
   old governing role policy, then fetches native current-H1 independent reviews
   and required checks (including the completed CI `gates` result). Recheck main
   F and head H1 immediately before merging. Candidate code/policy cannot supply
   its own role mappings or green snapshots. Local bootstrap coordination also
   retains its H1 prepublication evidence; published head changes invalidate it.

CI cannot authenticate that earlier local dispatch occurred, and must not claim
to do so. Authenticated CI host reads establish only observed host facts, not
missing local reviewer identity or owner authority. Caller JSON, a committed
review receipt or a source label never substitutes for either boundary. The
mandatory trusted controller enforces prepublication; native current-head host
reviews/checks and protected PR merge enforce the remote boundary. Cooperative
files alone cannot enforce an out-of-band administrator action.

Runtime lifecycle requirements below apply to the controller and completion,
not to pure CI validation. This distinction removes the fresh-checkout problem
without making missing local approvals eligible for publication or completion.

## Canonical root and clean linked representation

Add precisely one supported inherited representation: a registered linked
checkout may omit `worktree_overrides` only when its config bytes AND complete
accepted-history bytes equal the actual coordination root, whose own config
has no override marker. Both acceptances must validate, including definition
provenance. Return root effective policy and root field sources. Do not infer a
root by looking for any matching sibling; derive the registered coordination
checkout from Git-common identity. Nonidentical linked policy still requires
the existing explicit marker rules. Empty/marked overlays retain their current
semantics. Legacy acceptance normalization and digests do not change.

This canonical mirror is inheritance, not a new override or acceptance source.
It permits main and the release worktree to have the same clean tracked policy
after I. It avoids repeatedly committing linked markers back into main or
creating dirty local policy that cannot satisfy safe cleanup. Current linked
migration candidate `9d48be91...` remains historical staged material; it is not
applied in this continuation. No second, divergent revision-3 ledger is created.

## Execution trace to implement and test

These steps define the proposed executable route; the new gate/observer support
does not exist yet. Do not report this document as a successful run.

1. Implement the strict provisioning recognizer, adoption gate and canonical
   mirror under the active approved plan, serially after design AppSec signoff.
   Preserve original policy/history during this correction. Run full QA and
   obtain independent final Staff then AppSec on the corrected revision.
2. Validate and open original PR0 only after those local gates. Independently
   inspect live old-authority actor/head/check facts; merge PR0 to M. Verify M
   checks/smoke. Preserve PR0 identity permanently.
3. Use existing authenticated merged transitions and the existing status-only
   gate to merge the marker follow-up to F. Verify F checks/smoke and its proven
   relation to M. Do not combine migration with this PR.
4. Inspect the integrated candidate and current tracked raw ledger. Obtain the
   release owner's authority for the exact canonical adoption and subsequent
   coordination-root update. Safely reconcile the coordination checkout with
   integrated history without overwriting unrelated changes. Root currently
   has an unrelated deleted kickoff document; preserve it. No destructive
   cleanup or assumed clean checkout is part of this design.
5. Prepare the existing epic branch at F, with no unrelated/unpushed changes.
   Use F's integrated `init-workspace.mjs propose-change/apply-change` against
   the owned release checkout and the reviewed root candidate. The initializer
   already validates raw acceptance without requiring a usable linked overlay,
   so it can append raw revision 2 -> canonical revision 3 transactionally.
   Commit exactly the two policy paths to H1. This is staged release acceptance,
   not operational activation. Do not dispatch routine tasks from mixed policy.
6. The dedicated `policy-adoption-pr` gate validates the complete proof above
   and separate local Staff/AppSec release reviews at H1. The explicitly
   authorized bootstrap controller can coordinate these preactivation checks;
   it must not fake a successful normal `workflow-event` resolution while the
   root and staged candidate differ. Publish PR1; live host review/check gates
   use original governing authority. Recheck F/current H1 immediately before
   PR-based merge. If any policy or head differs, stop this continuation.
7. Observe PR1's actual H1 -> I merge. Verify that F..I also has exactly the
   allowed migration delta and append-only ledger; squash/rebase is allowed
   only when submitted and integrated snapshots both pass. Verify I's required
   checks/smoke and no open corrective PR. Update authorized root and owned epic
   checkout to I, preserving unrelated work. Both now carry the canonical
   accepted revision 3, with identical config/history and no marker.
8. Verify actual root and linked effective policy, load I's integrated adapter,
   revoke stale legacy permits and obtain correctly scoped current-policy
   permits from actual observed owner/session authority. Demonstrate real
   activation and QA-GOV-010; fixture results are not substituted for this.
9. Complete through the original epic identity, with original submitted H0,
   original PR0/M, final integration I, current policy/loaded revision I,
   fresh checks/smoke/docs/activation and safe owned cleanup. Admission refreshes
   the same host chain and rejects EPIC-007 until this receipt is valid.

## State, evidence and interface boundaries

Retain existing canonical plan states and original finalization relation.
Add a single bounded release record in the existing locked Git-common runtime
store, under the same epic. Fields: schema version; epic/repository/branch;
original PR/H0/M; finalization PR/F; original assessment path/commit/digest;
plan ID/revision; immutable candidate path/blob/digest/definition; old root/raw
and prospective canonical digest/revision; actual owner-authorization reference;
local release-review receipts; adoption PR/H1/I; observations and lifecycle state.
The derived original facts must agree with authenticated host and Git evidence;
caller JSON cannot choose them or mint authority. Do not put secrets in records.

Legal lifecycle: prepared -> locally-reviewed -> published -> integrated.
Preparing binds F and the exact candidate; local reviews are independently
recorded Staff then AppSec at H1. Published binds the actual live PR/H1; changed
head returns to prepared and invalidates both final release reviews. Integrated
requires fresh authenticated PR and main observations. A missing/corrupt record
blocks; explicit recovery reconstructs observable facts and reacquires any
unrecoverable reviews/authority. It never manufactures a completed state.

Completion retains `pullRequest=PR0`, `submittedHead=H0`,
`host.mergeCommit=M`, `integrationSha=I`. Add a separate typed adoption relation
containing original identity, proven M->F finalization and PR1/H1/F->I migration
proof with old/new digests and history prefix binding. Do not call the whole
M->I diff finalization. `observeEpicIntegration` reconstructs both host links,
rechecks main after collection, and returns the relation; `evaluateCompletion`
checks its shape and final policy/revision; `admitEpic` compares fresh observed
facts and rejects new open PRs or advancement. Every observation is bound to I.

Expected implementation interfaces (serial ownership; no CR-002/003 overlap):

- New `scripts/lib/bootstrap-policy.mjs`: pure historical recognition;
  `scripts/check-tier2.mjs`: consume proof for only CR-001 baseline/CI paths.
  Coordinate this file with the CR-003 implementer after their commit.
- `scripts/lib/workspace-config.mjs`: exact canonical mirror in actual root /
  linked resolution; share pure no-override equality semantics with final checks.
  Existing marked-overlay resolution remains owned by the CR-003 correction.
- New `scripts/lib/epic-policy-adoption.mjs`: snapshot/provenance predicates,
  bounded local gate, release-record validation and authenticated host relation.
- `scripts/check-gate.mjs` and `scripts/check-pr.mjs`: distinct adoption action
  before ordinary merged-plan finalization selection; always revalidate original
  assessment, even with no assessment path changed. Do not reopen merged plans.
- `scripts/lib/workflow-state.mjs`: validate release record; reuse existing lock.
  Pre-activation operations use the bounded bootstrap controller, not a new
  general policy-resolution escape in `workflow-event.mjs`.
- `scripts/lib/epic-integration.mjs`, `scripts/lib/epic-completion.mjs`: separate
  adoption relation and fresh admission proof. `scripts/workflow-event.mjs` only
  needs final completion observations/schema compatibility at active policy I.
- Existing `check-host-reviews.mjs` exact-head evaluator is reused unchanged
  where possible; if CLI discovery rejects this named stage, add only explicit
  stage routing, with trusted F code/old roles and independent current-head reviews.
- Tests: bootstrap history, workspace config, gates/PR entrypoint, policy adoption,
  completion/integration and generated adopter lifecycle. Documentation: revise
  rollout commands, workflow/gate representation and completion guidance.

## Required negative evidence before approval

For CR-001, independently falsify each of predicates 1-8, including partial base
presence, altered/forged acceptance, nonempty marker, wrong digest/revision,
history truncation, later edit/revert, another preflight source change, changed
assessment and non-sole assessment commit. Reject identical-shaped history with
different repository/epic/branch/B/P/S/A/assessment identities. Preserve ordinary
existing-policy regressions; no broader bootstrap recognition is authorized.

For mirrors, test clean identical root/linked acceptance success; deny different
config bytes, different history/acceptor, stale definition, unregistered checkout,
noncanonical root, missing history and unmarked drift. Test ordinary marked
overlays and both autopilot directions retain their accepted semantics.

For adoption, deny a changed candidate/digest, different migration field or
role, missing original assessment, old-snapshot substitution, modified preflight,
rewritten/history-forked ledger, extra source/metadata path, edit/revert, wrong
original PR, finalization bypass, wrong branch/base, direct push, unmerged PR,
second adoption, root-write authority absent, stale local review, wrong actor,
dismissed/wrong-head host review, pending/untrusted checks and main/head races.
Do not allow PR0 reviews to approve PR1. Existing finalization must still reject
policy changes, and ordinary assessment validation must still reject migration.
Run CI successfully in an isolated checkout with no release runtime store and
no existing PR1 check/review results, while proving local prepublication fails
without observed authority or runtime reviews and hosted merge fails until
current-H1 required checks/reviews exist. CI success cannot satisfy those gates.

One generated end-to-end test must run the real entrypoints in the order
B/P/S/A -> implementation PR -> M -> marker PR -> F -> policy PR -> I ->
canonical mirror resolution -> activation evidence -> completion/admission.
Keep restart/missing state/open-corrective PR/current-main changes fail-closed.
Exercise both submitted and integrated snapshot checks under squash/rebase.
This fixture is required development evidence, never live release evidence.

The only owner decision deferred to execution is the explicit authorized root
adoption/update using the corrected concrete lineage. No additional product
scope question is needed for implementing this restricted repair after AppSec
design signoff. If implementation cannot satisfy this complete trace, retain
CR-006-004 open and return for design reassessment; do not weaken a predicate.

## Additional activation trace audit: post-adoption release verification

Principal addendum, 2026-09-26, `/root/bootstrap_release_design`.
This capability requires new independent QA and AppSec design assessment before
implementation. Earlier design signoff does not approve this addendum.

The preceding trace stops short of proving QA-GOV-010. Its adoption-PR activity
occurs before I; successful completion after I does not prove active-policy
routine commits/pushes, readiness or review claims. Bootstrap coordination and
legacy `autopilot-policy-required` denials remain evidence of bootstrap only.
Do not reopen completed tasks or let `task.dispatch` accept a merged plan.

Principal ruling: the finite release verification below is **bounded restoration
of the approved QA-GOV-010 and release-documentation obligations**, not new
product scope. The detailed plan explicitly requires real release observations
outside implementation tasks. `docs/verification.md` currently states activation
and QA-GOV-010 are pending. Replacing those statements with verified evidence is
needed deliverable work. This ruling does not authorize an arbitrary task,
disposable test PR, manufactured bug or generic corrective-PR framework.

No new product-owner choice is required for this restricted capability. Actual
root adoption still requires the explicit release authority described above.
Independent QA must determine whether the real evidence-update trace below meets
the unchanged QA bar; independent AppSec must approve its authority boundaries.
Until both decisions are recorded, this is a concrete proposal, not permission
to implement the additional stage or claim QA-GOV-010 passed.

### Exact finite work and integration

After verified adoption integration I, create one same-epic release verification
record for `activation-evidence`. Bind repository, EPIC-006, original PR0/H0/M,
finalization F, adoption PR1/H1/I, policy digest, original immutable assessment
identity and the owner-authorized release scope. The canonical plan stays merged.
Neither admission nor `task.dispatch` is relaxed.

Only these two deliverable paths may change relative to I:

- `project/EPIC-006-activation-evidence.json`: one bounded, versioned report of
  actual release observations. Required identity fields are epic, repository,
  activation base I, observed loaded revision, effective policy digest and
  observation records with kind, time and evidence references. Allow only named
  activation, smoke, restart/admission, routine-action, readiness/claim/ack and
  host-review/check observation kinds. Reject unknown fields, executable content
  interfaces, unbounded strings/arrays, alternate path references and symlinks.
  This report is evidence for review, never authority or a green-check source.
- `docs/verification.md`: only the EPIC-006 activation block delimited by fixed
  markers installed with this correction before original implementation review.
  Preserve all bytes outside the block. Render the block deterministically from
  the validated report; it must distinguish observed, pending and not-exercised
  facts and link the report. Never broadly permit this document to carry code.

For every commit between I and the release head, reject other paths, mode
changes, source/policy/plan/task/assessment edits, hidden edit/revert changes and
unrelated merges. Root and worktree accepted policy/history remain exact mirrors.
The original immutable assessment is explicitly checked again; no new assessment
is invented for completed-task dispatch. Scope derives from approved release
work and this integrated gate, not from the report's claims.

Introduce `release.verify` as a bounded adapter event with an enumerated
operation `prepare`, `commit` or `push`. It uses the ordinary current-policy
resolver and `decideAction`, observed harness identity, locked permits/state and
deduplicated delivery IDs. Require EPIC-006's verified I relation, the named
release record, current policy and internally observed branch/head/diff. The
event returns a scoped decision for the harness; it runs no caller command and
grants no new tool permission. Missing policy, stale permit or another epic fails.
The initial positive decision must be `authorized-routine` under the active
policy, not a bootstrap override or replay of a legacy denial.

Extend `review.ready` and `merge.eligible` only for this registered verification
record. Resolve its own current open PR2/head from authenticated host facts,
never use PR0 as its publication PR or pretend policy adoption is finalization.
Preserve exact-head role gates and existing claim/ack/reconciliation semantics.
Local prepublication review and later publication of its verdict are distinct
operations; do not dispatch a second review merely to publish the same verdict.
Persist local role/head review identity before dispatch, then bind the observed
PR2 identity for hosted publication claims. Uncertain dispatch must reconcile.

Release verification states are prepared -> active -> local-review-ready ->
locally-reviewed -> published -> integrated. Active supports authorized report commits and
pushes without routine human/Staff authorization. A push invalidates previous
head readiness and final release reviews; it never launches reviewers. A changed
published head stays on PR2, returns review eligibility to active, and requires
independent Staff then AppSec final review again on the new head. No local
approval can be supplied by the developer or by merely editing the report.

The same three evidence boundaries apply: CI runs pure committed-provenance
checks without requiring its own result or local runtime; the observed controller
enforces local reviews before publication; trusted integrated host enforcement
requires live current-head independent roles and checks before merge. Do not
require all post-merge facts before opening this evidence PR: initial reports
may truthfully mark future observations pending. Before merge, every pre-merge
QA-GOV-010 obligation must be observed and independently accepted; only actual
final integration, revalidation and cleanup remain later release observations.

### Actual-session observation sequence

1. Load verified I in the actual session, resolve identical accepted policy in
   root/worktree, and bind a genuine current-policy release permit. Record the
   successful `release.verify prepare` decision and loaded revision/digest.
2. Record real activation observations in the report; authorize, commit and push
   them. Independently collect the existing smoke/restart/admission observations,
   then authorize, commit and push that second useful evidence increment. Record
   both actual Git heads, push results and zero pre-readiness review dispatches.
   Do not split an empty/artificial change just to increase the counter.
3. At readiness, dispatch each independently assigned role once for the actual
   eligible head, persist claim/ack identity and reconcile uncertainty. Obtain
   Staff then AppSec before PR2 publication, and publish verified verdicts against
  the actual PR2 head. Observe real current-head checks and host reviews.
   Local readiness must be explicitly recorded before any pre-PR reviewer
   dispatch, with the release identity and head, never an invented PR number.
   Hosted publication readiness is separate and uses the actual PR2 identity.
   Verify zero pre-readiness dispatches at both boundaries. Before the first
   local readiness, require at least two nonempty, independently meaningful
   commits and pushes under actual active authorization; no empty counter work.
4. Newly available host/readiness/dedup facts now replace genuine pending report
   entries on the same open PR2. An independent reviewer must identify the actual
   required completion/correction before merge; the pending report must not have
   been claimed complete. Authorize this necessary evidence correction,
   commit/push, invalidate stale readiness, and obtain fresh required reviews for
   the resulting head. Do not manufacture a bug or intentionally inaccurate
   report. The transcript must describe evidence corrections, not claim a code
   defect was observed when none was. Record actual commit/push, confirmation,
   routine Staff-authorization, review dispatch and claim/ack counts and IDs;
   required final Code Reviewer work is distinct from routine Staff authorization.
   QA must explicitly assess this same-PR evidence-correction trace against the
   acceptance requirement.
5. Merge the fully observed, reviewed PR2 to J through current-head gates. Add a
   separate typed `releaseVerification` relation proving PR2's submitted head
   and I->J evidence-only diff, actual merged host identity and unchanged policy.
   Support squash/rebase through both submitted and integrated snapshot checks.
   Reject arbitrary main advancement or another release-verification PR.
6. Reload J, rerun current checks/smoke and revalidate real activation under the
   unchanged accepted policy. Persist J-bound activation, cleanup and admission
   observations in the locked runtime store. The report describes actual I-stage
   observations; it does not need a commit that names its own future merge SHA.
   Completion now binds J while preserving PR0/M, F and adoption I as distinct
   verified links. EPIC-007 stays blocked until that current receipt passes.

This sequence supersedes the earlier trace's direct I-to-completion shortcut.
It adds one useful reviewed documentation/evidence PR and one narrowly checked
integration relation; it does not broaden status-only finalization or migration.
Extend the adoption/completion helpers and adapter stage routing accordingly.
Keep the report schema/renderer pure and the runtime/host observers authoritative.
Test real entrypoints in order through I, both active release actions, PR2 head
changes and J; test missing actor/permit, early/double review, stale head, extra
paths, dishonest/unavailable observations, wrong PR, direct push, missing local
state, policy drift and premature admission. Fixture success is not live QA.
