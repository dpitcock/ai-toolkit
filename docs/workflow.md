# Project lifecycle

This repository turns a project goal into independently reviewable epics. The EM owns scope and assignment, the Principal owns technical coherence, QA defines evidence, and AppSec participates at three distinct points. Developers own implementation; independent reviewers decide whether it can ship. Read roles.md for the upstream skill used at each stage and gates.md for exact approval fields.

## Tool-specific execution

Codex and Claude Code should carry an approved workflow forward without requesting routine confirmation: refine in-scope work, run tests, coordinate independent reviews, record evidence, and make permitted state transitions. They pause for the user only when requirements are ambiguous, credentials or external authorization are needed, or a decision would materially change scope.

Cline uses an explicit handoff at the same boundaries because its adapter does not provide native Superpowers session hooks or subagent dispatch. The handoff must identify the document and gate state, work/evidence completed, the specific missing clarification or authorization, and the next safe action. This is a tool-execution difference, not a gate bypass: all tools remain subject to the same approval and PR requirements.

## Optional external Slack control plane

Projects that use an externally deployed Slack control plane can follow the
[Slack control-plane guide](slack-control-plane.md). It supplies routing and safety
contracts plus the generated, non-secret `config/workspace-config.yaml`; it does not change local Codex,
Cline, or Claude instructions.

## Authenticated event controller

The embedding harness imports `runWorkflowEvent` from
`scripts/workflow-event.mjs` and calls
`runWorkflowEvent([EVENT, '--root', PATH], {actor, observers})`. The function
reads one bounded JSON event from stdin (64 KiB maximum), writes its structured
decision to stdout, and returns it. A `human-needed` decision sets exit code 1;
thrown errors also block dispatch and must be handled by the harness. Inspect
the decision before taking any action. The standalone
`node scripts/workflow-event.mjs EVENT --root PATH` command deliberately fails
closed because it has no authenticated actor. Environment JSON cannot supply one.

The harness must obtain actual session identity and owner authorization through
its trusted context, then pass actor context out-of-band. Persist narrowly
scoped authorization in the locked Git-common runtime store; event JSON only
references its ID. Required event fields are `id`, `type`, `epic`,
`authorizationId`, and `completionCriterion`; `task.dispatch` additionally
requires `task`, and `epic.complete` requires `completionId`. Optional
`repository`, `branch`, and `scope` fields must match internally resolved facts.
They cannot select another repository or establish authority. The registered
worktree must be on its `epic/EPIC-NNN` branch with accepted effective policy.

| Event | Boundary and additional controller observations |
| --- | --- |
| `epic.start` | Checks predecessor completion before admitting the epic; `integration(receipt)` fetches current host integration facts for a predecessor. Provisioning in `new-epic.sh` reserves admission separately before creating resources. |
| `task.dispatch` | Checks the canonical approved plan, listed task, legal task state and completed dependencies before dispatch. |
| `review.ready` | Checks the canonical review stage before a PR exists. After local final reviews reach `ready-for-pr`, schedules publication of completed verdicts against the live PR head. `pullRequest(context)` returns `{repository, pr, head, state: 'open', base: 'main', headBranch}` from the host; durable claims bind that PR/head/role. |
| `merge.eligible` | Requires the canonical PR gate and `reviewAuthority(context)` returning `{identities, api}` for authenticated, paginated current-head reviews/checks. Rechecks the head and merge gates; it does not merge. |
| `epic.complete` | Requires a merged canonical plan. `completion(context)` supplies typed integration, policy, findings, documentation, activation and cleanup evidence; `integration(receipt)` independently refreshes host facts before completion is persisted. |

Callbacks are synchronous under the state lock; promises are rejected. Context
contains `root`, `repository`, `epic`, `head`, and the applicable `pr` or
`completionId`. The API returned by `reviewAuthority` implements the adapter
contract in `scripts/check-host-reviews.mjs`; use authenticated host reads,
never caller-supplied green snapshots. Completion receipt fields are defined
by `scripts/lib/epic-completion.mjs` and distinguish submitted head, the original
PR's merge commit, and the current integrated revision. Harness observations identify actual activation and
owned cleanup resources. An `authenticated` boolean or JSON receipt cannot
authenticate anyone by itself: local files remain cooperative evidence.

Duplicate delivery rechecks current actor, revocation and policy provenance.
Review scheduling persists claims before external dispatch and requires
acknowledgement afterward. A crash or uncertain transport result requires
reconciliation; local disk and external delivery are not one transaction.
Pushes and test runs never start reviewers. See [the transport contract](slack-control-plane.md).

## Plan, implementation and release boundaries

The staged validator distinguishes an initial documentation-only `plan-pr`
from `implementation-pr` eligibility on an approved, started plan. Initial plan
receipts bind plan ID/revision/reviewed SHA/role and cannot approve implementation.
Source, policy or workflow changes cannot hide in nominal documentation paths
in a plan-only PR. Ordinary plan edits do not create a second initial plan PR;
material scope changes still require reconciled authorization and signoffs.
The staged implementation action permits PR updates before final reviews; it
does not authorize merge or override the active repository workflow instructions.

EPIC-006 bootstrap retains its existing stricter pre-PR gates: complete tasks
and QA, independent staff review, then AppSec on the same final revision, and
conditional accessibility review before even a draft PR. Existing approvals,
plan revision, immutable assessment and legacy policy history stay intact.
Migration and adapter activation are release work after approved integration.
Candidate validators and candidate role maps cannot approve their own rollout.
See [the enforcement boundary](gates.md#enforcement-boundary).

After integration, explicitly propose and accept migration with
`scripts/init-workspace.mjs propose-change` / `apply-change` with `--candidate`, inspecting the
candidate diff and digest first. Legacy omitted/false/true direct-merge values
retain their historical interpretation; old acceptance hashes are not rewritten.
Root acceptance remains authoritative and linked worktrees cannot override tier
policy. An unchanged legacy policy can correctly return
`autopilot-policy-required` at dispatch. Fixture migration proves compatibility,
not adoption by the current session. Confirm actual root acceptance, loaded
integrated revision, effective policy digest and host protections before activation.

Merge alone does not complete an epic. Verify remote-main integration, required
checks and smoke results on that integration SHA, resolved introduced findings,
current docs, real agent-path activation and safe owned cleanup. Refresh host
facts at admission; pending/unavailable checks, corrective PRs or missing state
keep the epic active. Never manufacture a historical completion receipt: legacy
merged epics need an explicit historical baseline. Next-epic provisioning stays
blocked until completion/admission succeeds, including after restart.

Record an observed merge with the ordinary `check-gate.mjs DOCUMENT merged
--write` command, first for the plan and then the epic. The CLI obtains live
GitHub evidence through stored `gh` authentication; supplied JSON cannot replace
that observation. Preserve the original implementation PR in `pr_url`.
Before opening its status-only follow-up, run `check-gate.mjs PLAN
finalization-pr`. This separate gate permits only the same epic's status and
original PR URL markers, with reviewed source, policy, bodies, approvals and
task evidence unchanged. The follow-up still needs its own current-head host
checks and independent reviews. Hosted `review.ready` resolves that open PR
separately from the preserved original PR; it does not repeat or reopen the
completed local implementation review.

Completion after finalization retains the original merge commit and binds
checks, smoke and documentation to the new integrated revision. Authenticated
host observations must prove the intervening status-only PR integration.
Arbitrary main advancement, direct pushes and policy migration cannot use this
finalization relation. Recheck actual activation and cleanup for the resulting
integrated revision before admitting the next epic.

## Native workspace lock dependency

Workspace-policy mutations use the native `fs-ext` advisory-lock dependency so
concurrent stale-lock recovery cannot delete a live replacement lock. A
repository-owned install first runs `npm ci --ignore-scripts`, verifies the
pinned `fs-ext` build hook, then rebuilds only that reviewed package. All three
steps scope npm's cache and node-gyp SDK download directory to the active
worktree. Set both the current scoped and legacy node-gyp variables for
compatible toolchains.
`--nodedir` is intentionally not used: it selects a pre-existing Node source
tree rather than the SDK download directory. Do not use or repair a user-level
npm or node-gyp cache. Native builds require a supported compiler and Python;
CI runs the reviewed native build on Linux filesystems that support advisory
locks and checks the actual SDK download directory after a clean install.

## Start a project

Use this repository as a GitHub template or clone it, then run `bash scripts/init-project.sh`. Complete the native Superpowers installation in installation.md. The script creates project/project-plan.md without overwriting an existing plan. Nothing is pre-approved.

The EM uses /spec, interview-me and idea-refine, with Superpowers brainstorming, to write scope, measurable success criteria, constraints and milestones. EM and Principal decompose the project into epics with clear interfaces and dependencies. Principal records project approval. Use the gate command to move draft → awaiting-review → approved. Commit this coordination baseline before creating worktrees.

## Define and assign an epic

The EM assigns a stable ID and owner. Load Superpowers using-git-worktrees and run `bash scripts/new-epic.sh EPIC-001` from the coordination checkout. The script verifies project approval, clean Git state and ignored worktree placement, creates branch epic/EPIC-001 in .worktrees/EPIC-001, installs validator dependencies, runs the baseline tests, and creates the epic, plan and first task from templates. A failed setup retains the worktree for diagnosis; it never silently deletes work. Use native worktree tools instead when your harness provides them, following the same checks and template copying.

Enter that worktree and run `bash scripts/install-skills.sh`. Fill epic.md, including developer owner and QA/security fields. Circulate relevant epics to AppSec for concern IDs and threat-model notes; a low-risk routing decision still needs an explicit rationale. The QA Lead uses the upstream test-engineer persona and /constraints to specify unit/integration coverage, end-to-end or abuse cases where appropriate, and special QA requests. For any user-facing UI change, the independent accessibility reviewer uses accessibility-review to define WCAG 2.2 AA requirements and approve the epic. A project CONSTRAINTS.md may hold common standards; the epic must link and enumerate its applicable QA requirements. Transition the epic through awaiting-review to approved, then in-progress.

## Plan small, then get signoff

The developer invokes governed-plan and Superpowers writing-plans. Break the epic into the smallest useful tasks: one observable behavior, exact file paths, acceptance criteria, expected failing test and passing command, relevant QA IDs, dependencies and a single implementation commit. Create each task from TASK-XXX.md.template, replace the ID, and list its path in epic-plan.md. `depends_on` uses plan-relative paths such as `tasks/TASK-001.md`. Prefer minutes of focused work per task rather than a large context containing the whole epic.

Record which AppSec concerns the plan touches and which are unaffected, plus its own auth/data/external boundaries. Explicitly declare whether the plan changes a user-facing interface. Principal must approve task sizing, architecture and interfaces. If sensitive, move to awaiting-appsec-signoff and obtain AppSec approval next; otherwise record not-required with rationale. UI plans then move to awaiting-accessibility-signoff for independent accessibility approval. The approved transition is blocked until these conditions and the epic's QA/triage approvals are satisfied.

## Classify ordinary tasks before implementation

For a bounded task outside an already-governed Tier 3 epic plan, first confirm the effective workspace policy is accepted (`node scripts/init-workspace.mjs status --root .`). Do not proceed on a pending or stale policy. In a clean registered worktree, provide `answers.json` on stdin to `node scripts/preflight.mjs --id quick-fix --coordination-root . --worktree-root . < answers.json`; include the developer, scope, all eight explicit risk answers, UI status, claimed tier, intended repository-relative files, and accessibility evidence. Commit `project/task-assessments/quick-fix.yaml` alone as a direct child of its recorded `startingHead`, before any intended source path changes.

Tier 1 is limited to an explicitly low-risk, single-file, non-UI change. After implementation, run `node scripts/check-tier1.mjs --assessment project/task-assessments/quick-fix.yaml` and retain its final-check evidence. Final-diff classification may only raise the tier, never lower the preflight classification. Tier 1 direct merge is disabled in generated policy by default. An adopter may enable it only with an accepted policy and compatible host rules; in this template repository direct merge is never allowed and PRs are always required. `check-tier1.mjs` can report `Direct merge eligible: yes` when accepted config enables it; that generic result does not enforce this template's PR-only rule, so host protections must prevent bypass.

Tier 2 follows the PR route: keep the initial assessment commit before code, bind valid self-check or independent review evidence and each configured role approval (from someone independent of the developer) to the exact reviewed implementation commit, then run the existing `node scripts/check-pr.mjs` PR gate. CI supplies `BASE_SHA` and `HEAD_REF` from the pull request. UI work cannot be Tier 1; Tier 2 UI needs independent accessibility triage and plan evidence before implementation and independent final accessibility review on the reviewed commit. Unknown or high-risk answers, uncertainty, or a final diff that reclassifies to Tier 3 route through governed-plan and the approved epic/task gates. The tier checks consume file evidence; they do not authenticate approvers or enforce branch/merge policy.

Tier 3 requires a registered isolated worktree, distinct from its coordination root, on the plan's `epic/EPIC-NNN` branch. The sole first assessment commit immutably binds the approved plan, its listed task, that branch, and accepted-policy/effective-role provenance. Preflight proves local worktree registration and branch identity; PR validation recomputes committed policy, plan/task/branch binding, and role provenance, but cannot prove historical local registration in CI. The four configured roles are principal, qa, appsec, and accessibility_reviewer; their evidence adds to rather than replaces the ordinary Principal, QA, AppSec, independent final code, and final AppSec floors. Conditional accessibility triage, plan approval, and final review still apply to any plan declaring UI work. The template remains PR-only: local validators neither push nor merge, and host branch protection plus hosted reviews enforce the cooperative-control boundary.

## Build with evidence

The governed-build skill runs the gate before entering upstream subagent-driven-development. Start the plan, then each task through the validator. Superpowers owns RED/GREEN/REFACTOR and fresh task contexts. Include unit tests, required integration tests and every applicable special QA request. Commit each task's implementation separately; record its SHA and actual test results in its markdown file, then move it through in-review to done without staff code-review approval. Evidence metadata may be committed afterward to avoid a self-referential commit SHA.

Multiple developers can work different epics at once because each has a branch/worktree. Do not share working directories, mutate a shared plan file concurrently, or cherry-pick another developer's unfinished task. Within an epic the default is one task at a time. Optional parallel tasks require separate task worktrees, no unresolved dependencies or overlapping file ownership, and a developer who integrates and verifies them in order. The gate checks declared dependencies, but coordination and conflict resolution remain the developer's responsibility. A blocked epic need not block unrelated approved epics.

If scope changes, reset the affected document to draft with the validator, reconcile children to its new revision, and obtain fresh approvals. For implementation fixes during review, return the plan to in-progress; both final reviews are cleared. Re-run affected tests and reviews after conflict resolution or rebasing.

## Review and merge

Finish all tasks and run the full QA bar, then move the plan to in-review. An independent staff reviewer evaluates the final implementation revision using the existing code-reviewer persona and code-review-and-quality skill for five axes: correctness, readability/simplicity, architecture, security and performance. Superpowers requesting-code-review and receiving-code-review coordinate feedback. Record each finding in `review_comments`. If any finding requires a fix, make the necessary commit(s), then request a new code review. The final code reviewer records the resolution and approval only after verifying every finding on the final `review_commit`; intermediate commits do not need separate approvals.

Only then move to in-appsec-review. Use appsec-gate with the existing security-auditor for the mandatory pre-merge pass, regardless of whether earlier AppSec involvement was waived. Record appsec_review for the same SHA. UI plans then move to in-accessibility-review for a final independent accessibility review of that same SHA before ready-for-pr. Commit metadata; governed-ship runs the `pr` gate immediately before opening a PR. Include the epic plan, QA evidence, findings and all applicable approvals in the PR description.

Use finishing-a-development-branch for verification and branch cleanup, choosing the PR route. Host checks and configured required reviewers must pass. Re-run the gate before merging; merge through the PR. After the host confirms it, record pr_url and transition the epic plan, then the epic, to merged in a metadata follow-up. Do not delete other developers' worktrees. The EM tracks completed epics against project success criteria and milestones.
