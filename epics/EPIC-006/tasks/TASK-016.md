---
kind: task
id: TASK-016
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-015.md ]
evidence:
  red: "2026-09-26: node --test tests/scaffold.test.mjs: 3 passed, 4 failed; three
    generated adopters lacked policy/task-tier-defaults.yaml and supplementary
    adapter guidance lacked the exported entrypoint. Local log
    /tmp/task016-red.log."
  green: "2026-09-26: node --test tests/scaffold.test.mjs: 10 passed, 0
    failed/skipped; packaged runWorkflowEvent dispatch persists authorized
    delivery and standalone environment identity is denied. Local log
    /tmp/task016-green.log."
  qa: "QA-GOV-009: generated adopters package shared policy and complete script
    dependencies while excluding instance state; real embedded entrypoint and
    existing Tier 1/2/3 routes pass. Dispatch/host-event regressions: 57 passed,
    0 failed/skipped. git diff --check passed."
  commit: "1408e4e57f039c08656450ad8c00093388d62619"
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

- [x] Run the named regression and record actual RED evidence.
- [x] Implement this contract and run the focused GREEN command.
- [x] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [x] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.

## Verification and release handoff

Developer: `/root/implement_task016`, 2026-09-26. Implementation is commit
`1408e4e57f039c08656450ad8c00093388d62619`; evidence is a separate commit.
The bounded TASK-012 guidance correction uses the existing exported embedding
interface, actual out-of-band harness identity and synchronous callbacks.
The standalone CLI deliberately denies identity claims from environment data.
No acceptance, history, plan revision, immutable assessment or completed task
record was rewritten; no host configuration was changed.

The first GREEN attempt exposed an obsolete scaffold assertion for the legacy
`task_tiers` shape. The corrected assertion preserves its original safety bar
against the new generated `task_tier: tier_1` / `direct_merge: false` policy.
The generated fixture executes the packaged exported entrypoint with test-only
identity/authorization, then inspects persisted delivery; it is not actual
session activation. Its enclosing Tier 3 test retains the existing CI skip
when locally installed upstream skills are unavailable; this local run skipped
nothing. Other entrypoint tests run separately without that scaffold condition.

Additional command:
`node --test tests/workflow-event.test.mjs tests/host-review-events.test.mjs`
passed 57 tests (0 failures/skips), log `/tmp/task016-regression.log`.
Documentation checks supplement behavior and cover policy/cooperative evidence,
exact-head host status, role ordering, UI floors, transport ambiguity, Cline
handoffs and post-integration migration/completion requirements.

The root controller owns TASK-013, full QA, independent final reviews and release
work. Its read-only release inspection identified post-merge CLI/admission
integration gaps for bounded follow-up before full lifecycle verification.
This task does not claim those gaps fixed, migration accepted, native host
protection installed, integrated activation verified or QA-GOV-010 complete.
