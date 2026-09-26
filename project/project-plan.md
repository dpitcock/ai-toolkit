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
revision: 3
approvals:
  principal_engineer:
    by: "Codex Principal reviewer /root/principal_scope_review"
    date: "2026-09-26"
    revision: 3
    notes: "Independent project-scope review of revision 3 and governance-first
      proposal. Approves sequential EPIC-006 through EPIC-010 ordering, shared
      tier defaults, accepted overrides, risk escalation, scoped authorization,
      explicit review readiness and persisted completion. EPIC-006 must deliver
      current-head enforcement and actual agent-path activation before later
      enhancements. Detailed plan and specialist reviews remain required."
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# Project Plan

## Goal and scope
The active priority is the owner-approved governance-first update in
`project/governance-first-proposal.md` (2026-09-26). Deliver EPIC-006 before
resuming previous projects or starting the remaining epics. Reduce routine
authorization pauses and repeated reviews while preserving independent gates.
Use shared versioned tier definitions, explicit workspace overrides, scoped
autopilot, merge-time review readiness, and persisted epic completion evidence.
Use existing Agent Alert and gh-identity stdio MCP transports. No new hosted
service is needed for the local governance path.

The following delivered foundation remains in scope for compatibility:
Add risk-based task tiers to this template so teams can adopt it at the start
of a greenfield project or later in a legacy repository. Initialization
proposes a human-accepted workspace configuration; that same file supplies
the existing optional Slack descriptor. Workflows and executable checks apply
proportionally to quick fixes, contained changes, and major projects. The
task-tiering design is
`docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md`.

The provider-neutral Slack contract delivered by EPIC-001 and the conditional
accessibility governance delivered by EPIC-002 remain part of the template.
Preserve the unified Slack descriptor and independent accessibility review.

## Success criteria
- Authorized routine work continues without extra Proceed stops or Staff calls.
- Reviews dispatch only when a specific PR head is declared ready, deduplicated
  per role/PR/head; fixes stay on the same implementation PR and are batched.
- Shared tier defaults and validated overrides replace the one-off merge flag,
  preserving risk escalation, accepted-policy history, and host restrictions.
- Both autopilot modes block the next epic until remote-main integration,
  integrated checks, runtime adoption, and safe cleanup are evidenced.
- EPIC-006 activates these behaviors before agent/settings/notification work.
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
- Preserve EPIC-001 through EPIC-005 history; completed epics do not inherit
  approval of this new scope. Obtain independent Principal review of revision 3.
- The owner approved initial config acceptance, autopilot within approved
  scope, and one initial plan-only PR exception. The exception permits that
  plan PR before implementation review, not implementation merge without review.
- No automatic reprioritization, cancellation, or cleanup of other repositories.

## Timeline
1. Record owner decisions and independent scope/QA/security review; approve the
   initial plan-only PR using the authorized exception and host requirements.
2. Implement EPIC-006 in an isolated worktree, verify, review, merge, and activate.
3. Complete EPIC-006 cleanup and persist evidence before releasing EPIC-007.
4. Deliver the remaining epics sequentially under the activated governance.

## Epic decomposition (EM + Principal)
- EPIC-001 (merged under revision 1): provider-neutral Slack control-plane
  template and Codex-first adapter guidance.
- EPIC-002 (merged under revision 1): conditional accessibility governance for
  UI epics, including triage, plan approval, final review, and regression tests.
- EPIC-003 (merged): unified workspace configuration, human acceptance and
  change log, greenfield/legacy initialization, root/worktree resolution, and
  Slack descriptor migration. Supplies the config API to later epics.
- EPIC-004 (merged, depended on EPIC-003): scope/risk classification, Tier 1
  pre-merge check, Tier 2 PR/review check, and proportional agent workflow.
- EPIC-005 (merged, depended on EPIC-003 and EPIC-004): Tier 3 configured
  approvals, worktree and PR enforcement, CI integration, and end-to-end
  scaffold verification. Each new epic receives fresh QA, AppSec, and
  accessibility triage under current governance.
- EPIC-006 (highest priority): shared tier defaults/overrides, autopilot,
  review readiness, and enforced merge/verify/cleanup activation.
- EPIC-007 (after EPIC-006 completion): fresh reviewer contexts, role routing,
  strict verdicts, gh-identity integration, and host review checks.
- EPIC-008 (after EPIC-007): Staff/Principal decision routing and escalation.
- EPIC-009 (after EPIC-008): environment evidence, UI review, and settings.
- EPIC-010 (after EPIC-009): Agent Alert notifications and adoption verification.
