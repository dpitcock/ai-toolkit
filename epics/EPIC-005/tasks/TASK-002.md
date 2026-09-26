---
kind: task
id: TASK-002
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-007.md ]
evidence:
  red: "Focused preflight tests first failed because tier3Binding was unknown;
    review remediation then reproduced the lifecycle gap when a draft plan
    preflight succeeded."
  green: "node --test tests/task-assessment.test.mjs tests/preflight.test.mjs
    passed: 16 tests, 0 failures."
  qa: "Bounded full-suite groups passed: 74 and 35 tests, 0 failures (125 total).
    Independent TASK-002 review approved 0f0db5a after confirming
    approved/in-progress plan and approved-task binding plus wrong-branch,
    stale, unlisted, and symlink rejection coverage. git diff --check passed."
  commit: "0f0db5a"
approvals:
  {
    principal_engineer: null,
    appsec: null,
    qa_lead: null,
    code_review: null,
    appsec_review: null,
    accessibility: null,
    accessibility_review: null
  }
---

# TASK-002: Bind Tier 3 Preflight to an Isolated Governed Worktree

## Acceptance criteria

- Tier 3 preflight requires a registered linked worktree distinct from coordination, the matching `epic/EPIC-NNN` branch, and a named current epic-plan/task.
- Persist immutable plan/task/worktree/policy provenance and reject shared, copied, nested, wrong-branch, stale, or unbound routes.

## Files and dependencies

Modify `scripts/lib/task-assessment.mjs`, `scripts/preflight.mjs`, and `scripts/lib/tier3-policy.mjs`; update `tests/task-assessment.test.mjs` and `tests/preflight.test.mjs`. Depends on TASK-007.

## TDD steps

Add failing cases named `Tier 3 rejects the coordination checkout` and `Tier 3 persists an exact plan task binding`. Run `node --test tests/task-assessment.test.mjs tests/preflight.test.mjs` and expect Tier 3 to accept the shared/unbound route; implement the minimal Tier 3-only preflight contract; rerun green and then `npm test`.

## QA mapping

QA-005-WORKTREE-AND-PR and QA-005-ROLE-RESOLUTION.
