---
kind: task
id: TASK-001
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 9
depends_on: []
evidence:
  red: "2026-09-24: node --test tests/scaffold.test.mjs failed 0/1; the fixture's
    hardcoded approval revision 1 was stale against project revision 2."
  green: "2026-09-24: node --test tests/scaffold.test.mjs passed 1/1 after the
    fixture used d.revision."
  qa: "2026-09-24: npm test passed 17/17; git diff --check and git diff --cached
    --check were clean."
  commit: 17453c83cded2088fc7b3a01a50e58dba89f5206
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-001: Restore revision-safe scaffold baseline

## Acceptance criteria

- The scaffold fixture approves the copied project's actual plan revision,
  preserving its independent reviewer and idempotence assertions.
- `node --test tests/scaffold.test.mjs` passes in this worktree.
- No production gate or project approval is weakened to make the test pass.

## Files and dependencies

Modify `tests/scaffold.test.mjs` only. No dependency. The current baseline
failure is the expected RED case after project revision 2.

## TDD steps

1. RED: run `node --test tests/scaffold.test.mjs`; expect stale Principal
   approval on PROJECT because the fixture hardcodes `revision:1`.
2. Confirm the test reads `d.revision` from the copied project plan. Change
   only the fixture approval to `revision:d.revision`; keep reviewer
   `Principal` distinct from fixture owner `EM`.
3. GREEN: run `node --test tests/scaffold.test.mjs`, `npm test`, and
   `git diff --check`.
4. Commit this fixture repair separately as
   `test: make scaffold approval revision-safe`.

## QA and security mapping

QA-301. The test still exercises a real temporary Git repository and
worktree. The approved gate logic is not modified.

## Handoff

Record observed RED, GREEN, full QA results, and the implementation commit
SHA in `evidence` before moving through in-review to done.
