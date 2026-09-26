---
kind: task
id: TASK-016
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-015.md]
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

# TASK-016: Workflow documentation and scaffold packaging

## Acceptance, interfaces, and verification

Files: `docs/workflow.md`, `docs/roles.md`, `docs/gates.md`,
`docs/slack-control-plane.md`, `docs/agent-details/AGENT-TESTING.md`,
`tests/scaffold.test.mjs`.
Document authoritative versus cooperative evidence, event commands, migration,
new stage boundaries, and transport limitations. Package shared policy assets
in generated adopters; preserve UI review floors and conditional Cline handoffs.
RED/GREEN: `node --test tests/scaffold.test.mjs` for packaged-policy and
real entrypoint invocation assertions; documentation checks are supplementary.
QA-GOV-009.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
