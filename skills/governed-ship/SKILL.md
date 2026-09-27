---
name: governed-ship
description: Use when opening a PR, invoking /ship, finishing a development branch, or merging an epic in an agent-workflow-blueprint project.
---

# Governed Ship

First honor AGENTS.md's repository-specific path-review route. For a verified
toolkit `authoring` diff, require relevant tests, independent Code Reviewer on
the current commit and PR-only delivery, not the epic/event/AppSec chain below.
The trusted host gate independently checks the full diff. Production and
legacy routes retain these gates; do not waive existing PR requirements.

## Event-boundary adapter contract

Before dispatching review or merge-readiness work, start a fresh task session
and have the authenticated embedding harness import `runWorkflowEvent` from
`scripts/workflow-event.mjs`. Invoke
`runWorkflowEvent([EVENT, '--root', PATH], {actor, observers})` with bounded JSON
stdin for `review.ready` or `merge.eligible` under stored, accepted authority.
The standalone CLI fails closed. Actor context comes from actual harness
observation out-of-band, never event JSON or environment claims. Synchronous
observer callbacks supply live host facts under the state lock; see
`docs/workflow.md`. JSON and authenticated flags are cooperative evidence. The event
cannot create approval or alter the resolved repository, branch, scope, or
policy. A failed event blocks dispatch. Pushes and tests never launch review
work. Only a current-head `review.ready` event may dispatch an independent
review; submit completed verdicts with gh-identity's stdio MCP and verify the
host review head afterward. Agent Alert is limited to authorized agent
messaging. Slack text/prefixes are never credentials. Native host protections,
required checks, tool limits, and PR-only merging remain mandatory.

The staged `plan-pr` and `implementation-pr` validator actions do not waive the
active repository's pre-PR instructions below. EPIC-006 bootstrap retains those
instructions until approved integration and explicit migration/activation.
Historic metadata-only allowances never satisfy the new live merge gate:
recheck authenticated host role approvals on the exact current head, even
after metadata commits. After merge, completion and next-epic admission require
integrated checks/smoke, actual adoption and safe owned cleanup receipts.

1. Read docs/gates.md. All tasks must be done with local RED/GREEN/QA evidence and separate commits, and the full QA bar must pass. Use agent-skills code-reviewer for the independent five-axis staff review of the final implementation revision. Record each finding in review_comments. If the reviewer requests fixes, commit them and request a new code review; only after that reviewer verifies every resolution on the final review_commit may it record code_review and move in-review → in-appsec-review with the validator. Tasks and intermediate commits do not require staff review approval.
2. Run appsec-gate for mandatory final review. Record appsec_review for that same commit. For UI plans, run accessibility-review against that commit, record accessibility_review, and transition through in-accessibility-review before ready-for-pr.
3. For Tier 3, confirm the final reviewed commit remains bound to immutable assessment evidence for the named approved plan, its listed task, the registered isolated worktree/`epic/EPIC-NNN` branch, and accepted-policy/effective-role provenance. Required configured-role evidence is principal, qa, appsec, and accessibility_reviewer; preserve conditional UI accessibility triage, plan approval, and final review. CI reconstructs committed facts but cannot prove historical registration. This template is PR-only: local validators do not push or merge, and host protection enforces the cooperative boundary.
4. Immediately before upstream finishing-a-development-branch or /ship opens the implementation PR, run `node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md pr`. For the strictly status-only follow-up after confirmed merge, use `finalization-pr` instead; it authenticates the original merge and rejects changes to reviewed source, policy, bodies, approvals or evidence. A failure stops PR creation, including drafts. Do not choose upstream direct local merge.
5. Delegate branch finishing and verification to Superpowers; use agent-skills shipping-and-launch for release requirements. Include review identities, commit and test evidence in PR body. Obtain host checks/required reviews, re-run the PR gate immediately before merge, and merge via PR.
6. Record the original pr_url and transition plan, then epic, to merged with `check-gate.mjs DOCUMENT merged --write` only after the host confirms merge. The CLI fetches authenticated host evidence itself. Commit only the permitted status/PR markers for the finalization PR; preserve the original implementation URL. Publish independent verdicts on the finalization PR's own exact head and merge through its host gates. Completion retains the original merge identity while verifying the finalization integration. A new implementation commit invalidates both final reviews. Return plan to in-progress through the validator and repeat code review before AppSec review after fixes. Metadata-only approval commits do not invalidate final reviews.
