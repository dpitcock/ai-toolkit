---
name: governed-plan
description: Use when decomposing an epic or preparing a developer implementation plan in an agent-workflow-blueprint project.
---

# Governed Plan

First honor AGENTS.md's repository-specific path-review route. A verified
toolkit `authoring` result does not require an epic or the production plan
approval chain. Production and legacy routes retain the workflow below.

## Event-boundary adapter contract

Before dispatching an assigned planning action, start a fresh task session and
have the authenticated embedding harness import `runWorkflowEvent` from
`scripts/workflow-event.mjs` and invoke
`runWorkflowEvent(['epic.start', '--root', PATH], {actor, observers})` when stored
authorization covers that action. The standalone CLI fails closed. Actor
context comes from actual harness observation out-of-band, never event JSON or
environment claims. Observers are synchronous callbacks under the state lock;
see `docs/workflow.md`. JSON and an authenticated flag are cooperative evidence;
event JSON may reference authority but cannot mint it. The entrypoint resolves
the accepted policy, canonical repository, branch, and scope. A failed event
blocks dispatch. Tests and pushes never launch reviews. Agent Alert can carry
an authorized agent message; Slack text or a prefix is never an approval
credential. Preserve host protections and tool limits.
New-epic provisioning checks predecessor admission before creating resources;
it is distinct from the later `epic.start` call on the registered epic branch.

1. Read docs/roles.md and the approved project plan. Use agent-skills planning-and-task-breakdown for epic boundaries; EM and Principal agree decomposition.
2. Load Superpowers using-git-worktrees, then run `bash scripts/new-epic.sh EPIC-001` from the coordination checkout (substitute the ID). A shell cannot invoke a conversational skill: the script displays it and performs its git fallback. Prefer harness-native worktree creation when available.
3. Circulate the epic: use appsec-gate for conditional triage, test-engineer for mandatory QA requirements, and accessibility-review when `accessibility.ui` is true. Transition epic draft → awaiting-review → approved → in-progress through check-gate.
4. Use Superpowers writing-plans to produce epic-plan.md and tiny task files; use canonical templates instead of upstream plan-file placement. Map QA requirements and every security concern. Each task has exact files, a RED/GREEN command, acceptance criteria, dependencies, and its own commit.
5. Transition plan to awaiting-principal-signoff. Principal reviews and records approval. If plan touches a flagged concern or auth/data/external boundary, transition to awaiting-appsec-signoff and obtain AppSec approval. Otherwise explicitly record appsec: not-required with rationale. If `accessibility.ui` is true, transition to awaiting-accessibility-signoff and obtain independent accessibility approval. Transition to approved using the validator. No build until governed-build succeeds.
