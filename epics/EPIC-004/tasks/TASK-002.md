---
kind: task
id: TASK-002
owner: "Codex"
status: draft
revision: 2
parent: ../epic-plan.md
parent_revision: 2
depends_on:
  - tasks/TASK-001.md
evidence:
  red: null
  green: null
  qa: null
  commit: null
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-002

## Acceptance criteria
- Extend the strict workspace-config schema with optional task_tiers.tier_1_direct_merge; when task_tiers is present, require a boolean and reject unknown keys. A legacy accepted config that omits task_tiers remains valid and has effective direct-merge false.
- Add task_tiers.tier_1_direct_merge: false to new initializer proposals and record its human-readable reason with the proposal. Preserve the normalized shape and digest of legacy accepted configs so their existing append-only histories continue to validate.
- Enabling direct merge in an existing repository requires the existing reviewed policy-change and human-acceptance flow; neither parsing nor migration silently opts a repository in.
- Resolve the field from the accepted coordination config; do not permit a worktree override for it. The default false keeps generated repositories on their existing PR route.
- Preserve validation and output for existing workspace config, Slack values, and role settings.

## Files and dependencies
- Modify scripts/lib/workspace-config.mjs, scripts/init-workspace.mjs, tests/workspace-config.test.mjs, and tests/init-workspace.test.mjs.
- Depends on TASK-001 being done; use the classifier contract without changing it.

## TDD steps
1. Add tests proving explicit boolean task_tiers.tier_1_direct_merge parses and contributes to the digest; malformed present values fail; omitted legacy values stay absent/effectively false and preserve their previous digest. Add proposal and policy-change tests.
2. Run node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs. Expected RED: task_tiers is rejected as an unknown config field.
3. Add strict optional schema normalization and the default-false proposal with an explanation. Keep the field at the coordination root and outside worktree override paths.

~~~~yaml
task_tiers:
  tier_1_direct_merge: false
~~~~

4. Run the same focused tests. Expected GREEN: old accepted-history fixtures remain valid and invalid task-tier policy fails closed.
5. Commit only the two scripts and two focused test files as feat: add accepted Tier 1 policy.

## QA mapping
- QA-004-PREFLIGHT: policy acceptance, digest stability/drift, and default-off behavior for new and legacy configs.
- QA-004-TIER1: direct merge is never enabled by omission or malformed values.
- SEC-TIER-DOWNGRADE: no worktree override can silently enable direct merge.

## Handoff
Expose the normalized accepted field through parseWorkspaceConfig and resolveWorkspaceConfig. TASK-003 reports it and TASK-004 uses it only to report direct-merge eligibility; no script executes a merge.
