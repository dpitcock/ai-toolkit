---
kind: task
id: TASK-007
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 9
depends_on: [tasks/TASK-008.md]
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

# TASK-007: Resolve the Tier 3 Configured-Role Matrix

## Acceptance criteria

- `resolveTier3Policy()` and `validateTier3RoleEvidence()` map each configured role to its exact independent evidence and preserve all mandatory floors.
- A UI plan requires the existing accessibility evidence; a non-UI plan with an effective UI-only role needs an accepted exemption.

## Files and dependencies

Create `scripts/lib/tier3-policy.mjs`; modify `scripts/lib/workspace-config.mjs`, `tests/workspace-config.test.mjs`, and `tests/gates.test.mjs`. Depends on TASK-001.

## TDD steps

Add failing cases named `Tier 3 rejects missing configured-role evidence` and `Tier 3 preserves UI accessibility when policy is false`; run `node --test tests/workspace-config.test.mjs tests/gates.test.mjs` and expect unresolved imports/assertions. Implement the two exported functions; rerun green and then `npm test`.

## QA mapping

QA-005-ROLE-RESOLUTION: test every configured role for missing, malformed, self-issued, stale, wrong-commit, and exemption cases, while preserving the independent final code/AppSec and conditional UI accessibility floors.
