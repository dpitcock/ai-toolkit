---
kind: task
id: TASK-005
owner: "Codex"
status: done
revision: 2
parent: ../epic-plan.md
parent_revision: 3
depends_on:
  - tasks/TASK-001.md
  - tasks/TASK-002.md
  - tasks/TASK-003.md
evidence:
  red: "RED — the missing validator export failed as expected (exit 1). The four
    original review regressions, two follow-up regressions, and forked-branch
    chronology regression failed before fixes: merge-commit code, preflight
    chronology, linked override digest, Tier 3 without a checked epic gate,
    earlier intended-file code, a merged-plan skip, and an implementation branch
    merged after preflight, plus an orphan-root implementation merged after
    preflight."
  green: "GREEN — node --test tests/check-tier2.test.mjs tests/gates.test.mjs:
    37/37 passed after fixes."
  qa: "QA — npm test: 113/113 passed. git diff --check and git diff --cached
    --check were clean. Coverage includes parent-relative merge changes,
    sequential, forked, and orphan-root implementation-before-preflight
    histories, linked accepted overrides, Tier 3 with no checked epic plan or
    only a merged-plan skip, and preservation of the existing epic gate."
  commit: 43ceb6c7238a100662b4b6c6f31b55276f09d337
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review:
    by: "/root/review_task005"
    date: "2026-09-25"
    notes: "Initial review findings and follow-up Git-history edge cases were fixed
      in separate commits. Final read-only review approved the merge and root
      commit checks, Tier 3 gate requirement, linked override handling, and
      preflight ancestry enforcement with no remaining Critical or Required
      findings."
    revision: 2
    commit: "43ceb6c7238a100662b4b6c6f31b55276f09d337"
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-005

## Acceptance criteria
- Add scripts/check-tier2.mjs exporting validateTier2Assessment and integrate it into scripts/check-pr.mjs for project/task-assessments/*.yaml without bypassing existing epic-plan checks.
- On a Tier 2 PR, reclassify the PR's actual base-to-HEAD diff and reject a changed/stale policy digest, altered initial facts compared with their first committed assessment blob, increased tier, missing PR context, malformed evidence, a self-approved required role, a reviewer matching the developer, mismatched revision/commit, or missing required approval.
- Each review and configured role approval is {by, date, notes, revision, commit}; the lightweight review also has mode set to self-check or independent. Required-role records must be independent of the developer. UI accessibilityEvidence uses the TASK-001 shape, with triage/plan reviewer records and finalReview.commit equal to the recorded reviewedCommit.
- Review evidence references reviewedCommit, the exact code commit reviewed. That commit must be an ancestor of PR HEAD; changes after it may only be task-assessment metadata under project/task-assessments. This avoids a self-referential approval SHA.
- Require a lightweight self-check or independent review record for Tier 2. Require every effective configured role that applies. For UI, the committed preflight assessment must already contain independent accessibility triage and plan evidence; the PR check additionally requires independent final-review evidence on the exact reviewedCommit. Missing/malformed staged evidence blocks Tier 2 and requires the Tier 3 route.
- Keep records explicitly cooperative: validate reviewer identity fields for consistency, but do not claim local YAML authenticates a person. Tier 3 EPIC checks remain unchanged.

## Files and dependencies
- Create scripts/check-tier2.mjs and tests/check-tier2.test.mjs; modify scripts/check-pr.mjs.
- Depends on TASK-001, TASK-002, and TASK-003.

## TDD steps
1. Add PR-fixture tests for valid Tier 2, each required role missing, author/reviewer collision, bad date/revision/commit, policy drift, altered initial evidence, UI preflight triage/plan eligibility and final-review gaps, reclassification to Tier 3, multiple assessment files, and existing epic-plan validation.

~~~~yaml
review:
  mode: independent
  by: reviewer-session
  date: "2026-09-25"
  notes: "Reviewed the contained-change diff."
  revision: 1
  commit: 0123456789abcdef0123456789abcdef01234567
~~~~

2. Run node --test tests/check-tier2.test.mjs. Expected RED: validateTier2Assessment is missing.
3. Implement strict assessment/review validation, compare initial facts to their committed baseline, run final-stage classification, and call it from check-pr when assessment records are changed. Preserve the existing changed-epic and epic-branch paths exactly.
4. Run node --test tests/check-tier2.test.mjs tests/gates.test.mjs. Expected GREEN: Tier 2 evidence is enforced while all existing epic gate tests still pass.
5. Commit only scripts/check-tier2.mjs, scripts/check-pr.mjs, and tests/check-tier2.test.mjs as feat: validate Tier 2 pull request evidence.

## QA mapping
- QA-004-TIER2: PR route, evidence integrity, applicable configured roles, and UI escalation.
- QA-004-SCAFFOLD: the existing PR workflow invokes check-pr on PR events.
- SEC-TIER-DOWNGRADE: evidence cannot be edited to lower the initial tier, lower a recomputed tier, or weaken epic checks.

## Handoff
CI continues to run the existing workflow/check-pr command. Any Tier 2 record that fails validation blocks the PR check and names the missing evidence and safe next step; Tier 3 records continue through the existing epic gate.
