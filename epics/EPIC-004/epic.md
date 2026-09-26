---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic
id: EPIC-004
owner: "Codex"
status: merged
revision: 2
parent: ../../project/project-plan.md
parent_revision: 2
security:
  auth: false
  data: false
  external: false
  concerns: [ SEC-TIER-DOWNGRADE ]
  rationale: "The CLI handles no credentials or user data and does not call
    external services, but its classification influences which review path an
    adopting repository follows. AppSec must review conservative sensitive-path
    escalation, committed assessment provenance, and the acknowledged boundary
    that local evidence is cooperative rather than authenticated."
accessibility:
  ui: false
  rationale: "This epic changes repository scripts, CI checks, and agent guidance;
    it does not build or change a user-facing application interface. UI
    classification remains a mandatory safety input."
qa_requirements:
  - QA-004-CLASSIFICATION
  - QA-004-PREFLIGHT
  - QA-004-TIER1
  - QA-004-TIER2
  - QA-004-SCAFFOLD
approvals:
  principal_engineer: null
  appsec:
    by: "/root/epic004_appsec_triage"
    date: "2026-09-25"
    notes: "Approved AppSec triage for revision 2: sensitive-path escalation and
      committed assessment provenance address SEC-TIER-DOWNGRADE;
      cooperative-control limits are explicit. No remaining triage blockers."
    revision: 2
  qa_lead:
    by: "/root/epic004_qa_triage"
    date: "2026-09-25"
    notes: "Approved QA triage for revision 2: staged Tier-2 UI evidence,
      generated-adopter command execution, and Tier-1 read-only boundary are
      covered; no blockers remain."
    revision: 2
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-004

## Outcome and scope
Add fail-closed scope/risk classification and proportional Tier 1 and Tier 2 checks for repositories adopting this template. The preflight uses the accepted unified workspace configuration, records its decision and evidence, and reports effective policy sources. Final checks reclassify against the actual diff and may only preserve or raise the recorded tier. Tier 1 is unavailable for UI, high-risk, or uncertain work; Tier 2 requires a PR and its configured review evidence. Tier 3 continues through the existing epic/task gates; its configured-role resolution and complete enforcement integration remain in EPIC-005.

## AppSec concerns
Use stable IDs in security.concerns. For low-risk scope record rationale and appsec: not-required; otherwise circulate to AppSec. This is triage, not design approval.

## QA requirements
- QA-004-CLASSIFICATION: table-driven unit coverage for eligible Tier 1/2 cases, each high-risk boundary, known sensitive paths falsely declared low-risk, unknown/missing answers, staged UI eligibility, mismatched claims, and monotonic escalation.
- QA-004-PREFLIGHT: integration coverage for accepted-config validation, provenance output, assessment persistence and commit-bound initial evidence, malformed inputs, unsafe assessment IDs/paths, tampered initial facts, and policy-digest drift.
- QA-004-TIER1: integration coverage proving the final diff is reclassified, expansion cannot stay Tier 1, opt-in policy defaults off, and the check exposes no merge, push, branch-deletion, or PR-only bypass operation.
- QA-004-TIER2: PR-check coverage for required configured role evidence, author/reviewer separation, reviewed-commit consistency, staged UI accessibility evidence (preflight triage/plan and final reviewed-commit review), and preservation of existing EPIC plan checks.
- QA-004-SCAFFOLD: generated-project integration tests run initializer/preflight, Tier 1 and Tier 2 validators, and the current PR check with accepted EPIC-003 configuration and valid evidence fixtures.

## Accessibility triage
No user-facing UI is changed, so accessibility.ui remains false. The classifier and Tier 2 validator must still prevent Tier 1 UI work; Tier 2 UI needs independent accessibility triage and plan evidence before work, then final evidence on the reviewed commit. Missing staged evidence escalates to Tier 3.

## Dependencies and ownership
Depends on the unified accepted workspace-config API and history from EPIC-003, already present on the current main baseline. Codex owns implementation. Principal approves the plan before build; AppSec reviews SEC-TIER-DOWNGRADE; QA Lead approves the listed QA bar. EPIC-005 owns Tier 3 configured-role resolution, isolated-worktree enforcement, and complete scaffold/CI integration. This template remains PR-only throughout this epic.
