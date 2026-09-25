---
kind: task
id: TASK-002
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 9
depends_on: [ tasks/TASK-001.md ]
evidence:
  red: "2026-09-25: node --test tests/workspace-config.test.mjs failed with
    ERR_MODULE_NOT_FOUND for scripts/lib/workspace-config.mjs."
  green: "2026-09-25: focused parser and resolver tests passed 3/3 after
    implementation."
  qa: "2026-09-25: npm test passed 20/20; git diff --check and git diff --cached
    --check were clean."
  commit: 345549fbfee68bc39807e9487832fcb3375d9abb
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-002: Validate the unified workspace schema

## Acceptance criteria

- A strict parser accepts the specified workspace, approval, exemption, and
  daily-summary fields. It rejects duplicate YAML keys, aliases, unknown
  roles, missing exemption reasons, non-boolean approval values, and secret
  or mutable-state keys such as `channel_id`, `token`, and `session_id`.
- A root loader reads exactly `config/workspace-config.yaml`, reports `root`
  provenance, and rejects missing/malformed files and unsafe paths.
- A canonical SHA-256 digest is stable across equivalent YAML formatting.

## Files and dependencies

Create `scripts/lib/workspace-config.mjs` and
`tests/workspace-config.test.mjs`. Depends on TASK-001's green baseline.

## TDD steps

1. Write valid and abusive YAML cases. Core interface assertions:

   ```js
   const parsed=parseWorkspaceConfig(sample,{partial:false});
   assert.equal(parsed.workspace.slack_channel_name,'ws-example-repository-codex');
   assert.equal(workspaceConfigDigest(parsed).length,64);
   assert.throws(()=>parseWorkspaceConfig('workspace: {}\nworkspace: {}\n',{partial:false}));
   ```

2. RED: run `node --test tests/workspace-config.test.mjs`; expect a missing
   module/export until the parser exists.
3. Implement `parseWorkspaceConfig(raw,{partial=false})`,
   `workspaceConfigDigest(config)`, and root-only
   `resolveWorkspaceConfig({coordinationRoot,worktreeRoot})`. Use strict YAML
   parsing, an allowlisted schema, canonical JSON hashing, and resolved-path
   containment. Return `{config,sources}` from the resolver.
4. GREEN: run the focused test, `npm test`, and `git diff --check`.
5. Commit as `feat: validate unified workspace configuration`.

## QA and security mapping

QA-304 and SEC-302. Test exported behavior rather than snapshots. Worktree
overrides remain TASK-005.

## Handoff

Record RED, GREEN, full QA, and commit SHA before task review.
