# bank-agent-canvas


## Orignial Prompt

```
Goal

Scaffold a template repository called agent-workflow-blueprint that I can clone as the starting point for every new project. It encodes a specific hierarchical software development workflow (modeled on how my team ran projects at AWS) and makes AI coding agents — Claude Code, Cline, and Codex — follow it automatically, using two existing open-source skill frameworks as the underlying engine rather than reinventing skills from scratch:

https://github.com/obra/superpowers — provides the mechanical workflow primitives: brainstorming/spec refinement, git worktrees for concurrent work, subagent-driven-development, strict red/green TDD, code review, and branch finishing.
https://github.com/addyosmani/agent-skills — provides lifecycle skills, slash commands (/spec, /plan, /constraints, /build, /test, /review, /ship), and pre-built specialist personas (code-reviewer, test-engineer, security-auditor) that map closely onto reviewer roles.

Neither framework natively models a multi-role approval hierarchy with sequenced sign-offs. That hierarchy is the part you need to design and wire on top of them. Do not reimplement what the two frameworks already do well — integrate them and add the missing governance layer.

The workflow to encode

This is the process, translated into roles and gates. Every project run through this template goes through these stages in order:

Engineering Manager (EM) receives a project-level goal and writes a Project Plan (scope, success criteria, constraints, timeline).
EM meets with the Principal Engineer to break the Project Plan into Epics.
Each Epic is circulated to:
AppSec — flags security concerns / threat-model notes at the epic level (not yet a full review — just concerns to design around).
QA Lead — defines the testing requirements/bar for that epic (what must be covered, what kind of tests, any special QA requests).
EM assigns Epics to Developers, who can work concurrently on separate epics (and separate epics' tasks can run in parallel too).
Each Developer takes their Epic and writes an Epic Plan: breaks the epic into the smallest possible tasks (small enough to keep an agent's context short and each task independently verifiable/committable).
The Epic Plan requires sign-off from:
Principal Engineer (always required)
AppSec (only if the epic plan touches something AppSec flagged, or touches auth/data/external boundaries)
Once signed off, the Developer builds: implements the epic's tasks one by one, writing unit tests, integration tests, and anything else the QA Lead requested for that epic. Test-driven, one task at a time, committed individually.
When the epic's implementation is complete, it goes through:
Code Review (staff-engineer-level, five-axis review)
AppSec Review (pre-merge security pass)
Only after both reviews pass does the branch merge via pull request.

Key properties to preserve:

Multiple developers work multiple epics concurrently, in isolated workspaces (git worktrees), without stepping on each other.
Tasks inside an epic plan should be as small as reasonably possible — optimize for short agent context per task, not for fewer tasks.
Sign-off gates are blocking: an agent must not proceed past a gate (start building, or open a PR) until the required approvals are recorded.
AppSec involvement is conditional at the epic-review stage and the epic-plan-signoff stage, but mandatory at final pre-merge review.
What to actually build
1. Role → framework mapping (design this first, put it in docs/roles.md)

Map each of my roles to the closest existing primitive in superpowers and agent-skills, rather than inventing new agent personas where a good one already exists:

My role	Closest agent-skills primitive	Closest superpowers primitive
Engineering Manager	/spec, interview-me, idea-refine	brainstorming
Principal Engineer	planning-and-task-breakdown (epic-level use)	writing-plans (epic-level use)
AppSec	security-auditor persona, security-and-hardening skill	(none native — you'll need a custom skill/checklist, see below)
QA Lead	test-engineer persona, constraint-driven-development (CONSTRAINTS.md)	test-driven-development
Developer (epic plan)	planning-and-task-breakdown (task-level use)	writing-plans, using-git-worktrees
Developer (build)	incremental-implementation, test-driven-development	subagent-driven-development, test-driven-development
Code Review	code-reviewer persona, code-review-and-quality	requesting-code-review, receiving-code-review
AppSec pre-merge review	security-auditor persona	(custom)
Merge	git-workflow-and-versioning, shipping-and-launch	finishing-a-development-branch

Where neither framework has a native fit (AppSec as a first-class gate, not just a persona you can invoke), design a small custom skill — appsec-gate — following each framework's own skill-authoring conventions (agent-skills: docs/skill-anatomy.md; superpowers: skills/writing-skills) so it behaves like a native skill in both, not a bolted-on script.

2. Governance / gate mechanics

Design a lightweight, tool-agnostic state machine using files, since none of the underlying frameworks enforce cross-role sign-off natively:

Every Project Plan, Epic, Epic Plan, and Task is a markdown file with YAML frontmatter tracking status and approvals, e.g.:
yaml
  status: awaiting-appsec-signoff   # states: draft | awaiting-review | awaiting-principal-signoff | awaiting-appsec-signoff | approved | in-progress | in-review | in-appsec-review | merged
  approvals:
    principal_engineer: null        # null | {by, date, notes}
    appsec: null                    # null | not-required | {by, date, notes}
    qa_lead: null
A validation script (scripts/check-gate.sh or .mjs — your call) that agents are instructed to run before advancing a document's status. It fails loudly if a required approval is missing for the transition being attempted.
Wire this validation as a pre-condition step inside the relevant skill's workflow (e.g., before subagent-driven-development will start building an epic, it must confirm the epic plan's frontmatter shows principal_engineer approved and appsec is either not-required or approved) — not as a separate manual step the agent might skip.
Before opening a PR (finishing-a-development-branch / /ship), the gate script must confirm both code_review and appsec_review are approved.
3. Directory layout

Propose and build something like:

agent-workflow-blueprint/
├── AGENTS.md                    # entry point for Codex + Cline (and any AGENTS.md-reading tool)
├── CLAUDE.md                    # entry point for Claude Code, points back to AGENTS.md
├── docs/
│   ├── roles.md                 # the mapping table above
│   ├── workflow.md              # the staged process, written as a runbook
│   └── gates.md                 # state machine + approval rules
├── project/
│   └── project-plan.md.template
├── epics/
│   └── EPIC-XXX/
│       ├── epic.md.template          # epic definition + appsec concerns + QA requirements
│       ├── epic-plan.md.template     # developer's task breakdown + signoffs
│       └── tasks/
│           └── TASK-XXX.md.template
├── skills/                      # vendored or submoduled: superpowers + agent-skills
├── scripts/
│   ├── check-gate.sh
│   ├── new-epic.sh
│   └── init-project.sh          # scaffolds a new project off this template
└── .codex-plugin/ .claude-plugin/ .cursor-plugin/  as needed for distribution
4. Cross-tool compatibility (Claude, Cline, Codex)
Use AGENTS.md as the canonical instructions file (Codex and Cline both read this natively). CLAUDE.md should be a thin pointer to AGENTS.md plus anything Claude-Code-specific (plugin marketplace install commands).
Install superpowers the way its own README recommends per tool (Claude Code: plugin marketplace; Codex: .codex-plugin; note that Cline is not in superpowers' native install list — check docs/ in that repo for whether Cline needs the raw skills copied into a directory it reads, and design around that gap explicitly rather than assuming it works).
Install agent-skills via its multi-agent installer: npx skills add addyosmani/agent-skills (works across Cline, Claude Code, Codex, Cursor, and 70+ others per its README), or as a native Codex plugin via codex plugin add agent-skills@agent-skills if I'm only ever using Codex for those particular skills.
Where both frameworks define overlapping skills (both have their own test-driven-development skill, for instance), document in docs/roles.md which one wins for which role/stage so agents aren't told to follow two conflicting TDD workflows at once — don't just install both and hope.
5. Concurrency for developers

Use superpowers' using-git-worktrees skill as the mechanism for multiple developers/agents working separate epics at once without branch collisions. Document in docs/workflow.md how a new worktree gets created per epic (scripts/new-epic.sh should call this).

6. init-project.sh

A script that, when I clone this template for a new project, does the initial scaffolding: creates project/project-plan.md from the template, sets up the skills (submodule or npx install, whichever you choose — explain the tradeoff), and leaves me at the "EM writes the project plan" starting point.

Constraints
Prefer git submodules or a documented install script over vendoring/copying the two skill repos wholesale, so I can pull upstream updates later. If submodules cause friction with the npx skills add installer, explain the tradeoff and pick one, don't leave both half-wired.
Every template file (epic.md.template, epic-plan.md.template, etc.) needs the YAML frontmatter fields from the gate design above, filled with placeholders, plus a short comment block explaining each field.
Write docs/workflow.md as something a new developer joining the project could read once and understand the whole lifecycle — not just agent instructions.
Do not silently drop the AppSec-conditional logic (epic-level "flag concerns" vs plan-level "signoff if touched" vs merge-level "always required") — those are three different gate strengths and the state machine needs to actually distinguish them.
Deliverable

A working repository, ready to git init and push, that I can mark as a GitHub template repo and clone for each new project going forward.
```