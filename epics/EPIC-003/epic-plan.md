---
# status changes only through scripts/check-gate.mjs --write.
# Plan approvals are distinct from epic triage and final implementation review.
kind: epic-plan
id: EPIC-003-PLAN
owner: "Codex"
status: in-progress
revision: 13
parent: epic.md
parent_revision: 1
security:
  auth: true
  data: true
  external: true
  concerns: [ SEC-301, SEC-302, SEC-303 ]
  rationale: "This plan validates approval-policy acceptance, reads and writes
    repository files, resolves worktree policy, and migrates the Slack
    descriptor. All three epic concerns are touched."
accessibility:
  ui: false
  rationale: "Only template configuration, CLI, docs, and tests change; no
    user-facing interface is added. Existing conditional UI accessibility gates
    remain mandatory and receive regression coverage."
touches_concerns: [ SEC-301, SEC-302, SEC-303 ]
tasks:
  - tasks/TASK-001.md
  - tasks/TASK-002.md
  - tasks/TASK-003.md
  - tasks/TASK-004.md
  - tasks/TASK-005.md
  - tasks/TASK-006.md
  - tasks/TASK-007.md
  - tasks/TASK-008.md
  - tasks/TASK-009.md
  - tasks/TASK-010.md
review_comments:
  - id: CR-001
    status: resolved
    finding: "Independent review found that linked worktree overrides could resolve
      without accepted evidence and CLI status could not validate linked
      policy."
    resolution_commit: "e514cd9dbb003d6013e2b9b04ccc4fc5f5126aed"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-002
    status: resolved
    finding: "Independent review found that a stale UI exemption blocked its own
      corrective policy change."
    resolution_commit: "e514cd9dbb003d6013e2b9b04ccc4fc5f5126aed"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-003
    status: resolved
    finding: "Independent review found that orphaned or inconsistent workspace
      history records could be trusted."
    resolution_commit: "e514cd9dbb003d6013e2b9b04ccc4fc5f5126aed"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-004
    status: resolved
    finding: "Independent review found that initial acceptance did not re-check
      current UI applicability."
    resolution_commit: "e514cd9dbb003d6013e2b9b04ccc4fc5f5126aed"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-005
    status: resolved
    finding: "Independent PR review reproduced concurrent apply-change calls
      appending duplicate or non-contiguous revisions because the accepted
      baseline is read before the history lock and the appended record itself is
      not validated as part of that critical section."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-006
    status: resolved
    finding: "Independent AppSec plan review found that an unspecified
      config/history transaction could not prove recovery after interruptions
      between its separate filesystem mutations."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-007
    status: resolved
    finding: "Independent Principal plan review found that a plain exclusive lock
      file survives abrupt process death, preventing the required next operation
      from acquiring the lock to recover an interrupted journal."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-008
    status: resolved
    finding: "Independent Principal plan review found that lock cleanup and journal
      phase persistence needed explicit inode-safe and fsynced atomic transition
      requirements to make crash recovery deterministic."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-009
    status: resolved
    finding: "Independent Principal plan review found that lock cleanup and stale
      reclamation needed an explicit fixed-link-first order and durable cleanup
      boundary so a fixed lock cannot outlive its owner companion."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-010
    status: resolved
    finding: "Independent AppSec plan review found that locking only apply-change
      left concurrent accept and proposal/bootstrap writers able to append
      invalid acceptance history or interleave with policy changes."
    resolution_commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
    verified_by: "staff-agent-task008-final-rereview"
    verified_date: "2026-09-25"
    verified_commit: "dc2994c931cf2ddeef93e545c50a233ffde5aa39"
  - id: CR-011
    status: open
    finding: "Final AppSec review reproduced two stale-lock reclaimers deleting a
      live replacement fixed lock after independently validating the same dead
      owner."
  - id: CR-012
    status: open
    finding: "Final AppSec review reproduced linked status reporting an uncommitted
      coordination-root policy while its transaction remained at
      history-appended."
review_commit: null
pr_url: "https://github.com/dpitcock/ai-toolkit/pull/5"
approvals:
  principal_engineer:
    by: "principal-agent-epic003-r2"
    date: "2026-09-25"
    notes: "Independent Principal review approved revision 13: TASK-009 uses one
      shared fail-closed helper for script-disabled install, exact pinned fs-ext
      hook validation, and targeted native rebuild; it retains cache isolation,
      both compatible devdir variables, actual SDK verification, and an
      unexpected-hook regression. TASK-010's advisory lock and ordered dual-root
      recovery design remains sound."
    revision: 13
  appsec:
    by: "appsec-agent-epic003-r13"
    date: "2026-09-25"
    notes: "Independent AppSec review approved revision 13. TASK-009 now installs
      fail-closed, validates the pinned fs-ext@2.1.1 build hook, and rebuilds
      only that reviewed package; the unexpected-hook regression, local
      cache/devdir isolation, and actual SDK check are required. TASK-010's
      descriptor advisory locks and ordered dual-root recovery address
      CR-011/012 while retaining SEC-301/302/303 controls."
    revision: 13
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-003 implementation plan

> For the implementing agent: read the design and this plan, then execute one
> task at a time through governed-build and Superpowers TDD. Each task has a
> separate implementation commit and evidence record. Do not begin while this
> plan is awaiting signoff.

**Goal:** An adopting greenfield or legacy repository has one accepted
`config/workspace-config.yaml` for governance and optional Slack routing.

**Architecture:** A small Node module strictly parses and resolves the single
YAML file. The initializer proposes values and applies an accepted migration;
a versioned governance log records acceptance and later policy changes. Slack
guidance and tests consume the generated config path.

**Tech stack:** Node.js >=22, `yaml` 2.9.0, `fs-ext` 2.1.1, shell bootstrap,
Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`.

## Global constraints

- `config/workspace-config.yaml` is the sole active workspace config;
  `workspace.slack_channel_name` replaces `workspace.channel_name`.
- Do not commit a project-specific accepted config to the template package.
  Integration tests create configs in temporary repositories.
- Proposal success is not human acceptance. The CLI records supplied identity,
  reason, revision, and exact digest only after explicit confirmation. Local
  files are cooperative evidence, not proof of reviewer identity.
- Preserve unrelated legacy content and stop on conflicting migration inputs.
  Do not commit credentials, channel IDs, or mutable Slack state.
- Linked worktrees mark intentional `worktree_overrides`; unlisted fields
  inherit from the coordination checkout. Exemption list and reason override
  together. Policy changes require a new accepted audit record.
- The merged UI accessibility gate is a floor: this config cannot waive
  independent accessibility triage, plan signoff, or final review for UI work.
- Every task records focused RED/GREEN evidence and an individual commit.
  Run `npm test` and `git diff --check` before branch review.
- Native workspace-policy locks use `fs-ext` advisory locks. Scope npm cache
  and node-gyp SDK download/build writes to the active worktree's ignored
  `.npm-cache/`, `.node-gyp/`, and `node_modules/` paths using
  both `npm_package_config_node_gyp_devdir` and legacy `npm_config_devdir`; do
  not use `--nodedir`, which selects a Node source tree rather than an SDK
  cache. Start script-disabled, verify the exact pinned `fs-ext` build hook,
  then rebuild only `fs-ext`; the clean-install test verifies the actual SDK
  directory and that an unexpected lifecycle hook cannot run.

## File responsibilities and interfaces

| File | Responsibility |
| --- | --- |
| `tests/scaffold.test.mjs` | Real temporary project/worktree behavior and revision-safe approval fixture. |
| `scripts/lib/workspace-config.mjs` | Strict YAML parsing, schema validation, canonical digest, root/worktree resolution with provenance. |
| `scripts/lib/workspace-history.mjs` | Versioned acceptance/change records and current-digest verification. |
| `scripts/init-workspace.mjs` | Proposal, acceptance, status, and safe legacy migration CLI. |
| `scripts/init-project.sh` | Runs the fail-closed reviewed native-lock install, then proposes workspace config without accepting or committing it. |
| `scripts/install-native-lock.mjs` | Validates the pinned `fs-ext` hook and runs its only permitted native rebuild. |
| `tests/workspace-config.test.mjs` | Parser, resolver, exemption, and history behavior. |
| `tests/init-workspace.test.mjs` | Greenfield and legacy CLI/migration integration cases. |
| `docs/workflow.md` | Documents worktree-local npm/node-gyp cache, native lock dependency, and filesystem policy. |
| `docs/slack-control-plane.md` | Document unified config as Slack's descriptor. |
| `tests/workspace-config-slack.test.mjs` | Generated-config Slack contract; replaces the old example test. |

`parseWorkspaceConfig(raw,{partial})` returns a validated object or throws;
`resolveWorkspaceConfig({coordinationRoot,worktreeRoot})` returns
`{config,sources}`; `workspaceConfigDigest(config)` returns canonical SHA-256.
`readWorkspaceHistory(root)` and
`assertAcceptedWorkspaceConfig(root,config)` consume the audit log. The CLI
offers `propose`, `accept`, and `status`; `accept` requires an explicit reviewer,
reason, and the current proposal digest. A proposal never claims approval.

## Security mapping

- **SEC-301 touched:** TASK-003 records initial acceptance; TASK-005 checks
  digest, revision, reviewer, and approved root/worktree policy changes.
  Tests and guides state that files cannot authenticate a human. A configured
  exemption cannot remove the merged mandatory UI accessibility gate.
- **SEC-302 touched:** TASK-002 rejects duplicate keys, aliases, malformed
  types, and unsafe config shapes; TASK-004 checks migration paths; TASK-005
  validates override markers and coordination-root discovery.
- **SEC-303 touched:** TASK-004 preserves legacy values and stops on conflicts;
  TASK-006 retires the old descriptor without adding live Slack state.
  TASK-003 keeps proposals non-secret.
- **SEC-301 touched:** TASK-008 routes proposal bootstrap, acceptance, and
  policy change through one combined-history root-local lock; it binds reviewed
  policy changes to the accepted base digest and uses a recoverable
  config/history transaction so concurrent callers and a failed second
  filesystem operation cannot corrupt audit history or silently overwrite an
  intervening policy.

No concern is unaffected. AppSec plan signoff follows Principal signoff;
mandatory final AppSec review remains a later gate.

## Review focus

- A forged or edited acceptance log must not make a changed config effective.
- Duplicate/aliased YAML and symlinked paths must fail closed.
- A legacy conflict must leave original files and audit history untouched.
- A copied worktree config must not accidentally override root requirements.
- A user-facing UI change must still require the merged accessibility reviews.
- Concurrent policy-change requests and interrupted config/history updates
  must preserve or recover one valid accepted revision; stale requests cannot
  replace the accepted config.
- Native installs must build the pinned lock dependency without writing npm or
  node-gyp state outside the active worktree; unsupported filesystems fail
  before policy mutation.

## Tasks and checkpoints

1. `tasks/TASK-001.md` — revision-safe scaffold fixture (QA-301).
2. `tasks/TASK-002.md` — strict schema parser and root resolver (QA-304).
3. `tasks/TASK-003.md` — proposal and initial acceptance log (QA-302/303).
4. `tasks/TASK-004.md` — safe legacy migration (QA-302/303).
5. `tasks/TASK-005.md` — worktree overrides and policy change control
   (QA-304/305).
6. `tasks/TASK-006.md` — Slack descriptor consolidation and scaffold
   regression (QA-303/305).
7. `tasks/TASK-007.md` — accepted-policy review remediation (QA-302/304/305).
8. `tasks/TASK-008.md` — recoverable concurrent policy-change remediation
   (QA-302/304).
9. `tasks/TASK-009.md` — reproducible native advisory-lock installation
   (QA-301/304; SEC-302).
10. `tasks/TASK-010.md` — OS-advisory lock and linked-transaction remediation
    (QA-302/304; SEC-301/302).

Dependencies are sequential and declared in each task. Checkpoints follow
TASK-003 (greenfield init), TASK-006 (legacy, worktree, Slack, and current
accessibility paths), and TASK-007 (accepted root/worktree policy and history
integrity), and TASK-008 (concurrent and interrupted policy-change integrity).
Each runs `npm test` and reviews the security mapping.

## Accessibility mapping

`accessibility.ui: false` because this plan changes no product UI. TASK-005
and TASK-006 preserve and test the existing conditional WCAG 2.2 AA gates.
No independent accessibility signoff is required for this non-UI plan, but a
future UI plan cannot use config to evade that review.

## Review evidence

Dennis reviews sizing, interfaces, migration order, and resolution semantics.
Andrei then reviews SEC-301 through SEC-303 against this plan revision. After
implementation, an independent staff reviewer checks correctness, clarity,
architecture, security, and performance; a separate final AppSec pass checks
the exact implementation commit. Revision 2 adds TASK-007 to address the
independent staff review's four policy-integrity findings before any final
approval. Revision 9 extends TASK-008's common history writer lock to resolve
CR-005 through CR-010 before renewed final approvals. Revision 11 splits the
OS-level advisory-lock remediation into TASK-009 for reproducible, sandbox-local
native installation and TASK-010 for CR-011/012 locking and linked-root
transaction integrity. Revision 12 makes the SDK-cache contract compatible
with pre-11.4 node-gyp by setting both supported devdir variables and checking
the resulting directory. Revision 13 makes lifecycle execution fail closed:
the locked graph installs with scripts disabled and only the inspected pinned
`fs-ext` build is later rebuilt. Record actual findings and fixes here.
