---
kind: task
id: TASK-003
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-007.md, tasks/TASK-002.md ]
evidence:
  red: "The new exact-plan fixtures initially exposed that unrelated ready-for-PR
    plans and malformed binding provenance could pass; focused RED cases
    reproduced both review findings."
  green: "node --test tests/check-tier2.test.mjs tests/gates.test.mjs passed: 44
    tests, 0 failures."
  qa: "npm test passed: 129 tests, 0 failures. Independent TASK-003 re-review
    approved 813d4c2 after verifying exact loaded plan ID/revision equality and
    complete accepted root/worktree policy provenance equality. git diff --check
    passed."
  commit: "813d4c2c51a6ad929f2213ccfdf95f0983458517"
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

# TASK-003: Validate Exact Tier 3 Plans at PR Entry

## Acceptance criteria

- `check-pr.mjs` validates the specific plan named by every Tier 3 assessment, not any passing plan.
- It rejects unbound, unrelated, ambiguous, stale-policy, missing-role, and post-review code changes while retaining the existing ready-for-PR and final-review checks.

## Files and dependencies

Modify `scripts/check-pr.mjs`, `scripts/check-tier2.mjs`, `scripts/check-gate.mjs`, and `scripts/lib/tier3-policy.mjs`; update `tests/check-tier2.test.mjs` and `tests/gates.test.mjs`. Depends on TASK-007 and TASK-002.

## TDD steps

Add failing fixtures named `check-pr rejects a Tier 3 assessment bound to another valid plan` and `check-pr accepts its exact ready-for-PR plan`. Run `node --test tests/check-tier2.test.mjs tests/gates.test.mjs` and expect the unrelated-plan case to pass; implement the narrow binding validation; rerun green and then `npm test`.

## QA mapping

QA-005-WORKTREE-AND-PR and QA-005-CI.
