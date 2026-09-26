---
kind: epic
id: EPIC-005
owner: "Codex"
status: awaiting-review
revision: 2
parent: ../../project/project-plan.md
parent_revision: 2
security:
  auth: false
  data: false
  external: true
  concerns:
    - SEC-TIER3-001
    - SEC-TIER3-002
    - SEC-TIER3-003
    - SEC-TIER3-004
    - SEC-TIER3-005
  rationale: "This template handles no credentials or personal data, but it
    changes the GitHub Actions/PR trust boundary and decides whether an
    adopter's major or uncertain work is routed through isolated-worktree,
    configured-role, and PR gates. A bypass, ambiguous linked policy, or unbound
    assessment would weaken governance."
accessibility:
  ui: false
  rationale: "This epic changes Node validation scripts, CI configuration, tests,
    and documentation only. It creates no user-facing application interface;
    existing UI accessibility gates must remain enforced."
qa_requirements:
  - QA-005-ROLE-RESOLUTION
  - QA-005-WORKTREE-AND-PR
  - QA-005-CI
  - QA-005-SCAFFOLD
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-005: Tier 3 Enforcement and Scaffold Verification

## Outcome and scope

Complete the remaining task-tiering deliverable from project-plan revision 2. Tier 3 work must resolve the accepted configured role policy without weakening mandatory current governance; require a registered isolated worktree and governed epic/plan route; remain PR-only; and be exercised through CI and a generated-adopter end-to-end scaffold flow. This epic depends on merged EPIC-003's workspace-config/history API and EPIC-004's classifier, preflight, and Tier 1/Tier 2 PR routing.

## AppSec concerns

- SEC-TIER3-001 (High): Tier 3 must reject the shared coordination checkout, unregistered/nested/escaped paths, unrelated linked worktrees, and branches other than the bound `epic/EPIC-NNN` branch.
- SEC-TIER3-002 (High): a Tier 3 assessment must bind one-to-one to its exact governed epic plan, revision, approved tasks, branch, scope, policy provenance, and reviewed implementation commit; another valid or merged-metadata plan cannot authorize it.
- SEC-TIER3-003 (High): each configured role must have an explicit, fail-closed evidence mapping. A false setting or exemption cannot remove mandatory QA, security-concern, final code/AppSec, or UI accessibility floors.
- SEC-TIER3-004 (Medium): CI must reconstruct root/worktree policy deterministically from immutable assessment provenance and PR commits, never ambient worktree discovery or mutable state.
- SEC-TIER3-005 (Medium): generated-adopter and PR-entry tests must cover a complete valid Tier 3 route plus representative rejections for the preceding concerns.

## QA requirements

- QA-005-ROLE-RESOLUTION: Define and test the Tier 3 approval mappings for `principal`, `qa`, `appsec`, and `accessibility_reviewer`, plus non-configurable final code/AppSec and UI accessibility floors. Cover missing, malformed, self-issued, stale, wrong-commit, and incompatible exemption evidence, including normalized identity checks. UI accessibility approval applies only when the named plan declares `accessibility.ui: true`.
- QA-005-WORKTREE-AND-PR: Require Tier 3 preflight and PR validation to reject the shared checkout, unregistered/copied/nested/removed worktrees, wrong branch, stale/ambiguous policy, unrelated or stale plan/task binding, and post-review implementation changes. Prove a valid registered worktree succeeds only with its exact accepted policy and governed plan.
- QA-005-CI: Exercise `check-pr.mjs` with realistic base/head context for valid and blocked Tier 3 routes. Assert workflow behavior for template-only changes and PR context, no merge/push/branch-delete capability in validators, and the continuing host-protection boundary.
- QA-005-SCAFFOLD: In a disposable adopter, initialize and accept policy, use `new-epic.sh` to create a real isolated worktree, create a Tier 3 assessment, complete a valid governed route, and reject representative shared-worktree, stale-policy, missing-role, and wrong-plan routes.

## Accessibility triage

No user-facing UI is changed. Existing Tier 3 UI accessibility triage, plan signoff, and final accessibility review must remain mandatory when an adopter declares UI work; this epic's non-UI status does not waive those downstream requirements.

## Dependencies and ownership

Codex owns implementation in `epic/EPIC-005`. EPIC-003 and EPIC-004 are merged dependencies. Independent QA and AppSec reviewers own triage; an independent Principal reviewer must approve the resulting plan. No push, PR creation, or merge is authorized by this epic kickoff.
