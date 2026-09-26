---
kind: epic-plan
id: EPIC-006-PLAN
owner: "Codex"
status: in-progress
revision: 1
parent: epic.md
parent_revision: 1
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
touches_concerns:
  [
    SEC-GOV-001,
    SEC-GOV-002,
    SEC-GOV-003,
    SEC-GOV-004,
    SEC-GOV-005,
    SEC-GOV-006
  ]
tasks:
  - tasks/TASK-000.md
  - tasks/TASK-001.md
  - tasks/TASK-002.md
  - tasks/TASK-003.md
  - tasks/TASK-014.md
  - tasks/TASK-004.md
  - tasks/TASK-005.md
  - tasks/TASK-006.md
  - tasks/TASK-007.md
  - tasks/TASK-008.md
  - tasks/TASK-009.md
  - tasks/TASK-010.md
  - tasks/TASK-011.md
  - tasks/TASK-012.md
  - tasks/TASK-015.md
  - tasks/TASK-016.md
  - tasks/TASK-013.md
review_comments: []
review_commit: null
pr_url: null
approvals:
  principal_engineer:
    by: "Codex Principal reviewer /root/principal_scope_review"
    date: "2026-09-26"
    revision: 1
    notes: "Independently reviewed canonical plan and all 17 tasks against approved
      detailed-plan revision 2 plus host addendum. Exact task contracts, serial
      dependencies, architecture, interfaces and sizing verified. All security
      concerns remain touched; QA/AppSec and immutable preflight remain
      required. Registered isolated worktree verified; no implementation
      approval."
  appsec:
    by: "Codex AppSec reviewer /root/appsec_plan_review"
    date: "2026-09-26"
    revision: 1
    notes: "Independently reviewed canonical plan after recorded Principal approval
      in awaiting-appsec-signoff. All 17 contracts exactly match the approved
      detailed plan and host addendum. SEC-GOV-001 through SEC-GOV-006
      explicitly touched and mitigated: provenance, exact-head host evidence,
      trusted enforcement, claim reconciliation, session authority and typed
      completion/owned cleanup. QA and separate activation evidence intact. No
      blocking plan findings; final AppSec follows final staff review."
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# EPIC-006 canonical implementation plan

## Design and interfaces

Faithful materialization of project/EPIC-006-implementation-plan.md revision 2,
including its host-discovery addendum, task interfaces, common contracts and
release phase. Spec: project/governance-first-proposal.md. Initial plan review
and QA evidence are in project/EPIC-006-plan-reviews.md and EPIC-006-QA.md.
The initial plan-only PR is #11; subsequent ordinary revisions use the same
implementation PR, never another initial plan PR.

## Security mapping

All SEC-GOV-001 through SEC-GOV-006 concerns are touched; none is waived.
001: tasks001/002/003/014/004/006; 002:008/009; 003:009/012/015;
004:005/007/011; 005:006/011; 006:010/011. Use the detailed-plan mitigations.
Current host protections are absent; bootstrap uses independent authenticated
pre-merge inspection and existing checks. Install and verify required host
protections before activation. Local JSON is cooperative evidence only.

## Task execution

The tasks list gives the serial dependency order. Each canonical task preserves
its approved exact paths, behavior, interfaces, focused commands and QA mapping.
TASK-000 fixes the provisioned scaffold baseline (131/134 passed; three copied
history/missing config failures) without suppressing assertions.
No source changes occur before approved canonical gates and immutable preflight.

## QA and release

After all tasks and full QA, independent staff review covers five axes, then
AppSec covers the same implementation revision. Implementation fixes require
renewed final review. Live merge checks use exact host head and actor receipts.
Only after merge, integrated verification, actual-session activation and owned
cleanup may completion release EPIC-007. This release phase is outside task
completion, preventing a merge/task dependency cycle.
