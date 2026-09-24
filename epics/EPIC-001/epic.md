---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic
id: EPIC-001
owner: "Codex"
status: merged
revision: 1
parent: ../../project/project-plan.md
parent_revision: 1
security:
  auth: true
  data: false
  external: true
  concerns: [ SEC-001, SEC-002 ]
  rationale: "The template does not process events or store state, but it defines
    required controls for untrusted Slack/GitHub events and explicit
    authorization of provider actions. Both controls need AppSec review before
    the documentation/configuration contract is released."
qa_requirements: [ QA-001, QA-002, QA-003 ]
approvals:
  principal_engineer:
    by: "Dennis"
    date: "2026-09-24"
    notes: "Approved EPIC-001 scope, boundaries, and task direction for revision 1."
    revision: 1
  appsec:
    by: "Andrei"
    date: "2026-09-24"
    notes: "Approved triage of SEC-001 and SEC-002; plan signoff remains required
      because the contract documents external and authorization boundaries."
    revision: 1
  qa_lead:
    by: "Karen"
    date: "2026-09-24"
    notes: "Approved QA-001 through QA-003: descriptor contract, scaffold
      preservation, and full regression/documentation-boundary verification."
    revision: 1
  code_review: null
  appsec_review: null
---

# EPIC-001

## Outcome and scope
Add a provider-neutral Slack control-plane guide and a non-secret, Codex-enabled
workspace descriptor to generated projects. The template establishes operational
contracts only; it does not deploy a Slack application, accept live events, or store
credentials, channel IDs, or session state.

## AppSec concerns
Assigned reviewer: Andrei (triage approved on 2026-09-24).

- **SEC-001 — Untrusted event and identity boundary:** The guide must require signature
  verification, explicit provider mentions, mapping resolution, and idempotency before
  routing any Slack or GitHub delivery. No live credentials or mutable delivery records
  may be committed.
- **SEC-002 — Agent authorization boundary:** The guide must distinguish completion,
  action-required, and blocked states; require an explicit requester notification and
  preserve explicit authorization for irreversible actions. It must not imply that a
  Slack message authorizes external side effects.

AppSec triage is required because the template defines future external and authorization
boundaries. This triage does not approve the later epic-plan design or release.

## QA requirements
Assigned reviewer: Karen (QA requirements approved on 2026-09-24).

- **QA-001 — Descriptor contract:** Add a focused Node test that parses the YAML example
  and verifies its Codex provider, derived channel name, timezone/schedule fields, and
  absence of live Slack state. Run it red before creating the descriptor and green
  afterward.
- **QA-002 — Scaffold preservation:** Extend the real temporary-worktree scaffold test
  to prove the descriptor reaches an isolated epic worktree. Run it red when the
  fixture omits `config`, then green after including it.
- **QA-003 — Regression and documentation boundary:** Run `npm test` and `git diff
  --check`; manually verify the guide documents all required routing, PR, daily-summary,
  safety, action-required, and Codex-only capability behavior without claiming that a
  live Slack integration exists.

## Dependencies and ownership
Owner: Codex. Depends on approved project revision 1 and the committed Slack
control-plane design/implementation plan. This epic has no runtime-service dependency;
the external control-plane deployment is intentionally out of scope.
