# Final-PR Code Review Policy

## Intent

Independent staff code review is a pre-PR quality gate, not a required
ceremony for every task or implementation commit. Developers retain task-level
RED/GREEN/QA evidence and separate implementation commits. A final reviewer
reviews the complete implementation range only after all planned work is done.

## Policy

- Do not require independent staff code-review approval for an individual task
  to become `done`, or for an intermediate implementation commit.
- Once all tasks and the full QA bar are complete, the plan moves to
  `in-review`; an independent staff reviewer evaluates the exact final
  implementation commit using the existing five-axis rubric.
- The plan records `review_commit`, `approvals.code_review`, and every actual
  review finding. Required findings must be resolved and verified by the final
  reviewer on that same review commit.
- Any later implementation change outside `epics/` and `project/` invalidates
  the final code and AppSec approvals, returns the plan to `in-progress`, and
  requires a new final code review before a new AppSec pass. Metadata-only
  approval evidence may be committed after review without invalidating it.
- Final AppSec review remains mandatory, independent, and bound to the same
  final implementation commit as code review. The template remains PR-only.

## Workflow changes

The local governed-build wrapper and lifecycle documentation must describe
task-local verification without instructing a staff code-review request per
task. Governed-ship and gates documentation remain the source of the final
review sequence: code review, AppSec review, then PR eligibility.

## Acceptance criteria

1. Workflow documentation consistently says staff code review is final-PR
   review, refreshed only after a subsequent implementation revision.
2. No task completion gate requires `approvals.code_review`.
3. Final-review gate validation still requires code review and AppSec review
   on one exact commit, and rejects implementation changes after that commit.
4. Tests cover final-review invalidation after implementation changes and do
   not impose per-task code-review approval.

## Non-goals

- Weakening task tests, task evidence, task commits, AppSec final review, or
  PR-only merge policy.
- Treating metadata-only approval commits as implementation revisions.
