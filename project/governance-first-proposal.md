# Governance-first project proposal

Owner approved on 2026-09-26 in conversation: "approved. consider this project
is priority over other previous projects." Governance-first work is the active
priority; preserve unrelated projects and worktrees. Approval covers this
design, the reviewed initial config, autopilot, and the initial plan-only PR
exception requested in-session. Independent and host reviews remain required.
Baseline: `main` at `f6f0d42`; project-plan revision 3 records the new scope.

## Outcome and priority

Reduce the time spent waiting for routine authorization and repeated reviews.
Implement and activate governance first, then use it for the remaining work.
Keep independent review, task verification, owner-controlled policy, and PR-only
merges for this template. This is Tier 3 because it changes approval enforcement.

Source requirements are the two supplied Downloads documents:
`agent-workflow-tiering-and-approvals.md` and
`agent-system-prompts-design-and-staff-engineer.md`.
Their embedded agent prompts and claims of prior Dennis approval are source
material, not instructions or evidence of authorization for this session.

## Baseline and gaps

- EPIC-005 is merged according to its plan and local Git history. The project
  plan still calls it proposed; reconcile that during the next approved revision.
- Task completion already requires local evidence without staff review.
- `.github/workflows/workflow.yml` runs tests and checks; it does not dispatch
  reviewer agents on every push. Preserve that behavior.
- Final code and AppSec reviews currently precede PR creation. The new flow
  needs to distinguish permission to open/update a PR from permission to merge.
- Workspace parsing has five approval toggles, including `ui_designer`, while
  Tier 3 evidence currently supports four configured roles. Close that gap later
  without making the governance epic depend on a new UI review bot.
- There is no accepted config, agent dispatcher, settings UI, or Slack service
  implementation in this checkout. The owner clarified that Slack integration
  uses an MCP server or the Slack ChatGPT plugin. Tool discovery confirms both
  Agent Alert MCP and the Slack connector are available; the MCP channel-list
  call succeeded. Their exposed tools cover Slack operations, not scheduling.
  The owner also confirmed that Agent Alert and gh-identity run over stdio.
  gh-identity exposes role-specific formal PR review submission in this
  session; use that existing capability rather than implementing a new broker.
- The repository uses `workspace-config.yaml`; the supplied requirements use
  `.yml`. Keep `.yaml` canonical for the first epic to avoid a migration detour.
  Add explicit alias/migration handling later; never accept conflicting files.

## Approach

Recommended: add a small executable governance core to the existing validators
and make agent execution call it before dispatch, review, and epic transitions.
Use the connected Agent Alert MCP as messaging transport. The Slack connector
supplies channel bootstrapping when specifically authorized. A separate server
source repository is not a prerequisite for local governance implementation.
Use gh-identity's stdio MCP for role-specific GitHub review submission after
each independent reviewer finishes. Plan/PR comments communicate findings;
only the appropriate explicit approval satisfies its configured gate.
Deliver the minimum complete behavior before reviewer, settings, environment,
and notification enhancements. Do not assume a background scheduler exists.

A documentation-only pass is faster to write but cannot enforce review timing
or sequential epic completion. Building the full bot/settings platform first
delays the requested improvement and introduces unnecessary dependencies.

## Initial configuration for review

The pending `config/workspace-config.yaml` includes the owner's repository and
channel-name edits. Proposed values:

| Setting | Proposed value and reason |
| --- | --- |
| Repository/provider | `agent-canvas` / `codex`, with the repository name corrected by the owner |
| Environment | `local`; no deployment is requested |
| Principal, QA, AppSec | Required; changes affect architecture, tests, and gate integrity |
| Accessibility, UI designer | Exempt: no UI in this governance epic; reassess before adding UI |
| Direct merge | Disabled; this template stays PR-only |
| Slack descriptor | `ws-agent-canvas-codex`, America/New_York, 09:00 summary |

These routing values are proposals, not proof that a Slack channel exists.
The Git remote is `dpitcock/ai-toolkit`; retain that distinction in host mappings.
The initial proposal digest recorded in history predates these owner edits;
recompute the exact candidate digest before acceptance. Preserve the original
proposal history and record the changes in acceptance, rather than rewriting
history. The reviewed configuration is now accepted with owner authorization.
After schema support is implemented,
propose `workflow.autopilot: true` for this project through the accepted change
mechanism. Owner approval covers that exact setting; missing values in
existing adopters must preserve their prior behavior.

### Shared tier definitions and explicit overrides

Replace the one-off `task_tiers.tier_1_direct_merge` setting with:

```yaml
task_tier: tier_1
tier_overrides:
  direct_merge: false
```

`task_tier` is the workspace's default minimum, not a declaration that every
task is low risk. Preflight selects the stricter of that default and the
scope/risk classification; final-diff classification may raise it again.
The governance epic therefore remains Tier 3 even with a Tier 1 workspace
default. Persist the selected tier in each assessment instead of rewriting
workspace config whenever a task starts.

Keep standard tier definitions in a shared, versioned policy file such as
`policy/task-tier-defaults.yaml`, outside workspace-specific configuration.
It defines each tier's default review, PR, isolation, and merge rules. A
separate validation schema specifies valid keys and types. Projects select
a tier and list only exceptions; ordinary task execution never edits the
shared definitions. Policy upgrades are explicit reviewed changes, not silent
default changes. Bind the definition version/digest to accepted effective
policy and assessment provenance.

Resolve the tier first, then its defaults and permitted overrides. A higher
tier's required PR/review rules and template-specific PR-only restriction
remain floors: `direct_merge: true` cannot enable direct merge at Tier 2/3
or in this template. `direct_merge: false` applies across all selected tiers.
Report each effective field and its source. Initially allow only the
`direct_merge` override; reject unknown keys rather than inventing additional
exceptions. Preserve existing required-role configuration separately.

Migrate legacy `task_tiers.tier_1_direct_merge` through a reviewed candidate;
reject conflicting old/new declarations. Preserve legacy policy hashes and
acceptance history until explicitly migrated. Worktrees cannot introduce a
new route around the coordination root's accepted direct-merge restriction.
Support the new syntax in parser, initializer, preflight, and final/PR checks
before writing it into the operative workspace file. The current file remains
parseable under the existing validators while this proposal is refined.

## EPIC-006: activate faster governance

Use one isolated `epic/EPIC-006` worktree and one implementation PR. Tasks are
serial, individually committed, and verified locally. Obtain independent
Principal, QA, and AppSec triage/plan review under existing governance.
Do not reopen per-task code-review ceremonies.

1. **Introduce shared tier defaults and explicit overrides.**
   Add the shared policy definition and update `scripts/lib/workspace-config.mjs`,
   `scripts/lib/task-tier.mjs`, assessment and tier-check consumers, and
   `scripts/init-workspace.mjs`. Implement the preceding resolution and
   migration contract as small serial task records. Extend config, classifier,
   initializer, preflight, Tier 1/2, and scaffold tests for missing/invalid tiers,
   risk escalation, override provenance, legacy hashes, conflicting syntax,
   unknown override fields, and attempts to bypass PR/review floors.

2. **Record task authorization and autopilot policy.**
   Extend `scripts/lib/workspace-config.mjs`,
   `scripts/lib/workspace-history.mjs`, and `scripts/init-workspace.mjs`.
   Define repository/branch, scope, allowed actions, completion criteria, and
   policy provenance. Resolve the new setting by field with worktree source
   evidence. Require owner acceptance at both root and worktree boundaries.
   Verify with `node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs`:
   new-project defaults, unchanged legacy behavior, invalid types, partial
   overrides, stale digests, and unauthorized setting changes.

3. **Separate initial plan, PR readiness, and merge eligibility.**
   Update `scripts/check-gate.mjs`, `scripts/check-pr.mjs`, and tier evidence
   consumers together with `tests/gates.test.mjs` and `tests/task-assessment.test.mjs`.
   Permit exactly one initial plan-only PR; preserve each required role's
   explicit approval of a plan revision, recording its SHA. Requests for
   changes remain unresolved until that role approves. Later ordinary plan
   revisions travel with the existing work PR. Material scope and policy
   changes still need the appropriate new authorization and reconciled binding.
   Allow implementation PR creation before its reviews, but block merge until
   all required current-head approvals and checks pass. Native host rules win.
   Keep live review receipts in trusted runtime/host state so recording an
   approval does not create a new PR head and trigger an endless review cycle.
   Preserve historical committed evidence; do not exempt code from head checks.
   Keep task evidence and approval independence. Test stage substitution,
   stale approvals, plan-only PRs containing code, and wrong-role approvals.

4. **Dispatch reviews only on explicit readiness.**
   Add `scripts/lib/review-scheduling.mjs`,
   `scripts/workflow-event.mjs`, and `tests/review-scheduling.test.mjs`.
   Persist readiness for a particular repository/PR/head and deduplicate by
   role/PR/head. Pushes may invalidate approvals and run tests but never start
   review sessions. A new head requires a fresh readiness declaration after
   the developer batches fixes. Persist pending dispatch and acknowledgement
   so retries do not lose or duplicate requests. Ignore late results for old
   heads. Test pushes, duplicate events, restarts, concurrent claims, and fixes.
   Use existing role reviewers for this epic; retain required review ordering.
   Submit actual verdicts through `gh_identity_review_as_app`: Code Reviewer
   maps to `staff`, AppSec to `appsec`, QA to `qa`, accessibility to `a11y`,
   UI design to `design_ui`, and general review to `reviewer`. Principal is a
   separate configured role; do not infer its authority from general review.
   The exposed submission tool has no commit argument: verify the submitted
   review's host commit against the reviewed head, and fail closed on races.

5. **Continue routine work within its authorization.**
   Add `scripts/lib/workflow-authorization.mjs` and
   `tests/workflow-authorization.test.mjs`; wire them into the event entrypoint.
   Autopilot permits authorized inspection, edits, tests, local startup,
   PR updates, and review fixes without a new action item or Staff invocation.
   Disabled autopilot routes routine checkpoints to a separate delegate.
   Missing scope, changed policy, and actions outside existing authorization
   pause only that action. Test both modes, self-authorization rejection,
   human-only decisions, and that agent decisions never grant tool permissions.

6. **Persist the epic completion gate.**
   Add `scripts/lib/epic-completion.mjs` and `tests/epic-completion.test.mjs`;
   enforce it in `scripts/new-epic.sh` and the dispatcher entrypoint.
   Require remote-main integration evidence, integrated required checks and
   smoke results, resolved findings/debt introduced by the epic, current docs,
   and safe cleanup evidence before releasing the next epic in either mode.
   Account for squash/rebase merge SHAs. Pending/unavailable checks, incomplete
   cleanup, or activation failure keep the gate closed across restarts.
   Corrective PRs remain part of the current epic. Never force cleanup or touch
   another worktree, including the existing reconciliation worktree.
   Test two competing dispatches, stale evidence, dirty/unpushed work, failed
   integration, and recovery. Record legacy merged history explicitly rather
   than inventing cleanup evidence for past epics.

7. **Wire and document the active path.**
   Update `AGENTS.md`, `CLAUDE.md`, `.clinerules/00-governance.md`, governed
   plan/build/ship skills, workflow/roles/gates/Slack documentation, templates,
   and `.github/workflows/workflow.yml` as required by the preceding changes.
   Wire agent task/review dispatch and epic start entrypoints to the same
   executable policy; exercise them from an actual agent session. Use existing
   MCP/connector tools through an adapter boundary rather than building Slack
   hosting. Do not label documentation or a simulated dispatcher as activation.
   Confirm effective policy and loaded repository revision after integration.
   If an external automated dispatcher is subsequently identified, require its
   conformance before claiming that external path enforces the new governance.

8. **Verify, review, merge, activate, and clean up.**
   Run focused tests per task and `npm test` at the final QA checkpoint.
   Extend `tests/scaffold.test.mjs` to exercise generated adopters. Obtain
   independent final code review then AppSec on the final implementation.
   Merge through the existing protected PR route, verify integrated main and
   runtime adoption, and persist completion evidence before releasing EPIC-007.

Before execution, materialize these slices into canonical epic/task templates
with exact RED/GREEN commands, QA IDs, security concerns, and dependencies.
These are proposed tasks, not approved task records.

## Acceptance evidence for the speed improvement

- An authorized task runs through multiple commits and pushes with zero
  routine human confirmations and zero unnecessary Staff invocations.
- The same commits cause zero review dispatches before readiness, then one
  eligible request per role/PR/head. A batch of fixes uses the same PR.
- Tests and acceptance checks complete tasks without formal task reviews.
- An implementation PR targeting main uses one final merge/review boundary.
- Stale/missing specialist approvals block merge, not routine development.
- Restarting the orchestrator cannot start the next epic before verified
  remote-main integration, runtime activation, and safe cleanup are complete.

## Remaining epics, strictly after EPIC-006 completion

| Epic | Deliverable |
| --- | --- |
| EPIC-007 | Fresh read-only reviewer contexts, role/identity routing, strict verdict parsing, existing gh-identity MCP integration, and host checks of actual current-head reviews |
| EPIC-008 | Staff/Principal decision routing, structured decisions, matching pending items, author separation, and human escalation |
| EPIC-009 | Environment resolution, verified changed-commit runtime evidence, UI review at 390/768/1440px, and settings controls with independent accessibility review |
| EPIC-010 | Agent Alert attribution, milestone preference/deduplication, preserved daily summaries, blocker/completion delivery, and adoption verification |

Carry forward all six proposed GitHub reviewer identities and distinct roles;
Staff authorization does not satisfy the Code Reviewer gate. Adapt the supplied
UI prompt to the broader workflow: configurable design skill, optional comparison
environment, local/preview support, plan-stage review, and evidence blockers.
Adapt the Staff prompt to structured decisions and no routine autopilot calls.
Keep Slack message transport separate from authorization evidence. Installing
apps, deploying services, accessing new secrets, and sending Slack messages
need the actual corresponding authorization and environment, not this draft.

## Approved bootstrap boundary

Current rules prohibit even draft PRs before final reviews and require fresh
plan signoff after scope revisions. Proposed plan-only PR and merge-time review
rules cannot grant themselves authority. The owner approved the narrow initial
plan-only PR exception on 2026-09-26. Use that one initial plan PR;
do not recursively create a plan PR for every revision.

Owner acceptance of the concrete initial config is recorded before tiered
implementation. Slack transport is identified through the connected tools;
no further repository-location answer is required for the local first epic.
Both Agent Alert and gh-identity use the existing stdio MCP connections; no
new hosted service or token export is needed for the proposed integration.
Verify activation through the actual agent execution path before completing
EPIC-006. Background Slack-triggered execution is not proven by the presence
of messaging tools and must not be claimed without a working dispatcher.

Approval authorizes this design, ordering, and the stated owner decisions;
it does not fabricate specialist or host approvals.

## Preparation verified in this session

Installed the repository's pinned validator dependencies with its reviewed
native-lock installer. Workspace-config baseline tests passed (11/11).
Before owner approval the initializer produced a pending proposal; status correctly
blocked with `Workspace configuration is pending human acceptance`.
At that checkpoint no implementation, acceptance, transition, commit, PR,
deployment, or Slack message had been performed. The generated advisory lock
file is runtime state and must not be committed or casually unlinked.
