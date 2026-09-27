---
kind: task
id: TASK-002
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-001.md ]
evidence:
  red: "node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs:
    failed before implementation because workspaceTierDefinition was not
    exported and the new migration/default-selection assertions were
    unsupported."
  green: "node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs: 45 passed, 0 failed."
  qa: "QA-GOV-001/002/003: legacy normalized digests and history remain valid;
    accepted migration records definition version/digest; conflicting syntax,
    invalid or stale provenance, and worktree tier weakening fail closed;
    default selection is tier_1 with direct_merge false."
  commit: "9874775"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-002: Workspace tier selection and migration

## Acceptance, interfaces, and verification

Files: `scripts/lib/workspace-config.mjs`, `scripts/lib/workspace-history.mjs`,
`scripts/init-workspace.mjs`, `tests/workspace-config.test.mjs`,
`tests/init-workspace.test.mjs`.
Accept `task_tier` and `tier_overrides` without injecting new fields into legacy
normalization. New records bind definition provenance; old digests still verify.
Resolve the configured minimum and reject competing old/new declarations.
Use existing propose/apply-change paths for migration, preserving owner names.
RED/GREEN: `node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs`.
Assertions: legacy digest fixtures unchanged, migration requires accepted
candidate, invalid/stale definition rejected, worktree weakening rejected.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
