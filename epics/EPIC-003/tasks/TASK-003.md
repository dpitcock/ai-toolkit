---
kind: task
id: TASK-003
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 13
depends_on: [ tasks/TASK-002.md ]
evidence:
  red: "2026-09-25: init-workspace test failed with ERR_MODULE_NOT_FOUND for
    workspace-history.mjs. A second RED case showed the frontend proposal
    rejected its normalized empty exemption reason."
  green: "2026-09-25: node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs passed 10/10 after CLI, history, and
    empty-exemption normalization."
  qa: "2026-09-25: npm test passed 27/27; git diff --check and git diff --cached
    --check were clean."
  commit: 3a39a6c44c3256ad5e46f1f8e27e3967722fe171
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-003: Propose and accept initial workspace policy

## Acceptance criteria

- `propose` creates pending `config/workspace-config.yaml` from repository
  evidence, gives a reason for each proposed approval value, and never
  commits or claims acceptance. Existing accepted configs are preserved.
- `accept` records exact digest, supplied reviewer identity, date, reason,
  and revision in `project/workspace-config-history.jsonl`; a changed config
  or missing record fails `status`/acceptance validation.
- `scripts/init-project.sh` invokes proposal creation in normal and
  `--offline` modes without automatically accepting the proposal.

## Files and dependencies

Create `scripts/lib/workspace-history.mjs`, `scripts/init-workspace.mjs`,
and `tests/init-workspace.test.mjs`; modify `scripts/init-project.sh`.
Depends on TASK-002 parser and digest. History is governance evidence, not
a second workspace configuration.

## TDD steps

1. In temporary repositories, test headless and UI-surface proposals,
   idempotence, a human-edited proposal accepted with its new digest, stale
   supplied digest, changed accepted config, and a symlinked history path.
   Assert pending policy fails `assertAcceptedWorkspaceConfig(root,config)`.
2. RED: run `node --test tests/init-workspace.test.mjs`; expect missing CLI
   or history module.
3. Implement `readWorkspaceHistory(root)`,
   `appendWorkspaceHistory(root,record)`, and
   `assertAcceptedWorkspaceConfig(root,config)`. CLI contract:

   ```text
   node scripts/init-workspace.mjs propose [--root PATH]
   node scripts/init-workspace.mjs accept --root PATH --by NAME --reason TEXT --digest SHA256
   node scripts/init-workspace.mjs status [--root PATH]
   ```

   `accept` requires an existing proposal and matching current digest. Record
   human changes relative to that proposal, reject malformed history and
   unsafe paths, and never authenticate a name from local text alone.
4. GREEN: run focused test, scaffold test, `npm test`, and `git diff --check`.
5. Commit as `feat: require acceptance of workspace policy`.

## QA and security mapping

QA-302/303, SEC-301/303. The audit record is cooperative evidence, not
authenticated identity. Checkpoint: greenfield initialization is green.

## Handoff

Record RED, GREEN, full QA, commit SHA, and the checkpoint result.
