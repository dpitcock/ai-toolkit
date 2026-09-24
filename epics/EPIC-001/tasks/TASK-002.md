---
kind: task
id: TASK-002
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [tasks/TASK-001.md]
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
2. Run `node --test tests/scaffold.test.mjs`; it must fail because the fixture copy list
   does not include `config`.
3. Add `config` to the fixture copy list, preserving all existing entries.
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
