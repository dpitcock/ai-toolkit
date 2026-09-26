---
kind: task
id: TASK-006
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [tasks/TASK-003.md, tasks/TASK-004.md, tasks/TASK-005.md]
evidence: {red: null, green: null, qa: null, commit: null}
approvals: {principal_engineer: null, appsec: null, qa_lead: null, code_review: null, appsec_review: null, accessibility: null, accessibility_review: null}
---

# TASK-006: Verify Tier 3 in a Generated Adopter

## Acceptance criteria

- A disposable adopter accepts policy, creates a real isolated epic worktree, records a Tier 3 assessment, completes the exact governed route, and passes the PR entry validator.
- The fixture rejects shared worktree, stale policy, missing role, wrong plan, and a UI accessibility-floor bypass.

## Files and dependencies

Modify `tests/scaffold.test.mjs` and, only if necessary, `tests/check-tier2.test.mjs`. Depends on TASK-003, TASK-004, and TASK-005.

## TDD steps

Add failing cases named `generated adopter completes the Tier 3 route` and `generated adopter rejects unbound Tier 3 routes`. Run `node --test tests/scaffold.test.mjs`; add minimal fixture support; rerun green, `npm test`, and `git diff --check`.

## QA mapping

QA-005-SCAFFOLD, QA-005-WORKTREE-AND-PR, and QA-005-CI. Assert cooperative controls and host branch protection remain distinct.
