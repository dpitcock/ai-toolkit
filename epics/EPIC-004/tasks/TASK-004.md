---
kind: task
id: TASK-004
owner: "Codex"
status: done
revision: 2
parent: ../epic-plan.md
parent_revision: 2
depends_on:
  - tasks/TASK-001.md
  - tasks/TASK-003.md
evidence:
  red: "Initial focused run before implementation failed before assertions with
    ERR_MODULE_NOT_FOUND because scripts/check-tier1.mjs did not exist. Review
    regressions then reproduced parent-directory swap and hard-link cases that
    the initial writer accepted; both were fixed."
  green: "node --test tests/check-tier1.test.mjs: 11/11 passed; npm test: 91/91
    passed."
  qa: "Verified exact one-file Tier 1 diff, false/omitted policy PR routing,
    linked accepted policy provenance, stale config and immutable-fact refusal,
    empty/expanded/UI/unknown-risk escalation, read-only Git boundary, host-rule
    warning, parent-path swap containment with restoration, and hard-link
    refusal. git diff --cached --check clean."
  commit: "7e09dd0138f3a906f1081b4ec4c9d0eba32ff301"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review:
    by: "/root/review_task004"
    date: "2026-09-25"
    notes: "Initial review found parent-path swap and hard-link write risks; added
      descriptor-bound writes, recovery, and single-link refusal with regression
      tests. Re-review found no remaining Critical or Important issues. Minor
      limitation: in-place writes are not crash-atomic; synchronous failures
      restore the original bytes and the committed initial record is the
      recovery source."
    revision: 2
    commit: "7e09dd0138f3a906f1081b4ec4c9d0eba32ff301"
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-004

## Acceptance criteria
- Add scripts/check-tier1.mjs and a testable checkTier1 API that reads a persisted assessment, current accepted policy, its recorded starting commit, the first committed assessment blob, and the actual Git diff.
- Reclassify with actual files and the original risk/scope answers. Refuse stale config digests, malformed evidence, empty diffs, extra files, any result above the recorded Tier 1, any UI/high-risk/unknown input, or changes to the original preflight answers. Append the final check result to the assessment record without replacing its initial evidence.
- Report that direct merge is eligible only when the accepted task_tiers.tier_1_direct_merge value is true; otherwise keep the PR route. Always state that compatible host rules are a separate adopter responsibility.
- The command may validate, append final assessment metadata, and print; it must use only read-only Git operations and expose no merge, push, branch-delete, PR-bypass, or application-file mutation operation.

## Files and dependencies
- Create scripts/check-tier1.mjs and tests/check-tier1.test.mjs.
- Depends on TASK-001 and TASK-003.

## TDD steps
1. Build temporary Git fixtures with an accepted config and committed initial assessment record. Add passing-path tests plus changed-file expansion, stale digest, edits to initial risk/tier/start commit, unknown risk, UI, and default-off policy cases. Add a side-effect-boundary test using a read-only Git adapter that rejects any mutating command or operation.

~~~~sh
node scripts/check-tier1.mjs --assessment project/task-assessments/quick-fix.yaml
~~~~

2. Run node --test tests/check-tier1.test.mjs. Expected RED: checkTier1 is missing.
3. Implement final-diff collection using the recorded start commit, locate and verify the initial assessment commit/blob, exclude only the assessment record itself, call classifyTask at final stage, compare with the recorded tier, append a final check result without changing preflight facts, and print a safe next route on escalation. Route Git access through an injected read-only adapter with no mutation API.
4. Run the focused tests. Expected GREEN: Tier 1 succeeds only for its exact bounded one-file case and never invokes a merge/push command.
5. Commit only scripts/check-tier1.mjs and tests/check-tier1.test.mjs as feat: enforce Tier 1 pre-merge checks.

## QA mapping
- QA-004-TIER1: final diff, expansion, opt-in, tampered initial evidence, and explicit absence of mutation/merge/push/branch-delete operations.
- SEC-TIER-DOWNGRADE: changed or stale evidence cannot preserve a lower tier.

## Handoff
When any final fact raises the tier, report the required Tier 2 or Tier 3 path and leave the branch unchanged. Do not rewrite the original assessment or pretend host rules were checked.
