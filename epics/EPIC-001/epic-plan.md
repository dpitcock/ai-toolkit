---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic-plan
id: EPIC-001-PLAN
owner: "Codex"
status: in-appsec-review
revision: 1
parent: epic.md
parent_revision: 1
security:
  auth: true
  data: false
  external: true
  concerns: [ SEC-001, SEC-002 ]
  rationale: "This plan documents controls for future Slack/GitHub event routing
    and provider authorization. It creates no runtime integration, but the guide
    and descriptor must preserve the security boundary exactly."
touches_concerns: [ SEC-001, SEC-002 ]
tasks: [ tasks/TASK-001.md, tasks/TASK-002.md ]
review_commit: null
pr_url: null
approvals:
  principal_engineer:
    by: "Dennis"
    date: "2026-09-24"
    notes: "Approved revision 1 task sizing, interfaces, TDD evidence, and
      provider-neutral design boundary."
    revision: 1
  appsec:
    by: "Andrei"
    date: "2026-09-24"
    notes: "Approved plan signoff for SEC-001 and SEC-002: external state,
      signature/mention/idempotency guidance, and explicit authorization
      boundaries are mapped to QA evidence."
    revision: 1
  qa_lead: null
  code_review:
    by: "Dennis"
    date: "2026-09-24"
    notes: "Independent staff review approved the completed Slack template
      implementation against correctness, readability, architecture, security,
      and performance. No findings were supplied."
    revision: 1
    commit: "4bbbe67b721999ee37cdfbb004d1ae9abcd29188"
  appsec_review: null
---

# EPIC-001 Epic Plan

## Design
Create a non-secret YAML descriptor for one `repository + environment + provider`
workspace and an operator guide for the external, provider-neutral Slack control plane.
The example enables Codex only and uses `ws-<repo-name>-<provider>` channel names. It
does not contain credentials, Slack channel IDs, thread timestamps, or provider session
IDs. The guide defines external state and all routing/turn/PR/daily-summary/safety
contracts; a short optional link in `docs/workflow.md` makes it discoverable without
changing local agent behavior.

## Security mapping
- **SEC-001 touched:** the guide specifies signature verification, explicit mentions,
  workspace resolution, idempotency keys, least privilege, and external state. QA-003
  requires a manual boundary review; the descriptor test ensures no live state is added.
- **SEC-002 touched:** the guide specifies `COMPLETE`, `ACTION REQUIRED`, and `BLOCKED`;
  it requires requester notification, a waiting-for-input session state, and explicit
  authorization for irreversible actions. QA-003 verifies this is documented without
  claiming runtime enforcement.

## Small tasks
- `tasks/TASK-001.md`: descriptor contract and operator guide; run its new test RED then
  GREEN. Covers QA-001 and QA-003. No dependency.
- `tasks/TASK-002.md`: preserve the descriptor in a real temporary isolated worktree;
  run the scaffold test RED then GREEN. Covers QA-002 and QA-003. Depends on TASK-001.

## Review evidence
Staff review: correctness, readability, architecture, security, performance. Record findings and fixes; mandatory AppSec final review follows.
