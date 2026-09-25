---
kind: task
id: TASK-007
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 9
depends_on: [ tasks/TASK-006.md ]
evidence:
  red: "2026-09-25: node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs failed 2/20 new cases: orphaned change history
    was trusted and a stale accepted UI exemption blocked the corrective
    candidate. A later linked-status case failed because status treated the
    overlay as the coordination root."
  green: "2026-09-25: node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs passed 21/21 after ordered history validation,
    candidate-only UI applicability validation, and discovered
    coordination-root/overlay status verification."
  qa: "2026-09-25: npm test passed 38/38 and git diff --check was clean. Accepted
    linked status reported approvals_required.qa from worktree and
    workspace.provider from root; unaccepted overlay status failed.
    Orphaned/tampered history, UI drift before initial acceptance, and
    stale-policy correction were all exercised with real temporary
    repositories/worktrees."
  commit: "e514cd9dbb003d6013e2b9b04ccc4fc5f5126aed"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-007: Enforce accepted workspace policy

## Acceptance criteria

- A linked worktree can use marked overrides only after both the coordination
  configuration and the worktree overlay have matching accepted histories;
  `status` discovers the coordination checkout and reports the accepted,
  effective source map. Unaccepted, copied, or drifted overlays fail closed.
- Workspace history rejects orphaned acceptances/changes, proposal snapshots
  with a mismatched digest, and skipped or repeated revisions. A later change
  must follow a valid initial proposal/acceptance chain.
- A stale no-UI policy blocks `status` and work, but a reviewed candidate that
  restores both UI roles and removes UI exemptions can be proposed and applied.
  Initial acceptance also checks current UI applicability before recording
  acceptance or retiring a legacy descriptor.

## Files and dependencies

Modify `scripts/lib/workspace-config.mjs`,
`scripts/lib/workspace-history.mjs`, `scripts/init-workspace.mjs`,
`tests/workspace-config.test.mjs`, and `tests/init-workspace.test.mjs`.
Depends on TASK-006 and resolves CR-001 through CR-004.

## TDD steps

1. Add real temporary-Git-worktree tests for an accepted root plus an
   unaccepted overlay, then a locally proposed/accepted marked overlay,
   copied-overlay drift, and linked `status` provenance. Add history fixtures
   for orphaned acceptance/change, proposal-digest tampering, and revision
   gaps. Add CLI tests for UI appearing after proposal and for correcting a
   stale accepted headless policy with a candidate requiring both UI roles.
2. RED: run `node --test tests/workspace-config.test.mjs
   tests/init-workspace.test.mjs`; expect the accepted-source, sequence, and
   stale-policy correction cases to fail.
3. Verify the coordination root with Git worktree metadata. Keep schema
   resolution separate from accepted-policy enforcement; `status` must verify
   the accepted root and, for a linked worktree, its locally accepted overlay
   before reporting effective values. Validate history as an ordered chain.
   Acceptance/change commands must check candidate UI applicability but permit
   a valid accepted stale baseline to be corrected. Initial acceptance must
   validate current applicability before history append or legacy retirement.
4. GREEN: run the focused tests, `npm test`, and `git diff --check`.
5. Commit as `fix: enforce accepted workspace policy`.

## QA and security mapping

QA-302/304/305 and SEC-301/302. Use real filesystem and Git worktree fixtures,
not mocks. Record the root/worktree accepted source map, stale-policy
correction, and history-chain refusal in QA evidence.

## Handoff

Record RED, GREEN, full QA, implementation commit SHA, and resolutions for
CR-001 through CR-004. The final reviewer must verify each finding on the
post-fix review commit.
