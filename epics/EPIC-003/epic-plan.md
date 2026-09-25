---
# status changes only through scripts/check-gate.mjs --write.
# Plan approvals are distinct from epic triage and final implementation review.
kind: epic-plan
id: EPIC-003-PLAN
owner: "Codex"
status: in-progress
revision: 2
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
review_comments:
  - id: CR-001
    status: open
    finding: "Independent review found that linked worktree overrides could resolve
      without accepted evidence and CLI status could not validate linked
      policy."
  - id: CR-002
    status: open
    finding: "Independent review found that a stale UI exemption blocked its own
      corrective policy change."
  - id: CR-003
    status: open
    finding: "Independent review found that orphaned or inconsistent workspace
      history records could be trusted."
  - id: CR-004
    status: open
    finding: "Independent review found that initial acceptance did not re-check
      current UI applicability."
review_commit: null
pr_url: null
approvals:
  principal_engineer:
    by: "principal-agent-epic003-r2"
    date: "2026-09-25"
    notes: "Independent plan review of revision 2 at
      f235b9036aae637d4c193b72eeb04e132fff6518 approved TASK-007 sizing,
      accepted-policy interfaces, CR-001 through CR-004 coverage, and
      real-worktree test strategy."
    revision: 2
  appsec:
    by: "appsec-agent-epic003-r2"
    date: "2026-09-25"
    notes: "Independent AppSec review of revision 2 at
      4a0028016f25ec483d31e92ad84fc0a8bf6133d6 approved TASK-007's
      SEC-301/302/303 remediation plan and its accepted-root/overlay,
      history-chain, stale-UI, and legacy-retirement regression coverage."
    revision: 2
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

**Tech stack:** Node.js >=22, `yaml` 2.9.0, shell bootstrap, Node test runner.

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

## File responsibilities and interfaces

| File | Responsibility |
| --- | --- |
| `tests/scaffold.test.mjs` | Real temporary project/worktree behavior and revision-safe approval fixture. |
| `scripts/lib/workspace-config.mjs` | Strict YAML parsing, schema validation, canonical digest, root/worktree resolution with provenance. |
| `scripts/lib/workspace-history.mjs` | Versioned acceptance/change records and current-digest verification. |
| `scripts/init-workspace.mjs` | Proposal, acceptance, status, and safe legacy migration CLI. |
| `scripts/init-project.sh` | Propose workspace config during bootstrap without accepting or committing it. |
| `tests/workspace-config.test.mjs` | Parser, resolver, exemption, and history behavior. |
| `tests/init-workspace.test.mjs` | Greenfield and legacy CLI/migration integration cases. |
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

No concern is unaffected. AppSec plan signoff follows Principal signoff;
mandatory final AppSec review remains a later gate.

## Review focus

- A forged or edited acceptance log must not make a changed config effective.
- Duplicate/aliased YAML and symlinked paths must fail closed.
- A legacy conflict must leave original files and audit history untouched.
- A copied worktree config must not accidentally override root requirements.
- A user-facing UI change must still require the merged accessibility reviews.

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

Dependencies are sequential and declared in each task. Checkpoints follow
TASK-003 (greenfield init), TASK-006 (legacy, worktree, Slack, and current
accessibility paths), and TASK-007 (accepted root/worktree policy and history
integrity). Each runs `npm test` and reviews the security mapping.

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
approval. Record actual findings and fixes here.
