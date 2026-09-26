# State and approval contract

Each document has YAML frontmatter. Templates explain the fields inline. Use quoted ISO dates; no YAML aliases or duplicate keys. `owner` is the author/session identity. Every approval object has `by`, `date`, `notes`, and `revision`; it must name someone other than the owner. Notes link actual review evidence. Final review objects also have `commit`. Only `appsec` may use the literal `not-required`; missing/null is never equivalent.

```yaml
approvals:
  principal_engineer:
    by: principal-session-12
    date: "2026-09-07"
    notes: "Reviewed design, dependencies and task sizing; see review notes below."
    revision: 1
  appsec: not-required
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
review_comments:
  - id: CR-001
    status: resolved
    resolution_commit: "0123456789abcdef0123456789abcdef01234567"
    verified_by: staff-reviewer-session-4
    verified_date: "2026-09-07"
    verified_commit: "0123456789abcdef0123456789abcdef01234567"
```

Commands are rooted in the current worktree:

```sh
node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md approved
node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md approved --write
node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md pr
```

Without `--write` the check is read-only. Failure exits nonzero with `GATE BLOCKED`. The write form validates before changing status. `pr` is an action, not a status, and requires ready-for-pr. `check-gate.sh` is an equivalent shell entry point.

## Legal progression

| Document | Progression | Blocking prerequisites |
|---|---|---|
| Project | draft → awaiting-review → approved → in-progress | Principal approves project scope before approval/start |
| Epic | draft → awaiting-review → approved → in-progress → merged | Approved project, QA approval and nonempty requirements; conditional AppSec and accessibility triage; plan merged before epic merged |
| Epic plan | draft → awaiting-principal-signoff → [awaiting-appsec-signoff] → [awaiting-accessibility-signoff] → approved → in-progress → in-review → in-appsec-review → [in-accessibility-review] → ready-for-pr → merged | Approved epic; Principal then conditional AppSec/accessibility approval; all tasks and full QA complete before independent staff code review on the final implementation revision; mandatory final AppSec and final accessibility review for UI changes |
| Task | draft → approved → in-progress → in-review → done | Listed in approved plan at current revision; dependencies done; plan started before task starts; local RED/GREEN/QA evidence and individual commit before completion; no staff code-review approval |

`done` and `ready-for-pr` distinguish task completion and PR eligibility from merge. Plan review states can return to in-progress for fixes, clearing both final approvals. A scope/design change uses `DOCUMENT draft --write` to increment revision and clear approvals, then repeats the normal sequence. Completed documents cannot reset; create follow-up work. Update child parent_revision values only after reconciling the new parent scope, and reset affected plans for fresh signoffs. Never silently update revisions just to pass a gate.

## Three AppSec strengths

1. **Epic concerns:** EM assesses explicit auth/data/external flags and concern IDs. Any flag/concern requires AppSec triage approval with notes. Low-risk epics can record not-required with a rationale. QA always participates. This reconciles circulation with conditional AppSec involvement: every epic gets a documented routing decision; only relevant ones require auditor participation.
2. **Plan approval:** Principal always signs first. The plan's own boundary flags, security concerns, or nonempty touches_concerns require AppSec plan approval. A flagged epic does not automatically require every plan to touch its concerns: document unaffected concerns in the plan body. False flags are deliberate assertions, not a validator's static analysis of code. Uncertainty must be resolved by AppSec.
3. **Final review:** After all tasks and the full QA bar, code_review and appsec_review approval objects are always required before the PR. not-required is invalid for either. Both must reference the same 40-character review_commit; AppSec's date cannot precede code review's date. The transition into in-appsec-review requires code review first. Every `review_comments` entry must be resolved and verified by that final code reviewer on the same review_commit; an open comment, an unverified fix, or verification against an earlier commit blocks the transition.

Before PR creation the validator checks the reviewed commit is an ancestor of HEAD, no tracked implementation differences exist since that commit, and no untracked files remain. `epics/` and `project/` are reserved for governance metadata and excluded from that implementation comparison, allowing approval records to be committed after code review. Never put application code there. Changes outside these directories, including rebases that change the reviewed ancestry, require a new final code review after all outstanding comments are resolved, followed by the required final reviews. Commit all evidence before the PR so reviewers and CI see it.

## Accessibility review for UI changes

The epic and plan must explicitly set `accessibility.ui` and explain the decision. When true, an independent accessibility reviewer records `accessibility` approval for the epic’s WCAG 2.2 AA requirements and, after Principal/AppSec plan signoff, for the plan before implementation. Following code review and mandatory AppSec review, the reviewer validates the same implementation commit for keyboard operation, focus, semantic structure/ARIA, labels and errors, contrast, screen-reader behavior, and zoom/reflow. The separate final `accessibility_review` approval must carry the plan revision and reviewed commit; it is required for PR eligibility only when the plan has UI changes.

## Tier 3 assessment binding

Tier 3 preflight is available only to a registered isolated worktree, distinct from the coordination root, on the owning `epic/EPIC-NNN` branch. Its immutable first assessment binds one approved plan ID/revision, one task listed by that plan, the branch, and accepted-policy/effective-role provenance. `check-pr.mjs` verifies that exact plan/task/branch/provenance binding from committed content; CI cannot independently prove historical local worktree registration. Configured-role evidence is fail-closed and limited to principal, qa, appsec, and accessibility_reviewer. Those checks add evidence and do not weaken Principal plan approval, QA epic approval, AppSec plan/final review, independent final code review, or conditional UI accessibility triage, plan approval, and final review.

## Enforcement boundary

These are cooperative file gates, wired into required skill wrappers and a PR CI check. They cannot authenticate handwritten identities, prove that a test log is true, detect an undisclosed boundary, or prevent an arbitrary shell command from opening a PR. YAML editing can bypass local state history; dates only establish day-level order. The repository is PR-only, but no local validator can push or merge. Do not claim this is a tamper-proof access control system.

For enforced merge policy, configure the host to require `workflow / gates`, independent code-owner/security reviews and no direct pushes to the protected base branch. Protect scripts, workflow definitions, AGENTS.md and approval records from unreviewed edits. The included workflow validates changed epic plans for PR eligibility; template-only changes run tests. Host configuration remains a repository-admin step after pushing. Local pre-PR blocking comes from agent instructions and governed-ship; server-side CI runs after a PR exists.
