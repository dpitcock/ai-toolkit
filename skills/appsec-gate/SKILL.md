---
name: appsec-gate
description: Provides AppSec gate guidance. Use when triaging an epic, signing off a security-sensitive epic plan, or conducting final pre-merge security review.
---

# Appsec Gate

Use the existing agent-skills security-auditor persona and security-and-hardening skill. This skill adds governance only. Read docs/gates.md for field formats and commands.

1. **Epic triage:** assess auth, data and external boundaries and known concerns. Record stable concern IDs and rationale. If any boundary or concern is present, AppSec records epic approvals.appsec with threat-model notes; otherwise EM records not-required and the low-risk rationale. QA approval is always required. Epic triage is not plan approval.
2. **Plan signoff:** map every epic concern to touched or unaffected in the plan body; set touches_concerns and plan boundary flags explicitly. Principal approval comes first. Any touched concern or auth/data/external boundary requires AppSec approval in awaiting-appsec-signoff. Otherwise use not-required. Uncertain scope stays awaiting review, never defaults to low risk.
3. **Final review:** always required, even for low-risk epics. Only after staff code review, inspect the exact implementation commit with the upstream auditor/checklist. Verify threat mitigations, authorization and tenant isolation where applicable, input/output boundaries, data handling, secrets/dependencies, and security regression evidence. Record findings; unresolved blocking issues prevent approval. Record appsec_review with by, date, notes, revision and commit. Transition to ready-for-pr through the validator.

## Common rationalizations

| Claim | Required response |
|---|---|
| Epic triage already passed | That does not approve a design or implementation. |
| Principal approved it | Sensitive plans still need AppSec signoff. |
| It is only a small change / emergency | Final security review remains required. |
| AppSec is unavailable | Keep this epic blocked; work on independent approved tasks. |
| Developer can impersonate the auditor | Only the assigned independent reviewer records approval. |

## Verification

Check explicit boundary assessments, current revision, actual reviewer evidence, and the successful gate command. Never advance on an absent, self-issued, or stale approval. Final review must cover the same commit as code review.
