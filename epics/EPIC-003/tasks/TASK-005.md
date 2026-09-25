---
kind: task
id: TASK-005
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-004.md ]
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

# TASK-005: Resolve worktree policy and govern changes

## Acceptance criteria

- In a linked worktree, `worktree_overrides` names intentional overrides;
  unlisted fields resolve from the coordination checkout with per-field
  `root`/`worktree` provenance. Exemption list and reason override together.
  Missing, unknown, or duplicate markers fail closed.
- Changed `approvals_required` or `approvals_overrides` values cannot become
  effective without matching accepted change records. Tightening and
  relaxing both require approval; stale exemptions pause affected work.
- Provider follows the same source rule. A standalone project worktree can
  initialize and accept its own root config. A UI change still triggers
  existing accessibility review regardless of policy settings.

## Files and dependencies

Modify `scripts/lib/workspace-config.mjs`,
`scripts/lib/workspace-history.mjs`, `scripts/init-workspace.mjs`,
`tests/workspace-config.test.mjs`, and `tests/init-workspace.test.mjs`.
Depends on TASK-004.

## TDD steps

1. Use two temporary Git worktrees: root `qa:true`, linked worktree a
   different provider and `qa:false`, with only those paths marked. Assert
   unrelated fields stay sourced from root. Test inherited/overridden
   exemptions with paired reasons, malformed markers, unapproved policy,
   a stale `no UI` exemption, and a UI change attempting to waive review.
2. RED: run `node --test tests/workspace-config.test.mjs
   tests/init-workspace.test.mjs`; expect overlay/change-control cases to fail.
3. Extend `resolveWorkspaceConfig` to apply explicit marker paths after
   verified coordination-root discovery. Add CLI commands:

   ```text
   node scripts/init-workspace.mjs propose-change --root PATH --candidate PATH
   node scripts/init-workspace.mjs apply-change --root PATH --candidate PATH --by NAME --reason TEXT --digest SHA256
   ```

   `propose-change` is read-only. The agent obtains explicit human approval
   before `apply-change`; that command rejects digest drift and records the
   supplied approval. `status` rejects policy absent from accepted history.
   Do not weaken the merged accessibility gate for UI work.
4. GREEN: run focused tests, `npm test`, and `git diff --check`.
5. Commit as `feat: resolve and audit worktree policy overrides`.

## QA and security mapping

QA-304/305, SEC-301/302. Report the root/worktree source map and the
stale-exemption refusal in QA evidence.

## Handoff

Record RED, GREEN, full QA, commit SHA, and the observed source map.
