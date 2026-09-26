# EPIC-006 lifecycle correction

Developer session: `/root/correct_dispatch_integration`, 2026-09-26.
Source revision: `f5d7c7b`. This bounded correction restores existing
TASK-009/010/011 lifecycle contracts under the recorded bootstrap authorization.
It preserves completed task history, plan revision 1, immutable assessment,
accepted policy and policy history. It is not final independent approval or
release activation evidence.

## Reproduced failures and repairs

- Real `check-gate.mjs PLAN merged --write` failed because its CLI supplied
  neither the head nor host evidence. It now observes the canonical merged PR
  directly through authenticated `gh`, validates reviews/checks on submitted
  head S, confirms actual merge M, and only then writes the status.
- Real `check-pr.mjs` rejected every already-merged plan, including the required
  status bookkeeping. Its specific finalization route now verifies original
  host merge and strict repository/document invariants. It cannot authorize
  another epic, assessment, or implementation.
- Completion rejected M different from current integrated main I, including
  legitimate bookkeeping. Typed host receipts now preserve M separately from
  I and bind any permitted advancement to same-epic finalization paths.
- `review.ready` rejected ready-for-pr after completed pre-PR local reviews.
  Hosted scheduling now publishes those completed verdicts at the actual open
  PR's current head without reopening local review.
- Additional negative tests exposed acceptance of frontmatter comments through
  semantic-only comparison, a direct bookkeeping push without a merged PR,
  and incomplete exported postmerge review receipts. Each was observed RED,
  corrected, and rerun GREEN.

## Verification

Command:

`node --test tests/gates.test.mjs tests/task-assessment.test.mjs tests/workflow-event.test.mjs tests/epic-completion.test.mjs tests/epic-integration.test.mjs tests/lifecycle-finalization.test.mjs tests/host-review-events.test.mjs`

Final result: **104 passed, 0 failed, 0 skipped**. Local log:
`/tmp/epic006-lifecycle-focused.log`. `git diff --check` passed before commit.

The real CLI/check-pr tests use controlled external transport fixtures, not
actual hosted approvals. They reject unmerged/wrong-repository PRs, absent,
stale or dismissed reviews, failed/pending checks, and main races without
writing status. The mutation matrix rejects source, policy, document body,
frontmatter comment, approval, task evidence and assessment changes through
the finalization route. Wrong publication PR, branch, repository, head and
closed state fail hosted scheduling.

The generated lifecycle exercises distinct submitted S, merged M and integrated
I: original hosted verdict readiness and merge eligibility; actual merged CLI
transitions for plan and epic; actual check-pr admission of markers; separate
finalization PR verdict publication and merge eligibility; authenticated
bookkeeping integration; typed completion; and fresh next-epic admission.
It preserves original implementation PR 7 while publishing finalization
verdicts on PR 8. This maps to QA-GOV-005/006/007/008/009. Real-session release
QA-GOV-010, integrated migration and final independent reviews remain pending.

## Interface and authority boundaries

`merge-eligible` is a read-only exported gate used by the workflow event with
fresh exact-current-head host reviews. `merged --write` records a confirmed
host merge; S need not equal M or I. The exact existing CLI syntax is retained.
`node scripts/check-gate.mjs PLAN finalization-pr` independently obtains live
merged-host facts and checks strict local finalization changes before a
bookkeeping PR. Neither CLI accepts user-supplied host evidence JSON.

The shared `epic-finalization.mjs` helper compares complete untruncated trees.
Only the same epic's plan/epic status and original canonical `pr_url` may
change. Other parsed fields, invariant YAML syntax, document bodies and every
other repository path remain unchanged. Advanced main must descend from M and
be the actual result of one associated merged finalization PR with a matching
reviewed artifact tree. Native PR checks and independent exact-head host
reviews still apply to that finalization PR.

Hosted `pullRequest(context)` observations include repository, PR number, head,
open state, main base and the assigned epic branch. For finalization, the
publication PR is resolved out-of-band and differs from the original PR in
canonical `pr_url`. Returned review context contains both `originalPr` and
`pr`, plus the reviewed implementation. Optional `finalizationApi` supplies a
trusted synchronous host transport for an embedding controller; the default
uses authenticated `gh`. Raw event JSON still establishes no identity or
host authority.

The direct local CLI reads owner-managed reviewer mappings through the existing
authenticated connection. GitHub repository-variable reads require their own
permission; Actions read alone does not confer it. CI finalization admission
does not read those variables or substitute for the trusted host publisher.
Its workflow step receives only the existing scoped token with contents and
pull-request read permission. No tokens are retrieved or printed, and no
host writes occur in these helpers or tests.

No policy/source change is admitted as bookkeeping. Root policy adoption,
actual activation, cleanup of owned resources, protection enforcement and
EPIC-007 release remain separate gated obligations. Root-owned documentation
edits are excluded from this source/evidence change.
