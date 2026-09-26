---
kind: task
id: TASK-005
owner: "Codex"
status: in-progress
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-003.md, tasks/TASK-004.md ]
evidence: { red: null, green: null, qa: null, commit: null }
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
