---
kind: epic
id: EPIC-005
owner: "Codex"
status: merged
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
  appsec:
    by: "Codex AppSec reviewer /root/epic005_appsec_triage_v2"
    date: "2026-09-26"
    revision: 2
    notes: "Independent AppSec triage reviewed EPIC-005 revision 2, draft plan
      revision 10, TASK-001 through TASK-008, project-plan revision 2, and the
      Tier 3 design. Threat model: local preflight input (paths, Git metadata,
      policy history, assessment), committed PR content, and GitHub PR context
      cross the governance boundary; the protected asset is mandatory review/PR
      routing, not credentials or user data. SEC-TIER3-001 is addressed by
      registered linked-worktree, containment, symlink/copy/nesting, and
      bound-branch rejection; SEC-TIER3-002 by immutable
      plan/task/revision/branch binding and exact named-plan PR validation;
      SEC-TIER3-003 by fail-closed mappings for principal, qa, appsec, and
      accessibility_reviewer, preserving QA, concern, final independent
      code/AppSec, and named-plan UI accessibility floors; SEC-TIER3-004 by
      recomputing committed policy digests, effective-policy digest, and role
      provenance without ambient CI discovery; and SEC-TIER3-005 by valid and
      blocked generated-adopter/PR-entry routes. ui_designer has no forward
      policy, evidence, or UI-approval role in the revised plan; TASK-008 solely
      rolls back the completed optional parser/template/test addition. CI's
      inability to establish historical local worktree registration remains
      documented as a cooperative-control limit, with host protection required
      for enforcement. No credentials, personal data, new network service, or
      executable remote input boundary is introduced. Approval is triage-only;
      plan AppSec signoff remains required after independent Principal
      approval."
  qa_lead:
    by: "Codex QA reviewer /root/epic005_qa_triage_v2"
    date: "2026-09-26"
    revision: 2
    notes: "Independent QA triage reviewed EPIC-005 revision 2, plan revision 10,
      project-plan revision 2, and TASK-001 through TASK-008. The active Tier 3
      matrix is limited to principal, qa, appsec, and accessibility_reviewer;
      TASK-008 rolls back only the out-of-scope ui_designer parser/template/test
      change. TASK-007 covers missing, malformed, self-issued, stale,
      wrong-commit, and exemption evidence while retaining unconditional final
      code/AppSec and named-plan UI accessibility floors. TASK-002/TASK-003
      cover isolated-worktree, exact-plan, policy-provenance, and post-review
      rejection paths; TASK-004/TASK-005 retain PR-only CI and
      cooperative-control/host-protection boundaries; TASK-006 exercises valid
      and blocked generated-adopter routes. Baseline npm test passed on
      2026-09-26."
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
- SEC-TIER3-003 (High): each of the four in-scope approval roles must have an explicit, fail-closed evidence mapping. A false setting or exemption cannot remove mandatory QA, security-concern, final code/AppSec, or UI accessibility floors.
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
