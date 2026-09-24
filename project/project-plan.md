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
revision: 1
approvals:
  principal_engineer:
    by: "Dennis"
    date: "2026-09-24"
    notes: "Approved provider-neutral Slack control-plane scope and Codex-first
      rollout; reviewed the design and implementation plan."
    revision: 1
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# Project Plan

## Goal and scope
Evolve the generated-project template with a provider-neutral Slack control-plane
contract. Codex is the first provider; the contract must permit later Cline and
Claude adapters without changing Slack routing or stored thread records.

## Success criteria
- Generated projects document the Slack routing, session, pull-request, and
  daily-summary contracts.
- Each project declares one non-secret workspace descriptor named
  `ws-<repo-name>-<provider>`.
- Live credentials, channel IDs, and mutable session state remain external to Git.
- Shared agent governance remains unchanged until a provider-specific adapter is
  intentionally enabled.

## Constraints
- This template supplies documentation and configuration examples, not a deployed
  Slack service or credentials.
- Slack messages are routing inputs, not implicit authorization for irreversible
  external actions.
- The initial user-edited README change is outside this scope and must be preserved.

## Timeline
1. Approve the control-plane design and project scope.
2. Create an approved epic and implement the documentation/configuration template.
3. Validate scaffold behavior and review the generated-project guidance.

## Epic decomposition (EM + Principal)
EPIC-001 (planned): provider-neutral Slack control-plane template and Codex-first
adapter guidance. Depends on project approval and QA/AppSec triage.
