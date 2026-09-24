# Installation and updates

Requires Git, Bash, Node.js 22+, npm, and network access during setup. Run `bash scripts/init-project.sh`. For an offline scaffold only, use `--offline`, then run normal initialization when online. Initialization never overwrites an existing project plan and never creates approvals.

We choose a documented installer, not submodules. It clones ignored upstream working copies under `skills/upstream/`, pins their commits in tracked `skills/*.ref`, and invokes `npx skills add` against the pinned agent-skills checkout for Claude Code, Codex, and Cline. This avoids nested submodule initialization and retains upstream personas/shared references omitted by per-skill copying. Resolve upstream shared-reference links against the retained checkout. The skills CLI itself is fetched through npx; its version is not pinned. Use an organization-approved CLI version if installer reproducibility is required.

`bash scripts/install-skills.sh --update` explicitly refreshes both upstream refs and reinstalls selected skills. Review and commit ref changes; ordinary installs reuse those refs. Local governance skills remain separate and are linked into each tool's skill directory. Run the installer separately in each worktree; ignored installs are not inherited.

## Claude Code

Install Superpowers using its [recommended marketplace route](https://github.com/obra/superpowers#installation):

```text
/plugin install superpowers@claude-plugins-official
```

`CLAUDE.md` points to canonical project rules. This template uses the multi-agent installer for agent-skills, so do not additionally install its plugin unless intentionally switching distribution. Lifecycle shorthand routes are defined in AGENTS.md; a per-skill install does not guarantee native `/spec` or `/ship` commands in every harness.

## Codex

The [current Superpowers README](https://github.com/obra/superpowers#installation) recommends the Codex marketplace: open `/plugins`, search Superpowers, and install; in the app use Plugins. The upstream plugin owns its `.codex-plugin` manifest; this template does not invent or copy one. Local governance skills are discovered through `.agents/skills` after installation, with AGENTS.md as the always-read entry point.

For a Codex-only alternative to the default agent-skills installer, upstream documents:

```sh
codex plugin marketplace add addyosmani/agent-skills
codex plugin add agent-skills@agent-skills
```

That alternative is not run by our installer. If used, keep the ownership rules in roles.md, including Superpowers as sole TDD owner.

## Cline

Superpowers' [docs listing](https://github.com/obra/superpowers/tree/main/docs) has no native Cline guide. Our adapter links its skill directories into `.cline/skills/`, a [documented Cline skill location](https://docs.cline.bot/customization/skills). It does not emulate plugin session hooks or a native subagent tool. AGENTS.md explicitly supplies startup routing and the Cline-only handoff protocol; `.clinerules/00-governance.md` is a fallback pointer. Check the Cline Skills menu and enable the local skills. If symlink discovery is unsupported by your version, read the canonical SKILL.md paths from AGENTS.md directly; do not pretend native plugin hooks exist.

Disable global same-name skills that override these project skills. Use separate sessions when subagent dispatch is unavailable. The upstream worktree skill is markdown: `new-epic.sh` displays it and executes its shell fallback, while the agent must load it before invoking the script. With native worktree tools, let the harness create the epic branch/worktree and copy the three templates there, then run setup and baseline tests.

## Autonomy boundary

The Cline handoff protocol is specific to Cline. Codex and Claude Code should continue normal in-scope work until they need missing requirements, credentials, external authorization, or a scope-changing decision. This does not waive approval gates: any tool must obtain genuine independent review evidence before a gated transition.

Sources were checked when authoring this blueprint. Installation and skill discovery should be smoke-tested in each target harness after upstream or tool upgrades.
