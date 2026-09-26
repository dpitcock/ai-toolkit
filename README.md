# agent-workflow-blueprint

A reusable project template combining Superpowers and agent-skills with an EM → Principal → QA/AppSec → developer → staff/AppSec review workflow.

```sh
bash scripts/init-project.sh
npm test
```

Requires Git, Bash and Node.js 22+. Setup downloads upstream skills; complete the tool-specific Superpowers installation in [installation](docs/installation.md). Start by filling `project/project-plan.md` as the Engineering Manager. For scaffolding without downloads, use `bash scripts/init-project.sh --offline`.

If the GitHub identity app is unavailable or misbehaving, see [gh-identity](https://github.com/dpitcock/gh-identity).

- [Workflow](docs/workflow.md): the complete onboarding runbook and concurrent epic worktrees.
- [Roles](docs/roles.md): upstream mapping and overlap precedence.
- [Gates](docs/gates.md): states, approvals, revision handling and enforcement limits.
- [Installation](docs/installation.md): Claude Code, Codex and explicit Cline adapter.

Agents enter through AGENTS.md; Claude uses CLAUDE.md. Local skills wrap upstream planning, building and shipping. YAML gates block missing approvals, and AppSec triage, conditional design signoff and mandatory final review are separate decisions. UI changes additionally receive independent WCAG 2.2 AA accessibility triage, plan signoff, and final review.

Cline uses an explicit handoff when it needs clarification or authorization; Codex and Claude Code continue normal in-scope work autonomously until one of those boundaries is reached. All tools retain the same independent approval gates.

The `project/` and `epics/` directories contain templates; `skills/` contains small governance skills and pinned upstream references. No upstream code is vendored. `scripts/new-epic.sh EPIC-001` creates an isolated epic branch/worktree after project approval.

Push this repository to GitHub, enable **Template repository** in repository settings, and configure branch protection as described in gates.md. File approvals are cooperative governance; enforce reviewer identity and merge restrictions on the hosting platform.

The original request is preserved in [docs/original-request.md](docs/original-request.md).
