---
kind: task
id: TASK-005
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-003.md, tasks/TASK-004.md ]
evidence:
  red: "The initial documentation-contract test failed because AGENTS lacked Tier
    3 registered-worktree language; review remediation RED failed where
    governed-ship omitted ordered binding terms."
  green: "Focused scaffold documentation contract passed after aligned guidance
    and governed-ship coverage."
  qa: "npm test passed: 132 tests, 0 failures. Independent TASK-005 re-review
    approved 16834a0 after verifying all six documents and the contract test
    cover the Tier 3 route, four roles, conditional UI floors, PR-only/host
    boundary, and no ui_designer forward claim. git diff --check passed."
  commit: "16834a0"
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

# TASK-005: Document the Tier 3 Route

## Acceptance criteria

- All developer, gate, verification, governed-build, and governed-ship guidance names the same Tier 3 worktree, binding, configured-role, PR-only, and cooperative-control contract; no validator gains merge/push capability.

## Files and dependencies

Modify `AGENTS.md`, `docs/workflow.md`, `docs/gates.md`, `docs/verification.md`, `skills/governed-build/SKILL.md`, and `skills/governed-ship/SKILL.md`. Depends on TASK-003 and TASK-004.

## TDD steps

Add a failing documentation contract assertion in `tests/scaffold.test.mjs`; run it and expect missing Tier 3 binding language. Make the aligned documentation edits; rerun green, `npm test`, and `git diff --check`.

## QA mapping

QA-005-CI. Assert the output retains cooperative-control and host-protection limitations.
