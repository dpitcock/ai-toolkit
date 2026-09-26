# EPIC-006 governance activation implementation plan

Detailed-plan revision 2, 2026-09-26; incorporates initial Principal/QA/AppSec
findings. No specialist approval is inferred from the owner's design approval.

Use governed-build with Superpowers subagent-driven-development, one task at a
time in the isolated epic worktree. This is the detailed initial plan; copy its
task contracts into canonical `epics/EPIC-006/tasks/TASK-NNN.md` records before
implementation. Spec: `project/governance-first-proposal.md`.

Goal: activate faster routine work without weakening merge or completion gates.
Stack: Node >=22, existing YAML and fs-ext dependencies; no new service.
Architecture: pure policy functions, a locked local state store, explicit CLI
events, and existing stdio MCP transports. Local evidence is cooperative;
GitHub actor/commit checks and protected host policy supply the remote boundary.

## Common contracts

- Existing policy hashes/history remain valid. New policy acceptance binds the
  shared definition digest. Never rewrite historic approvals or claim migration
  acceptance from defaults alone. The owner approved the explicit migration.
- Root config is authoritative; marked worktree overrides are field-specific.
  Preflight/final gates use the same effective tier resolver and provenance.
- Runtime state lives under the Git common directory, outside tracked content;
  use an advisory lock, atomic replacement, schema validation, and bounded input.
  Repository identity is derived from the checkout, never a caller-selected path.
- External delivery is not atomically coupled to local disk. Persist claims
  before dispatch, acknowledge afterward, and reconcile uncertain outcomes;
  never promise exactly-once external delivery or automatically repeat a claim
  after a crash. Stale-head responses do not satisfy a newer merge gate.
- Current-head reviews come from GitHub, not copied markdown or Slack. Persist
  receipts outside Git to avoid commits invalidating the approval they record.
- User-approved initial plan PR is documentation-only; actual config acceptance
  is recorded locally before implementation and committed with the governed
  epic. This avoids changing CI merely to admit its own bootstrap plan.
- Required roles: Principal plan signoff, QA requirements, independent final
  Code Reviewer and AppSec; existing conditional accessibility floors persist.
  Principal is not inferred from gh-identity's general reviewer identity.
- Existing reviewers handle this epic. Later bot enhancements are not needed
  to enforce current-head approval or finish EPIC-006.
- Security mapping: SEC-GOV-001 policy provenance → 001/002/003/014/004/006;
  SEC-GOV-002 host evidence → 008/009; SEC-GOV-003 trusted enforcement →
  009/012/015; SEC-GOV-004 durable state → 005/007/011;
  SEC-GOV-005 actor authority → 006/011; SEC-GOV-006 completion → 010/011.
  All six concerns are touched; none is waived. Auth/data/external boundaries
  are true because authority records and external GitHub state are consumed.
  UI is false; existing accessibility gate regression coverage remains required.
- EPIC-006 bootstrap merge uses existing host policy plus an
  independent pre-merge check of live actor/head/review state under the existing
  accepted policy. Candidate scripts or modified role maps are never proof of
  their own eligibility. Record this check's identity/date/head/host receipts.
  New policy becomes active only after approved merge and verification.
  Live discovery on 2026-09-26 found no main branch protection or repository
  rulesets. Therefore do not claim server-enforced protection during bootstrap.
  TASK-015/release must install and verify required checks and PR-only main
  protection before activation; independent authenticated pre-merge inspection
  remains the bootstrap verification path outside candidate-controlled code.

## Execution and evidence

For every task: add its named regression test, run the focused command and
record the actual RED failure, implement, run GREEN and applicable regression
checks, then commit that task separately. Commit task evidence afterward and
transition statuses only through check-gate. No formal per-task review.
Tasks run serially in this explicit order:
000 → 001 → 002 → 003 → 014 → 004 → 005 → 006 → 007 → 008 → 009 →
010 → 011 → 012 → 015 → 016 → 013. Each depends on the preceding task in
that order, not numeric ordering. Paths are relative
to the epic worktree. Use canonical task numbers exactly as listed.

## Task contracts

### TASK-000 — Isolate generated adopter policy state

Files: `tests/scaffold.test.mjs`.
The baseline has three failures because fixtures copy workspace-specific
acceptance history while omitting its config. Exclude the current instance's
config history/transaction/lock and assessments from generated adopter seeds;
preserve templates and generate each adopter's own accepted fixture policy.
RED/GREEN: `node --test tests/scaffold.test.mjs`.
Assert fresh initialization and both proportional routes from independent
adopter state. QA-GOV-003/009; preserve all existing assertions.

### TASK-001 — Shared tier definitions

Files: create `policy/task-tier-defaults.yaml`,
`scripts/lib/tier-defaults.mjs`, `tests/tier-defaults.test.mjs`.
Interface: `resolveTierDefaults({tier,overrides,templateRepository})` returns
validated effective rules plus definition version/digest and field sources.
Only `direct_merge` is initially overridable. Default direct merge stays false
for compatibility; eligible adopters may explicitly request true only at Tier 1.
Tier 2/3 require PRs; Tier 3 requires isolation and independent final review.
RED/GREEN: `node --test tests/tier-defaults.test.mjs`.
Assertions: unknown tier/key/type fails; stricter floors cannot be relaxed;
definition changes change the digest; false applies to every selected tier.

### TASK-002 — Workspace tier selection and migration

Files: `scripts/lib/workspace-config.mjs`, `scripts/lib/workspace-history.mjs`,
`scripts/init-workspace.mjs`, `tests/workspace-config.test.mjs`,
`tests/init-workspace.test.mjs`.
Accept `task_tier` and `tier_overrides` without injecting new fields into legacy
normalization. New records bind definition provenance; old digests still verify.
Resolve the configured minimum and reject competing old/new declarations.
Use existing propose/apply-change paths for migration, preserving owner names.
RED/GREEN: `node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs`.
Assertions: legacy digest fixtures unchanged, migration requires accepted
candidate, invalid/stale definition rejected, worktree weakening rejected.

### TASK-003 — Effective tier throughout checks

Files: `scripts/lib/task-tier.mjs`, `scripts/lib/task-assessment.mjs`,
`tests/task-tier.test.mjs`, `tests/preflight.test.mjs`.
Select max(configured minimum, risk result, earlier preflight tier) and record
definition/provenance in new assessments. Do not trust claimed tier alone.
RED/GREEN: `node --test tests/task-tier.test.mjs tests/preflight.test.mjs`.
Assertions: Tier 1 config plus auth change becomes Tier 3; stricter workspace
minimum survives low-risk answers; stale provenance and final downgrade fail.

### TASK-014 — Reconstruct tier policy in final checks

Files: `scripts/check-tier1.mjs`, `scripts/check-tier2.mjs`,
`tests/check-tier1.test.mjs`, `tests/check-tier2.test.mjs`.
Consume the resolver and assessment provenance from TASK-003. Reconstruct
effective tier from committed accepted policy and actual diff; legacy evidence
still validates by its original contract. New evidence cannot weaken floors.
RED/GREEN: `node --test tests/check-tier1.test.mjs tests/check-tier2.test.mjs`.
Assertions: stale definition, forged tier, root/worktree weakening and scope
expansion fail; higher preflight tier persists. QA-GOV-001/002/003.

### TASK-004 — Owner-controlled autopilot config

Files: `scripts/lib/workspace-config.mjs`, `scripts/init-workspace.mjs`,
`tests/workspace-config.test.mjs`, `tests/init-workspace.test.mjs`.
Add boolean `workflow.autopilot` with field-specific source resolution.
New proposals default true; legacy omission preserves legacy checkpoint
behavior until explicit acceptance. Root/worktree changes use owner evidence.
RED/GREEN: `node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs`.
Assertions: false is retained, omission is distinct, override provenance is
reported, agents cannot supply owner acceptance by a delegated decision.

### TASK-005 — Durable workflow state

Files: create `scripts/lib/workflow-state.mjs`, `tests/workflow-state.test.mjs`.
Interface: `withWorkflowState(root,mutate)` locks repository-local shared state,
validates its version, invokes one synchronous mutation, persists atomically,
then unlocks. Store authorization, dispatch, review, and epic records separately.
RED/GREEN: `node --test tests/workflow-state.test.mjs`.
Assertions: concurrent writers preserve both updates, interrupted writes retain
last valid state, malformed/symlinked state fails, linked worktrees share state.

### TASK-006 — Scoped routine authorization

Files: create `scripts/lib/workflow-authorization.mjs`,
`tests/workflow-authorization.test.mjs`.
Interface: `decideAction({authorization,action,policy,actor})` returns continue,
delegate, or human-needed with reason. Bind authorization to repository,
branch, scope, allowed actions, and completion criteria. Owner decisions may
authorize a specific otherwise restricted action; routine authority cannot.
Bind accepted effective policy digest/definition version and root/worktree
acceptance references. Actor/owner authority comes from the trusted harness
session, never from an event's self-declared actor string. Raw CLI records are
cooperative evidence only; they cannot authenticate or elevate an owner.
RED/GREEN: `node --test tests/workflow-authorization.test.mjs`.
Assertions: routine autopilot creates no action item; disabled mode delegates;
self-authorization, scope expansion, new access/cost/deploy/destruction fail
without covering owner authority. Tool permissions remain independently enforced.
Assert stale policy/authorization blocks only affected actions in both modes;
other existing authorized actions remain available. QA-GOV-004.

### TASK-007 — Review readiness and durable claims

Files: create `scripts/lib/review-scheduling.mjs`,
`tests/review-scheduling.test.mjs`.
Interface: `applyReviewEvent(state,event)` accepts ready, push, claim, ack,
and reconcile events. Key by repository, PR, role, head. Push clears readiness
for the old head without launching reviewers. Reconcile ambiguous dispatch
using observed external identity/commit before any retry.
Each claim has a generated immutable claim ID and legal transitions queued →
claimed → acknowledged or uncertain; uncertain → reconciled only with observed
external operation ID/role/head matching that claim. Replayed/wrong-ID ack
fails. Missing/corrupt state blocks progression, never implies completion.
RED/GREEN: `node --test tests/review-scheduling.test.mjs`.
Assertions: zero dispatch on pushes, duplicates have one claim, parallel claims
serialize, crash leaves uncertain claim, old-head ack cannot approve new head.

### TASK-008 — Host review evidence

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

### TASK-009 — Plan and merge state transitions

Files: `scripts/check-gate.mjs`, `scripts/check-pr.mjs`,
`tests/gates.test.mjs`, `tests/task-assessment.test.mjs`.
Introduce explicit plan-stage and implementation-stage gate behavior. Opening
or updating an implementation PR does not require finished final review;
merging still requires complete tasks/QA and fresh required host approvals.
Retain compatibility for historic plans and immutable preflight bindings.
Ordinary plan edits do not create another initial plan PR. Material scope
changes still reconcile affected authorization, assessments, and required gates.
RED/GREEN: `node --test tests/gates.test.mjs tests/task-assessment.test.mjs`.
Assertions: plan PR cannot contain source, plan verdict cannot satisfy code
review, approval metadata never creates a head-chasing loop, missing final
AppSec blocks merge, task completion still requires only task evidence.
Old metadata-only commit exemptions and historic evidence never satisfy the
new exact-current-head live merge gate. QA-GOV-005/006.

### TASK-010 — Epic completion and sequential admission

Files: create `scripts/lib/epic-completion.mjs`,
`tests/epic-completion.test.mjs`.
Interface: `evaluateCompletion(evidence)` and `admitEpic(state,nextEpic)`.
Require remote-main merge result, current integrated checks/smoke evidence,
resolved epic debt/findings, current documentation, safe cleanup, and active
agent-path adoption. Evidence distinguishes submitted head and integration SHA.
Typed receipts bind repository, epic, PR, integration SHA, check IDs/results,
smoke revision, policy digest and loaded revision, plus observation time and
source. Fetch merge/check facts from the authenticated host at admission;
arbitrary all-green JSON cannot authorize next-epic start. Harness/session
observations supply actual activation and cleanup evidence with resource IDs.
Cleanup ownership must identify registered worktrees/branches/processes,
containment, clean status and pushed changes; reject repo root, other owners,
symlink escapes and forced cleanup. Revalidate deferred actions immediately
before execution. A new corrective PR or changed integrated state invalidates
earlier completion. Deleted state requires explicit recovery, not fresh success.
RED/GREEN: `node --test tests/epic-completion.test.mjs`.
Assertions: squash/rebase allowed; unavailable/pending checks, intermediate
merge, incomplete cleanup/activation, unresolved findings and restart fail.
Corrective PRs keep the same epic active. Legacy merged epics receive an
explicit historical baseline, not fabricated verification evidence.

### TASK-011 — Agent execution entrypoint

Files: create `scripts/workflow-event.mjs`, `tests/workflow-event.test.mjs`;
modify `scripts/new-epic.sh`, `scripts/preflight.mjs`.
CLI: `node scripts/workflow-event.mjs EVENT --root PATH` with bounded JSON stdin.
Resolve policy and repo identity internally, lock state, validate the event,
and emit a structured action for the harness. Wire epic start, task dispatch,
review readiness, merge eligibility and completion to the same policy core.
Do not execute caller-provided shell commands or mint credentials.
Events may reference authorization IDs but cannot establish actor identity,
owner acceptance, or reviewer independence. The harness supplies its assigned
actor and existing authority reference; recheck branch/worktree registration,
canonical repository, scope, policy digest, and identity on each invocation.
RED/GREEN: `node --test tests/workflow-event.test.mjs tests/preflight.test.mjs`.
Assertions: end-to-end routine sequence in both modes, mismatched branch/repo,
duplicate delivery, concurrent epic start, missing completion fail closed.

### TASK-012 — Adapter and host integration

Files: `AGENTS.md`, `CLAUDE.md`, `.clinerules/00-governance.md`,
`skills/governed-plan/SKILL.md`, `skills/governed-build/SKILL.md`,
`skills/governed-ship/SKILL.md`.
Require executable event checks at agent dispatch boundaries; preserve native
host protections and tool-specific limits. Tests/pushes never launch reviews.
Use Agent Alert for authorized agent messaging and gh-identity for completed
independent verdicts. A Slack message/prefix is never an approval credential.
Verify these reversible guidance edits against the executable entrypoint tests
from TASK-011; document a fresh session invoking the gate before dispatch.

### TASK-015 — Trusted host revalidation events

Files: `.github/workflows/workflow.yml`, create
`.github/workflows/review-gates.yml`, `tests/host-review-events.test.mjs`;
modify `scripts/check-host-reviews.mjs`.
Re-evaluate the same PR head after approval, dismissal, request-changes and
synchronize events without starting reviewers or creating commits. Publish a
stable required status bound to that exact head. Run trusted base-branch gate
code and accepted policy; never execute PR-controlled code with write tokens.
Use only scoped status-write permission, read-only repository/PR access, and
existing host protections. Candidate changes cannot weaken their own merge bar.
Bootstrap uses existing host checks and independent reviewers. Install and
verify PR-only main protection and required gate statuses once the trusted
workflow is integrated; do not complete activation while this is unavailable.
Use the current repository-admin connection without requesting new secrets.
RED/GREEN: `node --test tests/host-review-events.test.mjs tests/review-evidence.test.mjs`.
Assertions: out-of-order/duplicate events, head race, approval then dismissal,
PR-modified gate/config, missing status and identity mismatch fail closed.
QA-GOV-005/006/007/009.

### TASK-016 — Workflow documentation and scaffold packaging

Files: `docs/workflow.md`, `docs/roles.md`, `docs/gates.md`,
`docs/slack-control-plane.md`, `docs/agent-details/AGENT-TESTING.md`,
`tests/scaffold.test.mjs`.
Document authoritative versus cooperative evidence, event commands, migration,
new stage boundaries, and transport limitations. Package shared policy assets
in generated adopters; preserve UI review floors and conditional Cline handoffs.
RED/GREEN: `node --test tests/scaffold.test.mjs` for packaged-policy and
real entrypoint invocation assertions; documentation checks are supplementary.
QA-GOV-009.

### TASK-013 — Migration and adopter verification

Files: `tests/scaffold.test.mjs`, `docs/verification.md`,
`epics/EPIC-006/epic-plan.md`, accepted config/history and task records.
Exercise a generated adopter from old config through explicit migration and
the complete new workflow. Apply the owner's approved config migration using
the existing transaction flow once supported; inspect the exact changed fields.
Run `npm test` and record local migration/scaffold evidence. This implementation
task ends before final review, merge, activation, or cleanup. QA-GOV-001..009.

## Release and completion phase (outside implementation tasks)

After all tasks and full QA, obtain independent staff then AppSec final reviews,
merge the implementation PR through existing host protections, and verify
remote main plus integrated required checks/smoke results. Record the actual
session's effective policy digest and loaded integrated revision. Demonstrate
multiple authorized commits/pushes with zero routine human confirmations or
unnecessary Staff calls, zero review dispatches before readiness, one eligible
dispatch per role/head afterward, and fixes reusing the same PR. Use real
session/host receipts distinct from fixture tests. These observations can be
collected during implementation once the entrypoint is active and finalized
against integrated main. Stop only owned processes, preserve other worktrees,
and persist completed safe cleanup. Show restart-safe next-epic denial until
the completion gate passes. Do not start EPIC-007 earlier. QA-GOV-010.

QA mapping: TASK-001/002/003/014 cover QA-GOV-001..003; TASK-004/006 cover
004; TASK-008/009/015 cover 005/006; TASK-005/007 cover 007; TASK-010/011
cover 008; TASK-000/012/016/013 cover 009; release acceptance covers 010.

## Review focus

1. Migrating hashes must not retroactively invalidate old accepted history (002).
2. A crash between external submission and acknowledgement must not duplicate
   reviews or count an unverified result (005, 007, 008).
3. Plan approval cannot substitute for current-head implementation approval (009).
4. A successful merge with pending main CI or dirty cleanup cannot release
   the next epic; both autopilot modes and restarts behave alike (010, 011).
5. Local JSON and bot display names are cooperative evidence, never proof of
   authenticated authority; host actor/commit checks remain required (008, 012).
