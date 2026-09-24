---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic-plan
id: EPIC-002-PLAN
owner: "Codex"
status: awaiting-principal-signoff
revision: 1
parent: epic.md
parent_revision: 1
security:
  auth: false
  data: false
  external: false
  concerns: []
  rationale: "Governance-only validation; no runtime external boundary changes."
accessibility:
  ui: false
  rationale: "Changes accessibility review requirements for UI epics."
touches_concerns: []
tasks: [ tasks/TASK-001.md ]
review_comments: []
review_commit: null
pr_url: null
approvals:
  principal_engineer: null
  appsec: not-required
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-002 Epic Plan

## Design
The implementation in `41ccf89a1f1f938258df778d7c58b61d19eed8a5` extends the
approval schema with `accessibility` and `accessibility_review`, adds explicit
`accessibility.ui` assessment, and makes WCAG 2.2 AA reviews conditional on UI
scope. It updates the validator's plan-state graph and PR eligibility checks,
the canonical templates, and the workflow documentation. The follow-up commit
`783096728db24849c83e6f215821c485ff865b49` updates the scaffold fixture so its
intentionally rebuilt project frontmatter retains the new approval fields.

## Security mapping
No epic concerns exist and this plan touches none. Authentication, data, and
external boundaries remain false; AppSec plan signoff is therefore not required.

## Accessibility mapping
`accessibility.ui: false` because the plan edits governance and test code only.
The feature being governed requires WCAG 2.2 AA review for future UI epics, but
EPIC-002 itself has no product UI and requires neither accessibility plan
approval nor final accessibility review.

## Small tasks
`tasks/TASK-001.md` records the completed single implementation slice: enforce
conditional accessibility governance and preserve the expanded schema in the
scaffold fixture. It maps to QA-001 and has no dependencies.

## Review evidence
The final review must cover
`783096728db24849c83e6f215821c485ff865b49`, the final implementation commit.
Dennis must independently record the five-axis staff review before final AppSec
reviews that same commit. Findings, if any, belong in `review_comments`.
