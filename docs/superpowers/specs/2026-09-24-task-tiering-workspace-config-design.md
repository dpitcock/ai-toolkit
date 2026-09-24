# Task tiering and unified workspace configuration

Date: 2026-09-24  
Status: design approved in conversation; implementation pending project gates

## Purpose

Make this template safe to adopt at the start of a project or in an existing
repository. An agent classifies work by scope and risk before starting, then
follows a workflow proportional to the chosen tier. The adopting team confirms
its role requirements before the rules become active. One workspace file serves
both task governance and the optional Slack control plane.

## Boundaries and decisions

- The delivered product is this template package: its instructions, initializer,
  validators, CI example, documentation, and tests. It does not deploy Slack or
  change an adopting repository until that repository runs the installer.
- `config/workspace-config.yaml` is the only workspace configuration file in an
  initialized project. It replaces `config/slack-workspace.example.yml` and
  renames `workspace.channel_name` to `workspace.slack_channel_name`. Slack
  continues to read its existing routing and daily-summary values from it.
- The template must not ship an accepted, project-specific configuration. The
  initializer creates a proposal from repository evidence, records the human's
  changes and acceptance, then allows that file to be committed. If a config
  already exists, initialization validates it and does not overwrite it.
- Existing governance files are migrated to a tier-aware workflow. The current
  epic document and gate sequence becomes the Tier 3 path. Tier 1 and Tier 2
  have small, separate paths.
- Local files and checks are cooperative controls. CI can enforce PR checks;
  direct-merge protection and independent host reviews require repository host
  configuration. The template must not claim otherwise.

## Tiers and checks

| Tier | Eligibility | Git path | Required evidence |
| --- | --- | --- | --- |
| 1: quick fix | One tightly bounded code file; no auth, schema, public API, payment/financial logic, or user-data boundary | Feature branch, direct merge permitted | Pre-work classification statement and a quick pre-merge check of changed files and risk answers; no role approval |
| 2: contained change | One subsystem, a handful of code files, and no high-risk boundary | Feature branch and PR; no worktree requirement | Classification, lightweight self-checklist or second-agent pass, plus role-specific approvals when the effective configuration requires them for this change |
| 3: major project | New feature area, cross-cutting/multi-app work, or any small change with high risk or uncertain classification | Isolated `.worktrees/` worktree and PR; direct merge forbidden | Code Reviewer always, plus each applicable required role from the effective configuration, recorded in the existing gate sequence |

High-risk Tier 2 boundaries include auth, secrets, migrations, shared or critical
infrastructure, and hard-to-revert changes. The classifier uses the agent's
declared change and repository evidence, not diff size alone. It may escalate a
claimed tier, but cannot silently lower one. Unknown risk escalates to Tier 3
until resolved. A code-file count excludes the small governance record itself.
Classification runs before work; a final check repeats it against the actual
diff so scope growth cannot retain an obsolete tier.

## Single configuration and acceptance

The schema contains `workspace.repository`, `environment`, `provider`,
`slack_channel_name`, and `timezone`; `daily_summary.local_time`;
`approvals_required` booleans for Principal, QA, AppSec, Accessibility Reviewer,
and UI Designer; and `approvals_overrides.reason` with an `exempt` role list.
Code Reviewer is unconditional for Tier 3 and is not configurable. A missing
exemption reason is invalid. Exemption means structurally inapplicable; a
`false` approval setting is a changeable policy choice. An exempt role cannot
also be required in the effective configuration.

```yaml
workspace:
  repository: example-repository
  environment: production
  provider: codex
  slack_channel_name: ws-example-repository-codex
  timezone: America/New_York
approvals_required:
  principal: true
  qa: true
  appsec: true
  accessibility_reviewer: false
  ui_designer: false
approvals_overrides:
  reason: "No user interface in this project"
  exempt: [accessibility_reviewer, ui_designer]
daily_summary:
  local_time: "09:00"
```

Initialization detects stack, UI surface, existing CI/security conventions,
and repository history to propose values, with a written reason for each.
Environment labels may inform a proposal but never grant an exemption by
themselves. The human can revise any field before accepting. The acceptance
record contains the exact proposal revision or digest, changed fields, reason,
approver identity, and date. No tiered work or initial config commit proceeds
until acceptance is recorded. For legacy adoption, the installer previews
edits to workflow instructions and CI, preserves unrelated content, and stops
on conflicting files for explicit resolution. Acceptance activates the updated
rules immediately. The acceptance and later changes are recorded in a
versioned governance log, not another configuration file.

Later changes to `approvals_required` or `approvals_overrides`, including a
worktree override, require explicit human approval before editing and an audit
entry stating what changed, where, why, and who approved it. The initializer
and validator reject an unapproved change rather than interpreting silence as
consent. If project characteristics make an exemption stale, affected work
pauses for a proposed correction and approval. Work unaffected by that role
may continue under the current effective configuration.

## Root and worktree resolution

The coordination checkout's accepted `config/workspace-config.yaml` supplies
defaults. A worktree can explicitly override `workspace.provider`, individual
`approvals_required` roles, and `approvals_overrides` fields in its own copy of
that path; unspecified fields inherit the coordination value. The resolver
reports each effective value and its source. A worktree's exemption list, when
explicitly overridden, replaces the inherited list and needs its own reason;
otherwise both list and reason inherit together. Worktree creation must mark
which fields are intentional overrides so an ordinary copied Git file is not
misread as overriding every root setting. A worktree used as an independent
project must initialize and accept its own root configuration.

Before every task, the agent states the chosen tier and one-line risk reason,
active provider with source, effective approval value and source for each role,
and active exemptions with reasons. Tier 3's gate verifies the same resolved
configuration that was reported. If configuration is absent, malformed,
unaccepted, or inconsistent, the preflight check blocks work.

## Workflow integration

The preflight command is the single entry to tiered work. It checks config
acceptance, gathers scope and risk answers, prints the effective policy, and
selects the tier path. Tier 1 has a short merge check; Tier 2 has a PR check;
Tier 3 enters the existing project/epic/task state machine. The gate validator
is extended so its required reviews follow the effective Tier 3 configuration
while preserving independent reviewer identity, revision, and commit checks.
Tier 2 role approvals use those same integrity rules when a role applies.

Agent instructions, governed skill wrappers, workflow documentation, and CI
must agree on the routes. In particular, the current blanket worktree and
PR-only rules are replaced with tier-specific rules. The PR workflow validates
Tier 2 and Tier 3 records and runs the existing test suite. The Tier 1 direct
merge command validates immediately before merging; an adopter that requires
server-side prevention must configure host rules compatible with direct merge.

## Migration and failure handling

The initializer is idempotent. It migrates the existing Slack example values
into the proposed unified file, preserves any real Slack values found in an
adopting repository, and updates references to the new path and field name.
It never commits automatically. If legacy files contain conflicting values or
custom workflow rules, it presents the conflict and leaves the source intact
for a human decision. It keeps secrets and mutable Slack state out of Git.

A validator failure names the tier, failed rule, and safe next step. Missing
review evidence blocks only the affected task or epic. Scope growth re-runs
classification and, if it escalates to Tier 3, creates a worktree and obtains
the required approvals before further implementation or merge. Changes to an
approved plan still invalidate stale reviews as the current gates require.

## Verification

Tests cover config generation and idempotence; acceptance before commit;
legacy migration with preserved values; Slack reading the unified path and
renamed key; per-field worktree fallback and provenance; invalid or stale
exemptions; config change approval logs; each tier's eligibility and merge
checks; risk-driven escalation; and Tier 3's conditional roles alongside its
unconditional Code Reviewer. Scaffold tests exercise a generated project, and
CI tests prove Tier 2 and Tier 3 PR checks use the selected tier.

## Deliberate exclusions

- No Slack service, credentials, or mutable session state.
- No automatic semantic proof that a diff is low risk; the agent answers risk
  questions and the validator checks observable evidence.
- No claim that local scripts alone prevent a person from bypassing host rules.
- No automatic approval of an initial or later role-policy change.
