# TASK-015 acceptance correction

Developer: Codex independent task session `/root/correct_task015`, 2026-09-26.
Implementation commit: `a9173f4` (fix: publish trusted current-head host review status).
Authority and route: `project/EPIC-006-bootstrap-correction.md`; bounded
acceptance repair under the existing active approved plan. Historical TASK-015
status, evidence, plan revision, and immutable preflight are unchanged.
This is developer evidence, not independent review approval or activation.

## Corrected behavior

`pull_request_review` runs a read-only relay in `workflow.yml`. Its skipped CI
job has a different check name, so it cannot supersede the required `gates`
check. Trusted default-branch `review-gates.yml` responds to workflow completion
and pull-request target events, checks out only the default branch with
credential persistence disabled, and provides GH_TOKEN explicitly. Its only
write permission is statuses; repository, PR, check, and Actions access is read.
No artifacts or candidate code execute in this privileged workflow.

The real CLI enumerates live open main PRs on every wakeup, publishes pending,
validates live current-head reviews and CI, then publishes success or failure
under stable commit-status context `host-review-gate` on that exact head.
Head checks surround evidence collection and follow publication. Each delivery
revalidates current facts; events carry no approval authority or dispatch action.
CI completion provides another evaluation after checks were pending.

Required CI API check name is `gates`, the configured job name, rather than UI
label `workflow / gates`. Only required checks are evaluated, avoiding a wait
on this publisher itself. Check head SHA, GitHub Actions app ID/slug, check-suite
workflow path/repository/event/head, latest check ID, and successful completion
are validated. Missing, pending, failed, skipped, or forged evidence blocks.
Candidate workflow blobs must equal trusted default-branch workflow blobs;
workflow changes require the existing independently verified bootstrap or
maintenance route, never their own candidate gate as proof of eligibility.
Owner-managed identity maps cannot remove Code Reviewer and AppSec floors.

The approved TASK-008 contract distinguishes human mappings from bots. Explicit
`kind: bot` maps now require exact mapped login and GitHub `Bot` type; human maps
require `User`. Names alone never infer a bot mapping or authorize a role.

## Actual RED / GREEN / QA

Focused command: `node --test tests/host-review-events.test.mjs tests/review-evidence.test.mjs`.

- Initial RED: 21 tests, 12 passed, 9 failed: unsafe workflow event/permissions,
  missing exact-head/app/latest checks, and no CLI publication.
- First GREEN: 21/21 passed.
- Bot/provenance RED: 24 tests, 21 passed, 3 failed: explicit Bot mapping,
  forged workflow provenance, and missing Actions read permission.
- Bot/provenance GREEN: 24/24 passed.
- Relay-name RED: 24 tests, 23 passed, 1 failed; corrected skipped-check name.
- Rerun RED: 25 tests, 24 passed, 1 failed; older failed workflow run was
  incorrectly blocking its newer successful replacement.
- Final focused GREEN: 25/25 passed, zero skipped or cancelled.
- `node --check` passed for both changed scripts; `git diff --check` passed.
- Additional scaffold regression: 31 tests total, 28 passed, 3 failed.
  Workflow-context assertion passed. Three generated-adopter tests fail because
  fixtures omit `policy/task-tier-defaults.yaml`; this correction does not alter
  scaffold assets. These remain for the subsequent packaging task/full QA.

QA-GOV-005/006: current-head authenticated evidence, identity kinds, review
rejection/dismissal, races and CI provenance. QA-GOV-007: no reviewer dispatch;
duplicates and out-of-order events re-evaluate current facts. QA-GOV-009:
executable gh subprocess mocks cover authentication and actual status writes;
parsed workflow tests cover permissions and trust boundaries. Developer source
review covered changed files and scaffold integration; final independent Staff
and AppSec reviews remain mandatory on the final implementation revision.

## Release limitations and source basis

No GitHub settings, variables, protections, PRs, reviews, or statuses were written
in this task; tests use a temporary mock gh executable. Observe real check names,
head binding and permissions after trusted integration before activation.
The read-only relay can be suppressed by candidate changes; it is not authority.
Native protections requiring fresh approvals, dismissal/changes-requested rules,
restricted pushes and PR-only merging remain mandatory. Delivery/publication is
not atomic with host changes; this implementation does not promise immediate
revocation or replay-proof enforcement. API/token outages can prevent a status
write, so native host controls and release verification remain necessary.

Primary references inspected: GitHub [event contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
[commit status API](https://docs.github.com/en/rest/commits/statuses),
[check runs](https://docs.github.com/en/rest/checks/runs), and
[workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

## Stored authentication and integrated-publisher followup

Developer `/root/correct_task015`, 2026-09-26; implementation
`e2caf6be6113386e32618636040ff6e5b5992c69`.
This bounded acceptance correction preserves the same bootstrap authority,
immutable plan/preflight, and historical TASK-015 record.

The CLI now lets authenticated `gh api` use existing local credentials without
requiring a token environment variable. It never requests, retrieves, prints,
or exports credentials. Actions still explicitly supplies scoped GH_TOKEN.
Unauthenticated API execution fails closed. The
[GitHub CLI authentication contract](https://cli.github.com/manual/gh_auth_login)
supports stored credentials and explicitly recommends GH_TOKEN for Actions.

The trusted workflow adds manual diagnostic verification of a positive merged
bootstrap PR number. Its dispatch job runs only from `refs/heads/main` and
checks out the default branch. Distinct `--verify-merged` mode requires live
closed/merged main PR identity and authentic integration ancestry. It preserves
current submitted-head review/check/role/workflow-content validation, separately
binds the integration SHA and observed main SHA, and rechecks merged PR/main
state before and after success publication. Squash/rebase are supported without
equating submitted head to integration SHA. Normal publication still rejects
closed PRs. The real status context remains `host-review-gate`; job display name
is `Publish host review status`, avoiding same-name check/status ambiguity.

Successful diagnostics emit `integrated-host-gate-verification` with submitted
head, integration/main SHAs, status context and workflow-run ID when present.
They do not authorize another merge or assert activation/completion. Integrated
main CI/smoke, real status observation, protection installation/readback, and
the remaining release requirements remain separate. No extra source PR or
protection relaxation is introduced.

Focused command remains the two host/review-evidence test files above. Initial
RED: 44 tests, 41 passed, 3 failed (dispatch contract, stored authentication,
merged verification). Executable YAML shell regression then reproduced a
missing continuation: 45 tests, 44 passed, 1 failed; fixed before commit.
Final GREEN: 48/48 passed, zero skipped/cancelled. Tests execute both workflow
shell routes through a mock gh process, evaluate the main-only dispatch guard,
reject invalid PR values and wrong base/repository/state, validate integration,
and revoke success after a publication-time main race. `node --check` and
`git diff --check` passed. Developer source review completed; independent final
Staff/AppSec review is still required on the final implementation revision.

All host calls in these tests use mocks; no real host writes occurred. Native
GitHub Actions app ID 15368 is shared across repository workflows. A writer
able to add another workflow with `statuses: write` may forge the same status
context; comparing these workflow blobs does not remove that capability.
This is not tamper-proof enforcement against workflow-capable repository
writers. Native host policy, independently required reviews and restrictions
on privileged workflow changes remain deployment constraints for final AppSec
review, in addition to the relay-delivery and API-race limitations above.
