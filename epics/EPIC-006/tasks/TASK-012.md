---
kind: task
id: TASK-012
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-011.md]
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

# TASK-012: Adapter and host integration

## Acceptance, interfaces, and verification

Files: `AGENTS.md`, `CLAUDE.md`, `.clinerules/00-governance.md`,
`skills/governed-plan/SKILL.md`, `skills/governed-build/SKILL.md`,
`skills/governed-ship/SKILL.md`.
Require executable event checks at agent dispatch boundaries; preserve native
host protections and tool-specific limits. Tests/pushes never launch reviews.
Use Agent Alert for authorized agent messaging and gh-identity for completed
independent verdicts. A Slack message/prefix is never an approval credential.
Verify these reversible guidance edits against the executable entrypoint tests
from TASK-011; document a fresh session invoking the gate before dispatch.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
