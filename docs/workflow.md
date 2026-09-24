# Project lifecycle

This repository turns a project goal into independently reviewable epics. The EM owns scope and assignment, the Principal owns technical coherence, QA defines evidence, and AppSec participates at three distinct points. Developers own implementation; independent reviewers decide whether it can ship. Read roles.md for the upstream skill used at each stage and gates.md for exact approval fields.

## Optional external Slack control plane

Projects that use an externally deployed Slack control plane can follow the
[Slack control-plane guide](slack-control-plane.md). It supplies routing and safety
contracts plus a non-secret workspace descriptor; it does not change local Codex,
Cline, or Claude instructions.

## Start a project

Use this repository as a GitHub template or clone it, then run `bash scripts/init-project.sh`. Complete the native Superpowers installation in installation.md. The script creates project/project-plan.md without overwriting an existing plan. Nothing is pre-approved.

The EM uses /spec, interview-me and idea-refine, with Superpowers brainstorming, to write scope, measurable success criteria, constraints and milestones. EM and Principal decompose the project into epics with clear interfaces and dependencies. Principal records project approval. Use the gate command to move draft → awaiting-review → approved. Commit this coordination baseline before creating worktrees.

## Define and assign an epic

The EM assigns a stable ID and owner. Load Superpowers using-git-worktrees and run `bash scripts/new-epic.sh EPIC-001` from the coordination checkout. The script verifies project approval, clean Git state and ignored worktree placement, creates branch epic/EPIC-001 in .worktrees/EPIC-001, installs validator dependencies, runs the baseline tests, and creates the epic, plan and first task from templates. A failed setup retains the worktree for diagnosis; it never silently deletes work. Use native worktree tools instead when your harness provides them, following the same checks and template copying.

Enter that worktree and run `bash scripts/install-skills.sh`. Fill epic.md, including developer owner and QA/security fields. Circulate relevant epics to AppSec for concern IDs and threat-model notes; a low-risk routing decision still needs an explicit rationale. The QA Lead uses the upstream test-engineer persona and /constraints to specify unit/integration coverage, end-to-end or abuse cases where appropriate, and special QA requests. A project CONSTRAINTS.md may hold common standards; the epic must link and enumerate its applicable QA requirements. Transition the epic through awaiting-review to approved, then in-progress.

## Plan small, then get signoff

The developer invokes governed-plan and Superpowers writing-plans. Break the epic into the smallest useful tasks: one observable behavior, exact file paths, acceptance criteria, expected failing test and passing command, relevant QA IDs, dependencies and a single implementation commit. Create each task from TASK-XXX.md.template, replace the ID, and list its path in epic-plan.md. `depends_on` uses plan-relative paths such as `tasks/TASK-001.md`. Prefer minutes of focused work per task rather than a large context containing the whole epic.

Record which AppSec concerns the plan touches and which are unaffected, plus its own auth/data/external boundaries. Principal must approve task sizing, architecture and interfaces. If sensitive, move to awaiting-appsec-signoff and obtain AppSec approval next; otherwise record not-required with rationale. The approved transition is blocked until these conditions and the epic's QA/triage approvals are satisfied.

## Build with evidence

The governed-build skill runs the gate before entering upstream subagent-driven-development. Start the plan, then each task through the validator. Superpowers owns RED/GREEN/REFACTOR and fresh task contexts. Include unit tests, required integration tests and every applicable special QA request. Commit each task's implementation separately; record its SHA and actual test results in its markdown file, then move it through in-review to done. Evidence metadata may be committed afterward to avoid a self-referential commit SHA.

Multiple developers can work different epics at once because each has a branch/worktree. Do not share working directories, mutate a shared plan file concurrently, or cherry-pick another developer's unfinished task. Within an epic the default is one task at a time. Optional parallel tasks require separate task worktrees, no unresolved dependencies or overlapping file ownership, and a developer who integrates and verifies them in order. The gate checks declared dependencies, but coordination and conflict resolution remain the developer's responsibility. A blocked epic need not block unrelated approved epics.

If scope changes, reset the affected document to draft with the validator, reconcile children to its new revision, and obtain fresh approvals. For implementation fixes during review, return the plan to in-progress; both final reviews are cleared. Re-run affected tests and reviews after conflict resolution or rebasing.

## Review and merge

Finish all tasks and run the full QA bar, then move the plan to in-review. Use the existing code-reviewer persona and code-review-and-quality skill for five axes: correctness, readability/simplicity, architecture, security and performance. Superpowers requesting-code-review and receiving-code-review coordinate feedback. Set review_commit to the full implementation SHA and record staff code_review approval for it.

Only then move to in-appsec-review. Use appsec-gate with the existing security-auditor for the mandatory pre-merge pass, regardless of whether earlier AppSec involvement was waived. Record appsec_review for the same SHA. Move to ready-for-pr; commit metadata; governed-ship runs the `pr` gate immediately before opening a PR. Include the epic plan, QA evidence, findings and both approvals in the PR description.

Use finishing-a-development-branch for verification and branch cleanup, choosing the PR route. Host checks and configured required reviewers must pass. Re-run the gate before merging; merge through the PR. After the host confirms it, record pr_url and transition the epic plan, then the epic, to merged in a metadata follow-up. Do not delete other developers' worktrees. The EM tracks completed epics against project success criteria and milestones.
