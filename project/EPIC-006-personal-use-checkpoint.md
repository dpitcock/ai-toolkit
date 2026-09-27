# EPIC-006 personal-use checkpoint

## Owner-authorized priority revision

On 2026-09-26 the owner clarified that this is for personal use on this Mac,
not a public production package, and explicitly answered "Yes revise" to a
proposal for focused local workflow and safety checks with distribution testing
and broader release activation deferred. This checkpoint is the immediate
delivery target. The original proposal already specified a local environment
with no deployment.

Use the existing EPIC-006 worktree, `epic/EPIC-006`, Node 24.11.0, and its
installed native `fs-ext` binding. Do not switch Node versions, move QA to
another machine, repeat clean installs, or rebuild the native dependency unless
a demonstrated local defect requires it. Run small test groups serially.

## Preserved behavior and boundaries

Keep local policy resolution, tier escalation, accepted-policy provenance,
bounded authorization, independent reviews, explicit review readiness,
deduplication, current-head checks, PR-only merging, and safe completion and
cleanup protections. No implementation safeguard or existing test is removed.
The coordination checkout and its unrelated EPIC-005 deletion remain untouched.

This is a revised immediate milestone and verification strategy, not a waiver
of canonical release gates. Preserve existing revisions, approvals, completed
task records, immutable assessment, accepted policy/history, and plan status.
The original full QA bar and final Staff/AppSec gates still govern any later
implementation PR. Local readiness does not mean activated autopilot, merged
or completed EPIC-006, or permission to admit EPIC-007.

## Local acceptance

1. Corrected routing, pre-merge materialization, remote-only J materialization,
   and the stale J-error expectation have passing retained regression evidence.
2. The local policy, authorization, persistence, review-readiness and rejection
   checks below pass against the recorded final source, with no unexplained
   skips, cancelled tests, weakened assertions, or changed production timeouts.
3. A bounded local smoke records Node/native-binding availability, the loaded
   Git revision, registered branch/worktree, accepted policy provenance and
   `git diff --check`. A legacy-policy or unauthenticated-entrypoint refusal is
   reported as a refusal, never successful activation.
4. Independent QA verifies the complete local evidence and its limits.
   Record unresolved or deferred findings explicitly; do not claim full QA.

### Required existing tests

Run these complete files with `node --test --test-concurrency=1`, split into
small serial groups, capturing full logs and exit codes:

- `tests/task-tier.test.mjs`, `tests/tier-defaults.test.mjs`,
  `tests/workspace-config.test.mjs`, `tests/task-assessment.test.mjs`.
- `tests/preflight.test.mjs`, `tests/check-tier1.test.mjs`,
  `tests/check-tier2.test.mjs`, `tests/gates.test.mjs`,
  `tests/bootstrap-policy.test.mjs`.
- `tests/workflow-authorization.test.mjs`, `tests/workflow-state.test.mjs`,
  `tests/workflow-event.test.mjs`, `tests/review-evidence.test.mjs`,
  `tests/review-scheduling.test.mjs`, `tests/release-review-integrity.test.mjs`,
  `tests/controlled-host-transport.test.mjs`.

QA additionally requires the small complete `tests/epic-completion.test.mjs`
file after the completion schema correction, along with wrong-submitted-head
and wrong-original-merge rejection assertions in the existing same-PR2 case.
This affected-code coverage was requested by `/root/verify_full_qa` on
2026-09-27 and does not expand the deferred hosted activation scope.

Run these exact named `tests/init-workspace.test.mjs` cases:

- policy candidates cannot self-declare delegated owner acceptance
- policy changes stay read-only until matching human approval is applied
- a failed history append restores the accepted config and history pair
- two waiters recover after an advisory-lock holder dies without deleting its lock path

Run these exact named `tests/epic-policy-adoption.test.mjs` cases because their
code or assertions were corrected during this session:

- integration materializes the API-bound J object before proving it
- real CI release route is selected from trusted I and never needs local runtime or its own green result
- same open PR2 correction invalidates both readiness boundaries and requires fresh independent review

Reuse a completed run only with its full log, exact command/runtime/revision,
exit 0 and passing totals, plus verification that relevant tests, behavior and
dependencies are unchanged. Interrupted groups remain incomplete. The complete
dependency audit may be reused while its package-lock identity remains unchanged.

## Explicitly deferred

- Repeated clean-install/native-build and exhaustive generated-adopter matrices.
- Other runtime/platform certification, including hosted Node 22 compatibility.
- The remaining exhaustive migration/finalization/release-continuation matrices.
- Actual root-policy migration, hosted activation, host-protection changes,
  post-integration release continuation, cleanup/completion receipts and QA-GOV-010.

These remain future obligations wherever the original release contract requires
them. No current test result supplies host approval, accepted migration, safe
cleanup or actual-session activation evidence. Existing unresolved canonical
review comments are not closed by this checkpoint.

## Independent planning and QA assessment

The following independent sessions reviewed and approved the written checkpoint
on 2026-09-26 (local date), at document SHA-256
`bc67d7502693373e82c178cabe277a03719220652a6cbdc20eecd5ebae6c24eb`:

- Principal `/root/personal_use_plan_route`: approved the bounded milestone with
  canonical release obligations pending; no required changes.
- QA Lead `/root/verify_full_qa`: approved the focused coverage and truthful
  evidence rules, verifying all named test files and selected cases exist.
- AppSec `/root/personal_use_security_scope`: approved the planning boundary
  with no material findings; existing safety and authorization checks remain.

A canonical revision reset would conflict with pinned bootstrap provenance and
completed task history; do not reset or rewrite them to make a reduced bar pass.
Actual local verification remains pending. These are planning assessments,
not final implementation, QA-result, PR or activation approvals. This section
records the reviews after their reviewed document snapshot.
