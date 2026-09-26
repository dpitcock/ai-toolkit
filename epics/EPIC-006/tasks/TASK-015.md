---
kind: task
id: TASK-015
owner: "Codex"
status: in-progress
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-012.md ]
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

# TASK-015: Trusted host revalidation events

## Acceptance, interfaces, and verification

Files: `.github/workflows/workflow.yml`, create
`.github/workflows/review-gates.yml`, `tests/host-review-events.test.mjs`;
modify `scripts/check-host-reviews.mjs`.
Re-evaluate the same PR head after approval, dismissal, request-changes and
synchronize events without starting reviewers or creating commits. Publish a
stable required status bound to that exact head. Run trusted base-branch gate
code and accepted policy; never execute PR-controlled code with write tokens.
Use only scoped status-write permission, read-only repository/PR access, and
existing host protections. Candidate changes cannot weaken their own merge bar.
Bootstrap uses existing host checks and independent reviewers. Install and
verify PR-only main protection and required gate statuses once the trusted
workflow is integrated; do not complete activation while this is unavailable.
Use the current repository-admin connection without requesting new secrets.
RED/GREEN: `node --test tests/host-review-events.test.mjs tests/review-evidence.test.mjs`.
Assertions: out-of-order/duplicate events, head race, approval then dismissal,
PR-modified gate/config, missing status and identity mismatch fail closed.
QA-GOV-005/006/007/009.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
