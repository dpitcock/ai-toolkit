# Agent workflow blueprint

For project development, read docs/roles.md and docs/workflow.md at session start. Governance below is the outer workflow for every upstream skill and lifecycle command. Resolve paths from the repository/worktree root. Bootstrap: `bash scripts/init-project.sh`; missing skills are an installation problem, never permission to skip gates.

| Intent / command | Required local workflow before upstream skill |
|---|---|
| goal, /spec | EM uses agent-skills interview/idea refinement + Superpowers brainstorming; write project plan |
| /constraints | QA Lead uses test-engineer + constraint-driven-development; record epic QA bar |
| /plan, epic assignment | Read skills/governed-plan/SKILL.md |
| /build, /test, implement, execute plan, subagent-driven-development | Read skills/governed-build/SKILL.md |
| /review, security review | Read skills/appsec-gate/SKILL.md; code-reviewer owns staff rubric |
| /ship, finish branch, create PR, merge | Read skills/governed-ship/SKILL.md |

Before every status transition run `node scripts/check-gate.mjs DOCUMENT TARGET --write`. Never edit status to bypass validation, fabricate a reviewer, reuse stale approvals, or reinterpret missing approval as consent. Reviewers are distinct assigned people or explicitly assigned independent agent sessions; the developer cannot approve its own work. Record actual review findings with identity/date/revision. A missing gate pauses only that epic; independent approved work may continue.

Read upstream skills from `skills/upstream/{superpowers,agent-skills}/skills/NAME/SKILL.md` when native discovery is unavailable. Read agent-skills personas from its `agents/` directory; resolve missing shared references from that upstream checkout. Superpowers owns TDD, worktrees and task execution. Local gates override upstream workflow shortcuts. Use a fresh task context with only its plan, relevant interfaces, and QA requirements.

Each epic has an isolated worktree and branch; this is the standing worktree preference. Load Superpowers using-git-worktrees before scripts/new-epic.sh. Do not fall back to shared-checkout implementation on a worktree failure. One task at a time per epic, separate commit per task with local RED/GREEN/QA evidence. Task completion does not require staff code-review approval. Concurrent epics are allowed; independent tasks across those epics can run simultaneously. Within-epic parallelism requires separate task worktrees, explicit dependency/file ownership, and developer-controlled integration.

After all tasks and the full QA bar, obtain independent five-axis staff code review on the final implementation revision, followed by mandatory AppSec review of that same revision. Later implementation changes require both final reviews again. Do not open even a draft PR before both final reviews pass. Only PR-based merge is permitted. Files are cooperative governance, not authenticated authorization: see docs/gates.md for host enforcement and limitations.

## Proportional task routes

Before changing source for an ordinary bounded task, confirm the workspace policy is accepted with `node scripts/init-workspace.mjs status --root .`; resolve any pending policy review first. Run preflight in a clean, registered worktree with explicit scope, all risk answers, UI status, intended paths, and accessibility evidence:

```sh
node scripts/preflight.mjs --id quick-fix --coordination-root . --worktree-root . < answers.json
git add project/task-assessments/quick-fix.yaml
git commit -m "evidence: classify quick-fix"
```

That initial assessment commit must be the sole changed path and a direct child of its recorded `startingHead`, before implementation. Tier 1 excludes UI and is limited to a low-risk, single-file change; after implementation run `node scripts/check-tier1.mjs --assessment project/task-assessments/quick-fix.yaml`. The final diff may raise the tier, never lower the preflight tier. Tier 1 direct merge is disabled by default; direct merge is never allowed for this template repository. An adopter may consider enabling it only through an explicitly accepted policy and compatible host rules. `check-tier1.mjs` can report `Direct merge eligible: yes` when accepted config enables it; that generic result does not enforce this template's PR-only rule, so host protections must prevent bypass.

Tier 2 changes use the PR route. Record valid self-check or independent review evidence, plus every configured role approval from a reviewer independent of the developer, against the exact reviewed implementation commit. Then rely on the existing PR check (`BASE_SHA` and `HEAD_REF` are supplied by `.github/workflows/workflow.yml`, which runs `node scripts/check-pr.mjs`). UI is never Tier 1: Tier 2 UI requires independent accessibility triage and plan evidence before implementation, plus independent final accessibility review on the reviewed commit. High risk, unknown answers, uncertainty, or a final diff that reclassifies as Tier 3 must use the governed epic/plan/task route and its required signoffs. Local checks validate supplied evidence and diff history; they do not authenticate reviewers or enforce repository-host policy.

Tier 3 runs only in a registered isolated worktree on its `epic/EPIC-NNN` branch, distinct from the coordination root. Its immutable first assessment binds the approved plan and listed task to that branch and accepted-policy provenance; `check-pr.mjs` reconstructs the committed binding before admitting the named plan. Required configured-role evidence is limited to principal, qa, appsec, and accessibility_reviewer, while existing independent final code and AppSec review remain mandatory. Conditional UI accessibility triage, plan approval, and final review remain mandatory whenever the named plan declares UI work. This template is PR-only: validators do not push or merge, and host protections—not cooperative local files—enforce the protected-branch boundary.

## Tool execution and handoffs

The Cline adapter has an explicit handoff boundary because it lacks native Superpowers session hooks and subagent dispatch. When Cline reaches work it cannot safely complete in its session—such as an external authorization, credentials, a missing product decision, or an independent approval—it must provide a concise handoff naming the current document/state, completed evidence, blocker, and exact next action. It must not silently bypass a gate or infer authorization.

Codex and Claude Code continue autonomously through ordinary in-scope planning, implementation, testing, review coordination, and governed transitions. They should involve the user only when clarification, credentials, external coordination, or a decision that materially changes scope is required. They must still honor every approval gate: an independent reviewer may approve only after an actual review, and an agent may not manufacture an approval or treat its absence as consent.

## File reading

This section and File writing below are the authoritative, tool-neutral file-handling policies for this repository. Their thresholds are repository policy, not claims about model limits.

- Prefer targeted searches and relevant line ranges.
- Reuse notes or summaries for unchanged content.
- Re-read relevant sections when content is uncertain, context was lost, or files may have changed.
- For files of 500+ lines used repeatedly, retain a brief working summary of relevant sections and approximate line ranges. Keep working summaries in task context unless file writes are authorized.
- Avoid repeated whole-file reads; narrow the scope when reads repeat.
- Verify exact current text before editing when uncertain.

## Context budget checkpoint

When reported context usage reaches roughly 75% of the available
window, or context pressure suggests a handoff is needed, post a
concise plain-text checkpoint before continuing work.

Include:

- What has been completed and verified.
- What remains, including blockers and the next action.
- Key decisions, constraints, and relevant file paths.
- Useful section names or approximate line anchors.

Use reported usage when available; do not invent a percentage.
The 75% threshold is repository policy, not a claim about model limits.

Keep the checkpoint in the conversation unless writing a handoff file
is authorized. A fresh session can use it to resume, but must verify
current file content where needed before editing.

## File writing

- Use native patch/edit tools.
- Estimate write size first. Split output likely to exceed roughly 200–300 lines, or whose size is uncertain, into logical chunks.
- Prefer targeted edits to existing files, preserving unrelated content.
- Verify completed files in bounded ranges for missing sections or truncation.
- Repair truncated writes with smaller edits rather than repeating a large write.
- Never use inline multiline terminal strings to write file content.
