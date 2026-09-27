---
kind: epic
id: EPIC-006
owner: "Codex"
status: in-progress
revision: 1
parent: ../../project/project-plan.md
parent_revision: 3
security:
  auth: true
  data: true
  external: true
  concerns:
    [
      SEC-GOV-001,
      SEC-GOV-002,
      SEC-GOV-003,
      SEC-GOV-004,
      SEC-GOV-005,
      SEC-GOV-006
    ]
  rationale: "Changes accepted-policy authority, persisted workflow records and
    authenticated GitHub review/completion boundaries."
accessibility:
  ui: false
  rationale: "CLI governance, policy, tests, CI and agent guidance; no user-facing
    UI. Existing conditional accessibility gates remain required."
qa_requirements:
  [
    QA-GOV-001,
    QA-GOV-002,
    QA-GOV-003,
    QA-GOV-004,
    QA-GOV-005,
    QA-GOV-006,
    QA-GOV-007,
    QA-GOV-008,
    QA-GOV-009,
    QA-GOV-010
  ]
approvals:
  principal_engineer: null
  appsec:
    by: "Codex AppSec reviewer /root/appsec_plan_review"
    date: "2026-09-26"
    revision: 1
    notes: "Independent canonical epic triage against approved detailed plan.
      SEC-GOV-001 through SEC-GOV-006 are enumerated, touched and mapped to
      provenance, authenticated evidence, enforcement trust, durable state,
      scoped authority and completion/cleanup. Auth/data/external true and UI
      false are accurate. No triage gaps. Separate plan/final reviews remain."
  qa_lead:
    by: "Codex QA Lead /root/qa_bar"
    date: "2026-09-26"
    revision: 1
    notes: "Independent canonical epic review of all 17 task contracts against
      detailed-plan revision 2 and QA-GOV-001 through QA-GOV-010. Exact contract
      transcription and serial dependencies verified; unchanged QA bar,
      preserved assertions, exact-head review, uncertain-dispatch reconciliation
      and separate release activation/cleanup evidence. No QA plan blockers."
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-006: activate governance first

## Outcome and scope

Implement the owner-approved governance proposal and detailed plan in project/.
Highest current priority. Complete and verify activation before starting EPIC-007.
Initial plan PR: https://github.com/dpitcock/ai-toolkit/pull/11 (merged).
All implementation is isolated on epic/EPIC-006; other worktrees are preserved.

## AppSec concerns

- SEC-GOV-001: accepted policy provenance and stale authority.
- SEC-GOV-002: authenticated host review evidence and exact-head races.
- SEC-GOV-003: candidate-controlled enforcement and bootstrap trust.
- SEC-GOV-004: durable state, claims, reconciliation and concurrency.
- SEC-GOV-005: caller-controlled identity, scope and authority.
- SEC-GOV-006: typed completion facts and safe owned cleanup.

All concerns are touched. Follow mappings and mitigations in the detailed plan;
independent AppSec triage and plan approval remain separate gate records.

## QA requirements

QA-GOV-001 through QA-GOV-010 are defined in project/EPIC-006-QA.md.
Use focused RED/GREEN checks per canonical task, preserve all existing assertions,
then run the full suite. Actual runtime/host activation is release evidence,
not a task that must claim merge complete before the final-review gate.

Immediate personal-use verification follows
`project/EPIC-006-personal-use-checkpoint.md`. Its focused local milestone and
explicit release deferrals do not replace this canonical QA bar or establish
activation, completion, or next-epic admission.

## Dependencies and ownership

Developer: Codex. Delivered EPIC-001 through EPIC-005 are historical foundations.
Their approval/cleanup records are not fabricated or reinterpreted. QA, Principal,
and AppSec are explicitly assigned independent sessions. No UI review is needed
for this epic; regression tests retain conditional UI floors.
