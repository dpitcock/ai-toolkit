---
kind: task
id: TASK-007
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-008.md ]
evidence:
  red: "node --test tests/workspace-config.test.mjs tests/gates.test.mjs failed as
    expected with ERR_MODULE_NOT_FOUND for scripts/lib/tier3-policy.mjs; the
    review-fix cycle also produced the expected missing plan-owner rejection and
    missing provenance-contract failures."
  green: "node --test tests/workspace-config.test.mjs tests/gates.test.mjs passed:
    27 tests, 0 failures."
  qa: "Bounded full-suite groups passed: 61 and 58 tests, 0 failures. Independent
    TASK-007 review approved 99050ccc after verifying normalized plan/epic-owner
    independence, final-review commit binding, four-role provenance, and
    mandatory principal/QA/AppSec/code/AppSec/UI floors under false or exempt
    policy values. git show --check HEAD passed."
  commit: "99050ccc70978662c751aa0f9ca21c5b4075b75a"
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

- `resolveTier3Policy()` and `validateTier3RoleEvidence()` map `principal`, `qa`, `appsec`, and `accessibility_reviewer` to their exact independent evidence and preserve all mandatory floors.
- Existing accessibility evidence is required only when a named plan declares `accessibility.ui: true`; a false policy value or exemption cannot weaken that UI route.

## Files and dependencies

Create `scripts/lib/tier3-policy.mjs`; modify `scripts/lib/workspace-config.mjs`, `tests/workspace-config.test.mjs`, and `tests/gates.test.mjs`. Depends on TASK-008, which completes the required rollback after TASK-001.

## TDD steps

Add failing cases named `Tier 3 rejects missing configured-role evidence` and `Tier 3 preserves UI accessibility when policy is false`; run `node --test tests/workspace-config.test.mjs tests/gates.test.mjs` and expect unresolved imports/assertions. Implement the two exported functions for the four in-scope approval roles; rerun green and then `npm test`.

## QA mapping

QA-005-ROLE-RESOLUTION: test `principal`, `qa`, `appsec`, and `accessibility_reviewer` for missing, malformed, self-issued, stale, wrong-commit, and exemption cases, while preserving the independent final code/AppSec and conditional UI accessibility floors.
