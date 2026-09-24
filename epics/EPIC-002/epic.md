---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic
id: EPIC-002
owner: "Codex"
status: in-progress
revision: 1
parent: ../../project/project-plan.md
parent_revision: 1
security:
  auth: false
  data: false
  external: false
  concerns: []
  rationale: "Governance-only validation; no runtime external boundary changes."
accessibility:
  ui: false
  rationale: "Changes review governance for user-facing UI epics."
qa_requirements: [ QA-001 ]
approvals:
  principal_engineer:
    {
      by: "Dennis",
      date: "2026-09-24",
      notes: "Approved EPIC-002 scope.",
      revision: 1
    }
  appsec: not-required
  qa_lead: { by: "Dennis", date: "2026-09-24", notes: "Approved QA-001.", revision: 1 }
  code_review: null
  appsec_review: null
  accessibility:
    null
  accessibility_review: null
---

# EPIC-002

## Outcome and scope
Complete the already-implemented conditional WCAG 2.2 AA governance gate:
user-facing UI epics require independent accessibility triage, plan signoff,
and final review; non-UI epics explicitly bypass those conditional approvals.
The scope includes the validator, canonical templates, workflow guidance, and
regression coverage. It does not add or change a user-facing interface.

## AppSec concerns
No concerns apply. The change has no authentication, data, or runtime external
boundary; `approvals.appsec: not-required` is the recorded triage decision.

## QA requirements
QA-001: `npm test` validates UI-signoff sequencing, final reviewed-commit
approval, complete approval schemas, and scaffold compatibility.

## Accessibility triage
`accessibility.ui: false`: this work changes governance artifacts and tests, not
a product interface. No accessibility approval is required for this epic.

## Dependencies and ownership
Owner: Codex; depends on the approved project baseline. The sole task captures
the completed implementation and its scaffold-regression follow-up.
