---
kind: task
id: TASK-004
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-014.md]
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

# TASK-004: Owner-controlled autopilot config

## Acceptance, interfaces, and verification

Files: `scripts/lib/workspace-config.mjs`, `scripts/init-workspace.mjs`,
`tests/workspace-config.test.mjs`, `tests/init-workspace.test.mjs`.
Add boolean `workflow.autopilot` with field-specific source resolution.
New proposals default true; legacy omission preserves legacy checkpoint
behavior until explicit acceptance. Root/worktree changes use owner evidence.
RED/GREEN: `node --test tests/workspace-config.test.mjs tests/init-workspace.test.mjs`.
Assertions: false is retained, omission is distinct, override provenance is
reported, agents cannot supply owner acceptance by a delegated decision.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
