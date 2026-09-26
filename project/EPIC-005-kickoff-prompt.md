# EPIC-005 Kickoff Prompt

Resume project delivery by creating and executing EPIC-005 from the current
`main` branch of `ai-toolkit`.

Read `AGENTS.md`, `docs/roles.md`, `docs/workflow.md`, and `docs/gates.md`
before acting. Use the required governed-plan, governed-build, appsec-gate,
governed-ship, and applicable Superpowers skills. Create an isolated EPIC-005
worktree and branch; do not modify merged EPIC-001 through EPIC-004 worktrees
or rewrite their commits.

EPIC-005 depends on merged EPIC-003 and EPIC-004. Its scope is the remaining
project-plan deliverable: Tier 3 configured approvals, isolated-worktree and
PR enforcement, CI integration, and end-to-end scaffold verification. Preserve
the template's PR-only policy, independent final code/AppSec reviews, UI
accessibility gates, and the cooperative-control limitations already documented.

Before implementation, create the epic and plan from canonical templates,
obtain fresh QA/AppSec/accessibility triage as applicable, and obtain the
required independent plan approvals. Use TDD for every implementation task,
keep separate task commits and evidence, and request staff code review only for
the final PR implementation revision and later implementation revisions.

Do not push, open a PR, merge, or claim approval without explicit user
authorization. Stop for user direction only when EPIC-005 is ready for PR
creation or a real external decision/blocker remains.
