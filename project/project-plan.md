---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: project
id: PROJECT
owner: "Codex"
status: awaiting-review
revision: 2
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
---

# Project Plan

## Goal and scope
Add risk-based task tiers to this template so teams can adopt it in greenfield
or legacy repositories. Initialization proposes a human-accepted workspace
configuration; that same file supplies the existing optional Slack descriptor.
Workflows and executable checks apply proportionally to quick fixes, contained
changes, and major projects. The approved design is
`docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`.

The provider-neutral Slack control-plane contract was delivered under the
original scope and remains part of the template. This revision migrates its
descriptor into the unified workspace configuration without deploying Slack.

## Success criteria
- A greenfield or legacy adoption creates one `config/workspace-config.yaml`
  containing governance and Slack fields, preserves existing project values,
  and requires recorded human acceptance before its initial commit.
- The effective provider, each approval setting and its source, exemptions and
  reasons, and the chosen tier are reported before work. Root/worktree fallback
  and later approval-policy changes have verified provenance and approval logs.
- A Tier 1 single-file low-risk fix has a short pre-merge check and may merge
  directly. Tier 2 requires a PR and lightweight review. Tier 3 requires an
  isolated worktree, PR, Code Reviewer, and all configured role approvals.
- Risk, uncertainty, or scope growth escalates the tier. Tests exercise the
  initializer, migration, resolution, classification, gates, and scaffold.
- Slack routing and daily-summary documentation consume the unified config;
  credentials and mutable Slack state stay outside Git.

## Constraints
- This project changes only the template package. An adopting repository is
  modified only when its team runs the initializer and accepts the proposal.
- Preserve existing user content and disclose conflicts during legacy adoption.
- Local checks are cooperative; PR CI and host rules supply additional merge
  enforcement where configured. Do not claim local checks prevent bypass.
- Existing EPIC-001 review and merge history is retained. New scope requires a
  new project revision and fresh Principal review; stale approvals are invalid.

## Timeline
1. Principal reviews this revised project scope and epic boundaries.
2. Implement and review unified configuration, initialization, and Slack migration.
3. Implement and review tier classification and the Tier 1/2 paths.
4. Implement and review Tier 3 role resolution, gates, and CI integration.
5. Verify full scaffold behavior and adoption instructions across all paths.

## Epic decomposition (EM + Principal)
- EPIC-001 (merged under project revision 1): provider-neutral Slack
  control-plane template and Codex-first adapter guidance.
- EPIC-002 (proposed): unified workspace configuration, human acceptance and
  change log, greenfield/legacy initialization, root/worktree resolution, and
  Slack descriptor migration. Supplies the config API to later epics.
- EPIC-003 (proposed, depends on EPIC-002): scope/risk classification, Tier 1
  pre-merge check, Tier 2 PR/review check, and proportional agent workflow.
- EPIC-004 (proposed, depends on EPIC-002 and EPIC-003): Tier 3 configured
  approvals, worktree and PR enforcement, CI integration, and end-to-end
  scaffold verification. Each epic receives separate QA and AppSec triage.
