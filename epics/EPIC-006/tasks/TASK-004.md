---
kind: task
id: TASK-004
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-014.md ]
evidence:
  red: "2026-09-26: node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs failed as expected before implementation: 5
    new autopilot regressions failed because config.workflow was not allowed and
    new proposals omitted workflow evidence."
  green: "2026-09-26: node --test tests/workspace-config.test.mjs
    tests/init-workspace.test.mjs passed: 49 tests, 0 failed."
  qa: "QA-GOV-004 policy portion verified: explicit true and false remain distinct
    from legacy omission, root/worktree sources expose workflow.autopilot
    provenance, and a policy candidate cannot carry self-declared delegated
    owner acceptance. The existing accepted-policy transaction records root and
    worktree changes; trusted actor authentication remains the TASK-006/011
    harness boundary."
  commit: 2436c58b4233ea27fb89abc589dc0a53da624e0c
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
