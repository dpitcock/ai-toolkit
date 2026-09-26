---
kind: task
id: TASK-006
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 13
depends_on: [ tasks/TASK-005.md ]
evidence:
  red: "2026-09-25: node --test tests/workspace-config-slack.test.mjs
    tests/scaffold.test.mjs failed 2/2 because the template and generated epic
    worktree still contained config/slack-workspace.example.yml."
  green: "2026-09-25: node --test tests/workspace-config-slack.test.mjs
    tests/scaffold.test.mjs passed 2/2 after replacing the descriptor test and
    removing the obsolete template descriptor."
  qa: "2026-09-25: npm test passed 35/35 and git diff --check was clean. Active
    docs/config path check found no slack-workspace.example or
    workspace.channel_name matches; remaining repository matches are intentional
    migration tests or historical plans/specs."
  commit: "3368847eb10d4dfa1156db14bdafa8e00babb5e3"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-006: Consolidate Slack and scaffold guidance

## Acceptance criteria

- The Slack guide uses only generated `config/workspace-config.yaml` and
  `workspace.slack_channel_name`; no second active descriptor remains in the
  template. Existing routing and safety contracts are preserved.
- The scaffold test verifies generated config, pending acceptance, isolated
  epic worktrees, and the existing conditional UI accessibility gate.
- Adoption guidance explains initial acceptance and later policy changes
  without claiming local files authenticate a person or deploying Slack.

## Files and dependencies

Modify `docs/slack-control-plane.md`, `docs/workflow.md`, and
`tests/scaffold.test.mjs`. Replace
`tests/slack-workspace-template.test.mjs` with
`tests/workspace-config-slack.test.mjs`; remove
`config/slack-workspace.example.yml` only after migration coverage exists.
Depends on TASK-005.

## TDD steps

1. Update the Slack test to run the initializer in a temporary repository,
   parse the unified config, and assert:

   ```js
   assert.equal(config.workspace.slack_channel_name,'ws-example-repository-codex');
   assert.equal(config.daily_summary.local_time,'09:00');
   ```

   Add scaffold checks for pending acceptance, accepted migration, and a UI
   plan that still needs independent accessibility approval. Preserve the
   idempotence/collision assertions.
2. RED: run `node --test tests/workspace-config-slack.test.mjs
   tests/scaffold.test.mjs`; expect old-descriptor assertions to fail.
3. Update guide/workflow instructions; remove the obsolete example only
   after its migration behavior is covered. Keep the template's own PR-only
   development rule; Tier 1 direct merge applies only to adopters whose
   accepted policy and host rules allow it.
4. GREEN: run focused tests, `npm test`, and `git diff --check`; search
   guidance for stale active `channel_name` or old-path references.
5. Commit as `docs: unify Slack workspace descriptor and governance config`.

## QA and security mapping

QA-303/305, SEC-303. Final checkpoint covers greenfield, legacy, linked
worktree, Slack, and accessibility regression paths.

## Handoff

Record RED, GREEN, full QA, commit SHA, and the exact guide/path check.
The plan cannot enter final review until all six tasks are done.
