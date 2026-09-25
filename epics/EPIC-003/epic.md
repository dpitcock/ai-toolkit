---
# status is changed only with scripts/check-gate.mjs --write.
# approvals require an independent reviewer and the current revision.
kind: epic
id: EPIC-003
owner: "Codex"
status: awaiting-review
revision: 1
parent: ../../project/project-plan.md
parent_revision: 2
security:
  auth: true
  data: true
  external: true
  concerns: [ SEC-301, SEC-302, SEC-303 ]
  rationale: "This epic defines who may accept approval policy, parses and writes
    repository configuration, and changes the descriptor consumed by an external
    Slack control plane. These boundaries require independent AppSec triage."
accessibility:
  ui: false
  rationale: "This epic changes template configuration, CLI workflow, guidance,
    and tests; it does not change a user-facing interface. The merged
    conditional accessibility gate remains in force for later UI work."
qa_requirements: [ QA-301, QA-302, QA-303, QA-304, QA-305 ]
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-003: Unified workspace configuration and initialization

## Outcome and scope

An adopting greenfield or legacy repository obtains one
`config/workspace-config.yaml` for task governance and optional Slack routing.
Initialization proposes approval settings from repository evidence, records
human acceptance before the initial config commit, preserves existing values,
and is idempotent. A resolver reports effective root/worktree values and their
sources. Later approval-policy changes need explicit, versioned acceptance.

This epic does not implement tier classification or merge routing; EPIC-004
and EPIC-005 consume its validated configuration interface. It migrates the
existing Slack example's `channel_name` to `slack_channel_name`, updates Slack
guidance and tests, and removes the old example only after its values are
represented by the initializer. No live Slack service, credentials, or mutable
session state are added. Existing accessibility governance is preserved.

## AppSec concerns — proposed for Andrei's fresh triage

- **SEC-301 — Approval authority and audit integrity.** A locally editable
  record cannot authenticate a reviewer. Require explicit acceptance, retain
  revision and provenance, reject missing or stale evidence, and state host-
  enforcement limits. A worktree override must not silently remove a root
  role requirement or a mandatory UI accessibility gate.
- **SEC-302 — Untrusted YAML and repository paths.** Reject duplicate keys,
  aliases, invalid types, malformed roles, unsafe paths or symlink escapes,
  and ambiguous root/worktree sources. Never execute config values as commands.
- **SEC-303 — Legacy migration and Slack data handling.** Preserve existing
  content, stop on conflicts, avoid destructive overwrites, and keep Slack
  credentials, IDs, and session state out of versioned config and logs.

AppSec triage is required because this crosses approval, file-writing, and
external-descriptor boundaries. Plan signoff and final implementation review
are separate, later AppSec decisions. No approval from the superseded local
task-tiering branch transfers to this epic.

## QA requirements — proposed for Karen's fresh review

- **QA-301 — Bootstrap regression.** The scaffold fixture must use the copied
  project plan's actual revision when constructing its independent approval.
  `node --test tests/scaffold.test.mjs` currently fails against project revision
  2; it must pass before the full suite can be considered green.
- **QA-302 — Initialization and acceptance.** In temporary greenfield and
  legacy repositories, verify proposal evidence, human edits, explicit
  acceptance, refusal to commit or begin tiered work without acceptance, and
  repeated initialization without overwriting accepted content.
- **QA-303 — Migration safety.** Verify preservation of real Slack values and
  unrelated workflow text, clear conflict reporting, no automatic commit,
  and no secrets or mutable Slack state in config or the audit log.
- **QA-304 — Resolution and change control.** Test per-field worktree fallback,
  source reporting, exemption-reason coupling, malformed/stale policy
  rejection, and authorized versus unauthorized policy changes.
- **QA-305 — Slack and accessibility regression.** Parse the unified config;
  verify Slack channel, provider, timezone, and summary time; update the
  scaffold assertion; ensure the existing UI accessibility gate still fails
  closed; run `npm test` and `git diff --check`.

These are proposed QA requirements, not a QA Lead approval. Karen must review
and record findings against this epic revision before approval.

## Accessibility triage

`accessibility.ui: false`: configuration and governance behavior only, with no
user-facing product UI. The conditional WCAG 2.2 AA gates from merged EPIC-002
remain a required floor for future UI changes; this epic does not add an
accessibility reviewer exemption to the template's own workflow.

## Dependencies and ownership

Developer owner: Codex. Depends on approved project revision 2 and
`docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`.
EPIC-004 and EPIC-005 depend on this epic's schema, resolver, and acceptance
evidence contract. Principal, QA Lead, and AppSec reviews must be independent.

This isolated worktree was created manually because `new-epic.sh` rejects a
linked coordination checkout and its baseline test currently fails on a
revision-1 scaffold fixture. No implementation repair precedes epic and task
plan approval.
