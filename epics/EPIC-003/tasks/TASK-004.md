---
kind: task
id: TASK-004
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 13
depends_on: [ tasks/TASK-003.md ]
evidence:
  red: "2026-09-25: four new legacy-migration integration cases failed before
    implementation, covering preservation/retirement, matching values,
    conflict/secret refusal, and symlink/source drift."
  green: "2026-09-25: node --test tests/init-workspace.test.mjs passed 10/10; it
    exercised real temporary repositories and the CLI."
  qa: "2026-09-25: npm test passed 31/31 and git diff --cached --check was clean
    before the implementation commit. Legacy values and unrelated files were
    preserved until acceptance; conflicting/secret content, symlinks, and
    post-proposal source drift refused without retiring the descriptor;
    retirement occurred only after acceptance and retry remained idempotent."
  commit: "912818c06b333b4e9cc48d2d20c7baef1ffe5d13"
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
