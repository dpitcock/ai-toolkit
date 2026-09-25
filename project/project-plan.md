---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: project
id: PROJECT
owner: "Codex"
status: approved
revision: 2
approvals:
  principal_engineer:
    by: "Dennis"
    date: "2026-09-24"
    notes: "Principal approval of revised task-tiering scope and EPIC-003 through
      EPIC-005 decomposition, relayed by the user in conversation."
    revision: 2
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# Project Plan

## Goal and scope
Add risk-based task tiers to this template so teams can adopt it at the start
of a greenfield project or later in a legacy repository. Initialization
proposes a human-accepted workspace configuration; that same file supplies
the existing optional Slack descriptor. Workflows and executable checks apply
proportionally to quick fixes, contained changes, and major projects. The
task-tiering design is
`docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`.

The provider-neutral Slack contract delivered by EPIC-001 and the conditional
accessibility governance delivered by EPIC-002 remain part of the template.
This revision unifies the Slack descriptor with workspace governance without
deploying Slack or weakening independent accessibility review where required.

## Success criteria
- Greenfield and legacy adoption propose one `config/workspace-config.yaml`
  containing governance and Slack fields, preserve existing project values,
  and require recorded human acceptance before the initial config commit.
- Before work, the effective provider, each approval setting and its source,
  exemptions and reasons, and the chosen tier are reported. Root/worktree
  fallback and later policy changes have verified provenance and approval logs.
- Tier 1 has a short pre-merge check; Tier 2 uses a PR and lightweight review;
  Tier 3 uses an isolated worktree, PR, Code Reviewer, and all applicable
  configured role approvals. Risk or uncertainty escalates the tier.
- Current accessibility triage, plan signoff, and final review remain mandatory
  for user-facing UI work at the applicable tier; the configuration cannot
  silently exempt a required independent review.
- Tests cover initialization, migration, resolution, classification, gates,
  and generated-project behavior. Slack routing and daily-summary guidance
  consume the unified config; secrets and mutable state remain outside Git.

## Constraints
- This project changes only the template package. An adopting repository is
  modified only when its team runs the initializer and accepts the proposal.
- Preserve existing user content and disclose conflicts during legacy adoption.
- Slack messages remain routing inputs, not implicit authorization for
  irreversible external actions; the initial user-edited README remains out
  of scope and must be preserved.
- Local checks are cooperative. PR CI and host rules provide additional merge
  enforcement where configured; do not claim local checks prevent bypass.
- Development of this template still follows its existing PR-only merge and
  independent-review gates. Any Tier 1 direct-merge option applies only to an
  adopting repository whose accepted policy and host rules permit it.
- Existing EPIC-001 and EPIC-002 approval/merge history is retained. This new
  scope requires fresh Principal approval of revision 2; approvals on the
  superseded local EPIC-002 branch are not carried forward.

## Timeline
1. Obtain Principal review of this revised scope and the new epic boundaries.
2. Implement and review unified configuration, initialization, and Slack migration.
3. Implement and review classification and proportional Tier 1/2 paths.
4. Implement and review Tier 3 role resolution, gates, and CI integration.
5. Verify full scaffold behavior and adoption instructions across all paths.

## Epic decomposition (EM + Principal)
- EPIC-001 (merged under revision 1): provider-neutral Slack control-plane
  template and Codex-first adapter guidance.
- EPIC-002 (merged under revision 1): conditional accessibility governance for
  UI epics, including triage, plan approval, final review, and regression tests.
- EPIC-003 (proposed): unified workspace configuration, human acceptance and
  change log, greenfield/legacy initialization, root/worktree resolution, and
  Slack descriptor migration. Supplies the config API to later epics.
- EPIC-004 (proposed, depends on EPIC-003): scope/risk classification, Tier 1
  pre-merge check, Tier 2 PR/review check, and proportional agent workflow.
- EPIC-005 (proposed, depends on EPIC-003 and EPIC-004): Tier 3 configured
  approvals, worktree and PR enforcement, CI integration, and end-to-end
  scaffold verification. Each new epic receives fresh QA, AppSec, and
  accessibility triage under current governance.
