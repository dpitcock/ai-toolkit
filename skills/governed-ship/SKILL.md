---
name: governed-ship
description: Use when opening a PR, invoking /ship, finishing a development branch, or merging an epic in an agent-workflow-blueprint project.
---

# Governed Ship

1. Read docs/gates.md. All tasks must be done with tests/commits recorded. Use agent-skills code-reviewer for the five-axis staff review. Record each finding in review_comments. If the reviewer requests fixes, commit them and request a new code review; only after that reviewer verifies every resolution on the final review_commit may it record code_review and move in-review → in-appsec-review with the validator. Intermediate commits do not require review approval.
2. Run appsec-gate for mandatory final review. Record appsec_review for that same commit. For UI plans, run accessibility-review against that commit, record accessibility_review, and transition through in-accessibility-review before ready-for-pr.
3. Immediately before upstream finishing-a-development-branch or /ship opens any PR, run `node scripts/check-gate.mjs epics/EPIC-001/epic-plan.md pr`. A failure stops PR creation, including drafts. Do not choose upstream direct local merge.
4. Delegate branch finishing and verification to Superpowers; use agent-skills shipping-and-launch for release requirements. Include review identities, commit and test evidence in PR body. Obtain host checks/required reviews, re-run the PR gate immediately before merge, and merge via PR.
5. Record pr_url and transition plan to merged only after the host confirms merge; then mark epic merged in a follow-up metadata commit. A new implementation commit invalidates both final reviews. Return plan to in-progress through the validator and repeat reviews after fixes.
