---
kind: epic-plan
id: EPIC-005-PLAN
owner: "Codex"
status: draft
revision: 10
parent: epic.md
parent_revision: 2
security:
  auth: false
  data: false
  external: true
  concerns:
    [
      SEC-TIER3-001,
      SEC-TIER3-002,
      SEC-TIER3-003,
      SEC-TIER3-004,
      SEC-TIER3-005
    ]
  rationale: "The plan validates local repository policy, governance records, Git
    worktree metadata, and GitHub Actions/PR context. It handles no credentials
    or user data, but it directly affects whether Tier 3 work can bypass review
    routing."
accessibility:
  ui: false
  rationale: "Repository scripts, workflow configuration, tests, and documentation
    only; no user-facing interface changes. Existing conditional UI
    accessibility controls remain a regression requirement."
touches_concerns:
  [
    SEC-TIER3-001,
    SEC-TIER3-002,
    SEC-TIER3-003,
    SEC-TIER3-004,
    SEC-TIER3-005
  ]
tasks:
  - tasks/TASK-001.md
  - tasks/TASK-002.md
  - tasks/TASK-003.md
  - tasks/TASK-004.md
  - tasks/TASK-005.md
  - tasks/TASK-006.md
  - tasks/TASK-007.md
  - tasks/TASK-008.md
review_comments: []
review_commit: null
pr_url: null
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-005 Epic Plan

**Goal:** Enforce configured Tier 3 approval policy, isolated-worktree and exact-plan binding, unified PR CI validation, and generated-adopter verification without weakening existing mandatory review or UI accessibility gates.

**Architecture:** Add one Tier 3 policy/attestation module that resolves only accepted root and linked-worktree policy, maps every configured role to explicit governance evidence, and persists immutable provenance plus the governed epic-plan identity in Tier 3 preflight evidence. The existing gate remains the source of truth for lifecycle and mandatory final reviews; the PR entry point verifies the exact assessment-to-plan binding and then calls the existing plan PR gate. CI stays thin and supplies authoritative PR base/head context to that command.

**Tech stack:** Node.js 22+, ESM, built-in `node:test`, `yaml`, `fs-ext`, Git CLI, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`; approved project scope `project/project-plan.md` revision 2; EPIC-005 revision 1.

## Global constraints

- The template repository remains PR-only. No command may merge, push, delete a branch, or claim to make local controls tamper-proof.
- Tier 3 is an adopting-repository route: a template checkout without accepted `config/workspace-config.yaml` must continue to use the established epic lifecycle for template development; generated adopters must supply accepted policy before Tier 3 validation.
- The Tier 3 approval mappings in scope are `principal`, `qa`, `appsec`, and `accessibility_reviewer`. They are additive evidence requirements and never waive Principal plan approval, QA epic approval, AppSec concern/final review, final independent code/AppSec review, or UI accessibility triage/plan/final review.
- A Tier 3 assessment must bind to one plan ID/revision, its listed approved task, its `epic/EPIC-NNN` branch, a registered linked worktree distinct from the coordination root, and immutable accepted-policy provenance. Unknown, stale, malformed, ambiguous, or self-issued evidence fails closed.
- Preserve the existing cooperative-control limitation: host branch protection and required hosted reviews, not local files, prevent an authorized user from bypassing the workflow.

## Design

`scripts/lib/tier3-policy.mjs` will provide the sole Tier 3 contract. `resolveTier3Policy({coordinationRoot, worktreeRoot, assessment, plan})` validates accepted history for both roots, uses `resolveWorkspaceConfig`, rejects the coordination checkout and non-registered/incorrect worktree branch, and returns policy digests/revisions, effective role values/sources, branch identity, and bound plan/task identity. `validateTier3RoleEvidence({policy, plan, epic, developer, reviewedCommit})` maps the in-scope configuration roles to evidence: `principal` to `approvals.principal_engineer`; `qa` to epic `approvals.qa_lead`; `appsec` to applicable plan AppSec approval plus always-required final AppSec; and `accessibility_reviewer` to existing UI-only `accessibility` and `accessibility_review`. Accessibility approvals are required only when the named plan declares `accessibility.ui: true`, regardless of the resolved policy value or exemption. Independent final code review and final AppSec remain unconditional.

Preflight will require `tier3Binding` whenever classification selects Tier 3. Its immutable first-commit fields are the normalized plan path/ID/revision, listed task path/ID, `epic/EPIC-NNN` branch, canonical worktree identity (the preflight top-level path relative to the coordination root), coordination and worktree policy digests/revisions, the resolved effective-policy digest, and a complete map of each configured role's effective value and source. `planRevision` must equal the parsed named plan's current revision at preflight and PR validation. Paths resolve inside the registered worktree; the task must be listed by that plan at the same revision. Local preflight alone proves registration, distinctness from coordination, path containment, and branch identity before writing. `check-pr` reads the immutable binding, derives the required epic ID from `HEAD_REF`, validates only the named plan under the existing `pr` gate, and recomputes accepted policy digests, the effective-policy digest, and role provenance from committed PR content. CI validates preserved evidence and committed policy but cannot prove historical local registration/path isolation; its output documents that cooperative limit. Non-Tier-3 checks retain their current route. CI supplies base/head/ref only; all policy logic remains in scripts.

## Security mapping

| Concern | Mitigation and evidence |
| --- | --- |
| SEC-TIER3-001 | Local preflight rejects coordination, unregistered, copied/nested, symlink-escaped, and wrong-branch worktrees; PR validation verifies the immutable recorded branch/path identity but cannot re-prove historical registration in CI. |
| SEC-TIER3-002 | The initial assessment persists exact plan ID/revision/task/branch; the PR check validates that named plan instead of counting arbitrary valid plans, including freshness after implementation review. |
| SEC-TIER3-003 | A single policy module maps the four in-scope approval roles to independent, revision/commit-bound evidence and preserves every current mandatory floor. |
| SEC-TIER3-004 | Accepted root/worktree and effective-policy digests/revisions, per-role sources, worktree identity, and plan binding are immutable first-commit facts; PR validation reconstructs committed policy facts and rejects ambiguity or drift. |
| SEC-TIER3-005 | Real PR-entry and generated-adopter tests cover valid Tier 3 plus shared-worktree, stale-policy, missing-role, and wrong-plan rejections. |

## Accessibility mapping

This plan has no user-facing UI. The `accessibility_reviewer` policy mapping must nonetheless preserve the current UI workflow: a Tier 3 UI plan requires independent accessibility triage, plan approval, and final review on the implementation commit. A non-UI plan cannot use config `false` or a stale exemption to weaken an applicable UI route.

## Small tasks

1. TASK-008 removes the out-of-scope optional `ui_designer` normalization, template field, and regression test from the completed TASK-001 implementation.
2. TASK-007 adds the Tier 3 policy parser and approval matrix for `principal`, `qa`, `appsec`, and `accessibility_reviewer`.
3. TASK-002 binds Tier 3 preflight evidence to a real isolated worktree, explicit plan/task shape, and immutable policy provenance.
4. TASK-003 enforces exact Tier 3 assessment-to-plan validation at the PR entry point and preserves reviewed-code freshness.
5. TASK-004 wires the unified PR command into CI and tests the workflow contract.
6. TASK-005 updates agent/gate/verification documentation to the same Tier 3 contract.
7. TASK-006 extends the generated-adopter scaffold path through valid and blocked Tier 3 routes.

## Review evidence

Staff review will cover correctness, readability, architecture, security, and performance on the final implementation revision. Mandatory AppSec review follows; neither review can be self-issued. The exact final implementation commit must be unchanged outside governance metadata before PR creation.
