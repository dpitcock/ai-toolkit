---
kind: task
id: TASK-009
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 13
depends_on: [ tasks/TASK-008.md ]
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

# TASK-009: Make native advisory locks reproducible in the worktree

## Acceptance criteria

- Pin `fs-ext` at exactly 2.1.1 in `package.json` and `package-lock.json`.
- All repository-owned dependency installs begin with `npm ci --ignore-scripts`,
  validate the exact pinned `fs-ext` lifecycle hook, then rebuild only
  `fs-ext`; no blanket lifecycle-script execution is permitted. Keep npm cache
  and node-gyp's SDK download directory inside the active worktree:
  `.npm-cache/` and `.node-gyp/`. Use
  both `npm_package_config_node_gyp_devdir` and legacy `npm_config_devdir`, not
  `--nodedir`; the latter names a pre-existing Node source tree rather than
  node-gyp's download directory.
- Ignore both cache directories. `scripts/init-project.sh`,
  `scripts/new-epic.sh`, and CI must invoke one shared fail-closed helper with
  the same cache/devdir policy.
- Document `fs-ext`, supported native-build prerequisites (Python and compiler),
  and the supported Linux advisory-lock filesystem assumption. No install or
  cache repair writes outside the active worktree.
- A clean temporary-copy install with no `node_modules` uses worktree-local
  cache/devdir, verifies the actual node-gyp SDK directory is local, imports
  `fs-ext`, and acquires/releases a trivial advisory lock.
- A synthetic unexpected lifecycle hook remains unexecuted; the regression
  verifies that the helper approves only the audited `fs-ext` hook.

## Files and dependencies

Modify `package.json`, `package-lock.json`, `.gitignore`,
`.github/workflows/workflow.yml`, `scripts/init-project.sh`,
`scripts/new-epic.sh`, `scripts/install-native-lock.mjs`,
`tests/scaffold.test.mjs`, `docs/workflow.md`,
`docs/verification.md`, and `docs/agent-details/AGENT-TESTING.md`. Depends on
TASK-008 and supplies the lock dependency for TASK-010.

## TDD steps

1. Add a scaffold/native-install regression that runs in a clean temporary
   copy without `node_modules`, verifies the bootstrap/new-epic/CI path starts
   script-disabled and permits only the audited `fs-ext` hook, scopes
   cache/devdir locally, imports `fs-ext`, and performs a real exclusive
   lock/unlock. Add an unexpected lifecycle-hook fixture and prove its marker
   is not created.
2. RED: run `node --test tests/scaffold.test.mjs`; expect the new assertion to
   fail because the reviewed helper, package, and fail-closed assertions are
   absent.
3. Add the exact dependency and lockfile. Add a shared helper that verifies
   `fs-ext` version and its reviewed `node-gyp configure build` hook after the
   script-disabled install, then runs targeted `npm rebuild fs-ext` with scripts
   enabled. Update bootstrap, worktree creation, CI, docs, ignores, and the
   fixture to invoke that helper and set both
   `npm_package_config_node_gyp_devdir="$PWD/.node-gyp"` and
   `npm_config_devdir="$PWD/.node-gyp"`, plus
   `npm --cache "$PWD/.npm-cache" ci`; do not set a user-level npm config.
4. GREEN: run `node --test tests/scaffold.test.mjs`, `npm test`,
   `npm audit --audit-level=high --omit=dev`, and `git diff --check`.
5. Commit as `build: add reproducible native workspace lock dependency`.

## QA and security mapping

QA-301 and QA-304; SEC-302. Treat lifecycle scripts as an external execution
boundary: inspect and allow only the pinned `fs-ext` build hook. Exercise a
real clean install and advisory lock; do not simulate native package
availability. Ensure the test cleans only its own temporary repository and
never reads or writes a user-level npm/node-gyp cache.

## Handoff

Record actual RED/GREEN/QA evidence and the implementation SHA. TASK-010 may
not start until this task is done and its native install contract is verified.
