---
kind: task
id: TASK-001
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: []
evidence:
  red: "node --test tests/gates.test.mjs failed: legacy documents exposed
    undefined rather than the required null optional ui_designer approval."
  green: "node --test tests/gates.test.mjs passed: 17 tests, 0 failures."
  qa: "Backward-compatible legacy parsing and canonical epic-plan template
    coverage passed."
  commit: "21e861d"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-001

## Acceptance criteria

- Add the dedicated `approvals.ui_designer` schema to the lifecycle validator and every canonical document template.
- The new approval is independent, carries the plan revision, and does not alter existing mandatory approval requirements.

## Files and dependencies

Modify `scripts/check-gate.mjs`, `epics/EPIC-XXX/epic-plan.md.template`, and `tests/gates.test.mjs`. No dependencies.

## TDD steps

First add a failing `existing plan without ui_designer remains readable` fixture and a failing `well-formed optional ui_designer is accepted` fixture; run `node --test tests/gates.test.mjs` and expect the latter parser assertion to fail. Add the backward-compatible optional schema/template fields; rerun green and then `npm test`.

## QA mapping

QA-005-ROLE-RESOLUTION. Include malformed fields, normalized identity self-approval, stale revision/commit, accepted exemption/provenance, and UI role regression cases.

## Handoff

No implementation has started. Evidence and commit remain null until the task is approved and completed.
