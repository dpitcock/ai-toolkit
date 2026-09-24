---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: task
id: TASK-001
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: []
evidence:
  red: "2026-09-24: node --test tests/slack-workspace-template.test.mjs failed
    with ENOENT for config/slack-workspace.example.yml."
  green: "2026-09-24: node --test tests/slack-workspace-template.test.mjs passed
    (1 test); git diff --check passed."
  qa: "2026-09-24: QA-001 contract test verified Codex route and absence of
    mutable state. QA-003 manual guide review confirmed routing, PR, daily
    summary, safety, action-required, and Codex-only matrix coverage."
  commit: "013efa29ef9e79db2669d612fc01a547d092ca86"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
---

# TASK-001

## Acceptance criteria
- `config/slack-workspace.example.yml` parses to one `example-repository` production
  Codex workspace whose channel name is `ws-example-repository-codex` and whose daily
  summary time is `09:00` in `America/New_York`.
- The descriptor contains no credential, channel ID, or session ID.
- `docs/slack-control-plane.md` documents the external control plane: explicit routing,
  durable state, turn/PR/daily-summary behavior, safety boundaries, action-required
  notification, and the Codex-only capability matrix.
- `docs/workflow.md` links to the guide as an optional external integration without
  altering local agent instructions.

## Files and dependencies
- Create `tests/slack-workspace-template.test.mjs`.
- Create `config/slack-workspace.example.yml`.
- Create `docs/slack-control-plane.md`.
- Modify `docs/workflow.md`.
- No task dependencies.

## TDD steps
1. Add a Node test that parses the descriptor and deep-compares the complete workspace
   and daily-summary objects; assert that `channel_id`, `session_id`, and `credential`
   are absent. This catches an invalid route or committed live operational state.
2. Run `node --test tests/slack-workspace-template.test.mjs`; it must fail with ENOENT
   before the descriptor is created.
3. Create the minimal YAML descriptor with repository `example-repository`, environment
   `production`, provider `codex`, channel `ws-example-repository-codex`, timezone
   `America/New_York`, and `daily_summary.local_time: "09:00"`.
4. Write the guide and optional workflow link. Prose is human documentation and receives
   manual QA rather than a brittle source-text test.
5. Run `node --test tests/slack-workspace-template.test.mjs` and `git diff --check`;
   both must pass. Refactor only after green.

## QA mapping
- QA-001: focused descriptor contract test with observed RED/GREEN evidence.
- QA-003: manual guide review confirms all specified control-plane boundaries and the
  Codex-only matrix; run `git diff --check`.

## Handoff
Commit only the task files with `feat: add Slack control-plane template`. Record the
actual RED/GREEN output, manual QA result, and commit SHA in `evidence` before moving
to in-review.
