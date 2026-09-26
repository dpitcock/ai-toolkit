---
kind: task
id: TASK-011
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-010.md ]
evidence:
  red: "2026-09-26: node --test tests/workflow-event.test.mjs
    tests/preflight.test.mjs failed as expected because
    scripts/workflow-event.mjs did not exist."
  green: "2026-09-26: node --test tests/workflow-event.test.mjs
    tests/preflight.test.mjs passed 11/11 after implementation."
  qa: "QA-GOV-004/009: the focused sequence proves internal policy/repository
    resolution, trusted harness-only identity, exact branch/scope binding,
    idempotent deliveries, serialized epic admission, completion fail-closed
    behavior, and both autopilot modes without shell execution or credentials."
  commit: "bd54a02e12d90075064a634653bf15868af8a6c9"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-011: Agent execution entrypoint

## Acceptance, interfaces, and verification

Files: create `scripts/workflow-event.mjs`, `tests/workflow-event.test.mjs`;
modify `scripts/new-epic.sh`, `scripts/preflight.mjs`.
CLI: `node scripts/workflow-event.mjs EVENT --root PATH` with bounded JSON stdin.
Resolve policy and repo identity internally, lock state, validate the event,
and emit a structured action for the harness. Wire epic start, task dispatch,
review readiness, merge eligibility and completion to the same policy core.
Do not execute caller-provided shell commands or mint credentials.
Events may reference authorization IDs but cannot establish actor identity,
owner acceptance, or reviewer independence. The harness supplies its assigned
actor and existing authority reference; recheck branch/worktree registration,
canonical repository, scope, policy digest, and identity on each invocation.
RED/GREEN: `node --test tests/workflow-event.test.mjs tests/preflight.test.mjs`.
Assertions: end-to-end routine sequence in both modes, mismatched branch/repo,
duplicate delivery, concurrent epic start, missing completion fail closed.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
