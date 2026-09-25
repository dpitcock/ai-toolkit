---
kind: task
id: TASK-004
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-003.md ]
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

# TASK-004: Migrate legacy workspace values safely

## Acceptance criteria

- Existing Slack descriptor values contribute repository, environment,
  provider, channel, timezone, and summary time to the unified proposal;
  unrelated legacy files remain byte-for-byte unchanged.
- Conflicting old/new values, unsafe paths, symlinks, or unexpected config
  content stop with a precise error and no partial migration.
- The old active descriptor is retired only after human acceptance, without
  an automatic commit or secret import.

## Files and dependencies

Modify `scripts/init-workspace.mjs` and `tests/init-workspace.test.mjs`.
Construct legacy files inside temporary test repositories. Depends on
TASK-003.

## TDD steps

1. Add integration tests for a legacy `config/slack-workspace.example.yml`,
   custom Slack values, conflicting `config/workspace-config.yaml`, source
   drift after proposal, and a symlink/path escape. Assert source files and
   history are unchanged on error and before acceptance.
2. RED: run `node --test tests/init-workspace.test.mjs`; expect the new
   preservation/conflict cases to fail.
3. In `propose`, map allowlisted old fields and rename `channel_name` to
   `slack_channel_name`, then validate with TASK-002's parser. In `accept`,
   retire only the exact validated old path after the accepted new file and
   history exist; keep retries idempotent. Resolve containment and ownership
   before any move/overwrite.
4. GREEN: run focused test, `npm test`, and `git diff --check`.
5. Commit as `feat: migrate legacy Slack workspace values`.

## QA and security mapping

QA-302/303, SEC-302/303. Exercise filesystem boundaries in temporary
repositories, not mocks of the migration helper.

## Handoff

Record RED, GREEN, full QA, commit SHA, one preservation case, and one
conflict refusal.
