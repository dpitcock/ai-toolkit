# Task tiering and unified workspace configuration

Date: 2026-09-24
Status: draft reconciliation against current main; requires fresh project approval

## Purpose and boundary

Make this template safe to adopt in a new or existing repository. An agent
classifies work by scope and risk before starting, then follows a proportional
workflow. The adopting team confirms the workspace policy before it becomes
active. One file serves both task governance and the optional Slack contract.

The delivered product is this template package: instructions, initializer,
validators, CI example, documentation, and tests. It neither deploys Slack nor
changes an adopting repository until its team runs the initializer and accepts
the proposal. The already-merged Slack contract and conditional accessibility
gate are retained. This design supersedes the EPIC-002 task-tiering draft on the
unmerged local branch; new work uses EPIC-003 through EPIC-005.

## Tier paths

| Tier | Eligibility | Git path in an adopting repository | Required evidence |
| --- | --- | --- | --- |
| 1: quick fix | One tightly bounded code file; no auth, schema, public API, payment/financial logic, user-data boundary, or user-facing UI | Feature branch; direct merge only if accepted policy and host rules permit it | Pre-work classification and short pre-merge diff/risk check; no role approval |
| 2: contained change | One subsystem, a handful of files, no high-risk boundary | Feature branch and PR | Classification, lightweight self-check or independent pass, and applicable configured approvals |
| 3: major project | New feature area, cross-cutting or multi-app work, high risk, or uncertain classification | Isolated worktree and PR | Current project/epic/task gates; independent Code Reviewer and all applicable required roles |

Auth, secrets, migrations, shared or critical infrastructure, and hard-to-revert
changes are high risk even when the diff is small. The classifier combines the
agent's scope/risk answers with repository evidence; it never infers safety
from file count alone. Unknown risk escalates to Tier 3 until resolved. It can
escalate a claimed tier but cannot silently lower it. A final check repeats
classification against the actual diff.

The merged accessibility gate is a floor, not an optional default. A change to
a user-facing UI must receive the existing independent accessibility triage,
plan signoff, and final reviewed-commit review. Tier 1 is ineligible for UI
work. Tier 2 may handle UI only if it provides equivalent independent evidence;
otherwise it escalates to Tier 3. Workspace settings cannot exempt a UI change
from those existing gates. AppSec and QA requirements similarly retain the
current reviewer-identity and revision integrity checks where applicable.

This template repository itself remains under its current PR-only merge rule
until an approved governance change explicitly replaces that rule. The Tier 1
direct-merge option is for generated or adopting repositories whose accepted
policy and host protection allow it; it is not a shortcut for this work.

## One configuration and human acceptance

`config/workspace-config.yaml` is the single workspace configuration in an
initialized project. It replaces `config/slack-workspace.example.yml` and
renames `workspace.channel_name` to `workspace.slack_channel_name`. Slack uses
its existing routing and daily-summary values from the unified file. The
template does not ship an accepted project-specific config.

The schema includes repository, environment, provider, Slack channel name,
timezone, daily-summary time, and per-role approval policy for Principal, QA,
AppSec, Accessibility Reviewer, and UI Designer. Tier 3 always requires an
independent Code Reviewer. A role marked structurally inapplicable needs an
exemption reason and cannot simultaneously be required. A `false` setting is
a changeable policy choice, not an exemption. The validator rejects any
setting that would remove a mandatory current-governance gate.

The initializer detects stack, UI surface, CI/security conventions, and
repository history to propose values with reasons. Environment labels may
inform a proposal but do not grant exemptions alone. The human may revise any
field before acceptance. The versioned governance log records the proposal
digest, changed fields, reason, approver identity, and date; it is not a
second configuration file. No tiered work or initial config commit proceeds
without recorded acceptance. An existing config is validated, not overwritten.

For legacy adoption, initialization previews instruction and CI changes,
preserves unrelated content, and stops on conflicts for an explicit decision.
Acceptance activates the updated rules immediately. Later approval-policy or
exemption changes, including worktree overrides, require prior human approval
and an audit entry describing what changed, where, why, and who approved it.
The validator rejects unapproved changes; silence is never consent. If an
exemption becomes stale, affected work pauses for a proposed correction.

## Root and worktree policy resolution

The coordination checkout's accepted config supplies defaults. A worktree may
explicitly override provider, individual role settings, and exemption fields
at the same path. Unspecified fields inherit. An overridden exemption list
replaces the inherited list and needs its own reason; otherwise the list and
reason inherit together. Worktree creation marks intentional overrides so an
ordinary copied Git file is not read as overriding every root setting. An
independent project worktree initializes and accepts its own root config.

Before every task, preflight reports the tier and risk reason, provider and
source, each effective approval value and source, and exemptions with reasons.
The Tier 3 gate checks exactly that resolved policy. Missing, malformed,
unaccepted, or inconsistent configuration blocks affected work.

## Workflow, enforcement, and failure handling

Preflight is the entry to tiered work. Tier 1 has a short merge check; Tier 2
has a PR check; Tier 3 enters the existing project/epic/task state machine.
The gate validator adds effective-role resolution without weakening independent
reviewer identity, revision, or reviewed-commit checks. Tier 2 role approvals
use the same integrity checks when a role applies. Agent instructions, governed
skills, workflow docs, and CI must agree on the routes.

PR CI validates Tier 2/3 records and runs tests. An adopter enabling Tier 1
direct merges must configure compatible host protection if it wants server-
side enforcement. Local scripts are cooperative controls and cannot prevent a
person with repository authority from bypassing them.

Initialization is idempotent. It migrates the Slack example values and any
real values found in an adopter, updates references, never commits by itself,
and keeps secrets and mutable Slack state out of Git. On conflicting legacy
values or custom rules it leaves sources intact and requests a decision.
Validation failures name the tier, failed rule, and safe next step. Missing
review evidence blocks only affected work. Scope growth reclassifies before
further implementation or merge; approved-plan changes invalidate stale
reviews as current gates require.

## Verification and exclusions

Test generation and idempotence, acceptance before commit, legacy-value
preservation, Slack migration, per-field fallback and provenance, invalid or
stale exemptions, approval logs, tier eligibility and merge checks, risk
escalation, conditional role approvals, and existing accessibility behavior.
Scaffold tests exercise a generated project; CI tests prove PR checks use the
selected tier.

No Slack service, credentials, or mutable session state. No automatic proof
that a diff is low risk. No claim that local checks alone prevent bypass. No
automatic approval of an initial or later role-policy change.
