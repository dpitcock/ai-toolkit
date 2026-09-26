---
kind: task
id: TASK-000
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: []
evidence:
  red: "node --test tests/scaffold.test.mjs: 3 generated-adopter cases failed
    because copied workspace acceptance history had no matching config."
  green: "node --test tests/scaffold.test.mjs: 8 passed, 0 failed."
  qa: "QA-GOV-003 and QA-GOV-009: adopter seed excludes instance
    config/history/transaction/lock/assessments and each fixture accepts its own
    policy."
  commit: "7f600f1"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-000: Isolate generated adopter policy state

## Acceptance, interfaces, and verification

Files: `tests/scaffold.test.mjs`.
The baseline has three failures because fixtures copy workspace-specific
acceptance history while omitting its config. Exclude the current instance's
config history/transaction/lock and assessments from generated adopter seeds;
preserve templates and generate each adopter's own accepted fixture policy.
RED/GREEN: `node --test tests/scaffold.test.mjs`.
Assert fresh initialization and both proportional routes from independent
adopter state. QA-GOV-003/009; preserve all existing assertions.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
