---
kind: task
id: TASK-002
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-001.md ]
evidence:
  red: "2026-09-24: scaffold test first exposed fixture leakage of the active
    EPIC-001; after isolating the fixture to EPIC-XXX, it failed at the intended
    missing descriptor assertion."
  green: "2026-09-24: node --test tests/scaffold.test.mjs passed; npm test passed
    14/14 tests; git diff --check passed."
  qa: "2026-09-24: QA-002 verified the descriptor in the isolated worktree. QA-003
    verified the full suite and that verification docs label this
    template/configuration coverage, not a live Slack integration."
  commit: "4bbbe67b721999ee37cdfbb004d1ae9abcd29188"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
---

# TASK-002

## Acceptance criteria
- The temporary repository fixture in `tests/scaffold.test.mjs` includes `config`.
- A newly created isolated EPIC-001 worktree contains
  `config/slack-workspace.example.yml`.
- The full repository test suite remains green and verification documentation describes
  this as template/configuration coverage, not a live Slack integration test.

## Files and dependencies
- Modify `tests/scaffold.test.mjs`.
- Modify `docs/verification.md`.
- Depends on `tasks/TASK-001.md` because the descriptor is the source asset.

## TDD steps
1. Add an assertion after the existing `TASK-001.md` worktree assertion that the
   descriptor exists at `config/slack-workspace.example.yml`.
2. Run `node --test tests/scaffold.test.mjs`. When executed from an active epic
   worktree, isolate the fixture to `epics/EPIC-XXX` rather than copying live epics;
   otherwise bootstrap sees an existing EPIC-001 before the assertion runs.
3. Confirm the focused test then fails at the descriptor assertion, and add `config` to
   the fixture copy list while preserving all other fixture inputs.
4. Update verification documentation to state the scaffold test's descriptor coverage
   and boundary.
5. Run `node --test tests/scaffold.test.mjs`, `npm test`, and `git diff --check`; all
   must pass. Refactor only after green.

## QA mapping
- QA-002: observed RED/GREEN scaffold regression test.
- QA-003: full `npm test`, whitespace check, and verification-documentation boundary.

## Handoff
Commit only the task files with `test: retain Slack workspace descriptor in scaffolds`.
Record actual RED/GREEN/QA output and the individual commit SHA before moving to
in-review.
