---
kind: task
id: TASK-006
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-005.md ]
evidence:
  red: "2026-09-26: node --test tests/workflow-authorization.test.mjs failed as
    expected before implementation because
    scripts/lib/workflow-authorization.mjs did not exist."
  green: "2026-09-26: node --test tests/workflow-authorization.test.mjs passed: 8
    tests, 0 failed."
  qa: "QA-GOV-004 verified: authorization binds repository, branch, scope,
    actions, completion criterion, accepted policy digest/definition and
    root/worktree acceptance references. A trusted harness is required for actor
    and owner-decision identity; raw actor claims and self-authorization fail.
    Disabled autopilot delegates, while stale policy or authorization blocks
    only the affected action. Restricted access, cost, deploy, and destruction
    effects require a covering trusted owner decision, and this module does not
    grant tool permissions or action items."
  commit: 969e4be76f6e31c39b41a8f22503140727eaef2d
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-006: Scoped routine authorization

## Acceptance, interfaces, and verification

Files: create `scripts/lib/workflow-authorization.mjs`,
`tests/workflow-authorization.test.mjs`.
Interface: `decideAction({authorization,action,policy,actor})` returns continue,
delegate, or human-needed with reason. Bind authorization to repository,
branch, scope, allowed actions, and completion criteria. Owner decisions may
authorize a specific otherwise restricted action; routine authority cannot.
Bind accepted effective policy digest/definition version and root/worktree
acceptance references. Actor/owner authority comes from the trusted harness
session, never from an event's self-declared actor string. Raw CLI records are
cooperative evidence only; they cannot authenticate or elevate an owner.
RED/GREEN: `node --test tests/workflow-authorization.test.mjs`.
Assertions: routine autopilot creates no action item; disabled mode delegates;
self-authorization, scope expansion, new access/cost/deploy/destruction fail
without covering owner authority. Tool permissions remain independently enforced.
Assert stale policy/authorization blocks only affected actions in both modes;
other existing authorized actions remain available. QA-GOV-004.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
