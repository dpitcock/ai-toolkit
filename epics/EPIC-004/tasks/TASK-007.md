---
kind: task
id: TASK-007
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 3
depends_on:
  - tasks/TASK-006.md
evidence:
  red: "Baseline — node --test tests/gates.test.mjs passed 16/16 before wording
    edits because the existing validator already allowed task completion without
    staff code-review approval while blocking plan AppSec review without final
    code review; no failure was manufactured."
  green: "GREEN — node --test tests/gates.test.mjs passed 16/16 after behavior
    regression and documentation alignment."
  qa: "QA — npm test passed 117/117; git diff --check and git diff --cached
    --check were clean."
  commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-007

## Acceptance criteria
- Local workflow guidance requires independent staff code review only after all tasks and the full QA bar, on the final implementation revision before the PR.
- Task completion retains RED/GREEN/QA evidence and its implementation commit but does not require a staff code-review approval.
- Guidance requires fresh final code and AppSec reviews after any later implementation change, while allowing metadata-only approval evidence after review.
- Gate regression coverage preserves the plan-level final-review requirement and post-review implementation-diff rejection.

## Files and dependencies
- Modify `AGENTS.md`, `docs/roles.md`, `docs/workflow.md`, `docs/gates.md`, `skills/governed-build/SKILL.md`, and `skills/governed-ship/SKILL.md`.
- Modify `tests/gates.test.mjs` only if a behavior-level regression is absent.
- Depends on TASK-006 because it updates the proportional-workflow guidance introduced there.

## TDD steps
1. Add a regression proving task completion has no staff-code-review prerequisite and that final plan review still requires exact-commit code and AppSec approvals.
2. Run `node --test tests/gates.test.mjs`; capture the expected RED evidence only if the new assertion exposes a missing contract.
3. Make the smallest documentation and test changes that distinguish task-local QA from final PR code review.
4. Run `node --test tests/gates.test.mjs`, then `npm test` and `git diff --check`; record actual results.
5. Commit the implementation separately from task/plan evidence metadata.

## QA mapping
- QA-004-TIER2: proportional routes retain their exact-commit final-review protections.
- QA-004-SCAFFOLD: generated-adopter workflow guidance stays internally consistent.
- SEC-TIER-DOWNGRADE: final review remains mandatory for a final implementation revision and cannot be waived by task completion.

## Handoff
Use one implementation commit for the workflow/test change. Record RED, GREEN, QA, and commit evidence before transitioning this task through `in-review` to `done`; the plan then requires fresh final code review and AppSec review before PR eligibility.
