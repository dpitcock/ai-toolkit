# Roles and framework ownership

The governance layer chooses the stage and validates its entry conditions. Upstream skills supply the engineering method; approval authority belongs to the assigned reviewer, not the implementing agent.

| Role/stage | agent-skills primitive | Superpowers primitive | Owner when overlapping |
|---|---|---|---|
| EM/project goal | /spec, interview-me, idea-refine | brainstorming | agent-skills for interview; Superpowers for design refinement |
| Principal/epic decomposition | planning-and-task-breakdown | writing-plans | agent-skills for epic scope; Superpowers for plan mechanics |
| AppSec/epic concerns | security-auditor, security-and-hardening | No native gate | local appsec-gate controls triage |
| QA Lead | test-engineer, constraint-driven-development, /constraints | test-driven-development | agent-skills defines QA bar; Superpowers owns implementation TDD |
| Accessibility reviewer (UI changes) | accessibility-review custom skill | No native gate | custom skill defines WCAG 2.2 AA triage, plan, and final-review gates |
| Developer/epic plan | planning-and-task-breakdown, /plan | writing-plans, using-git-worktrees | Superpowers task sizing and isolation |
| Developer/build | incremental-implementation, /build, /test | subagent-driven-development, test-driven-development | Superpowers owns execution and RED/GREEN/REFACTOR |
| Staff code reviewer | code-reviewer, code-review-and-quality, /review | requesting-code-review, receiving-code-review | agent-skills owns five-axis rubric; Superpowers dispatches and handles feedback |
| AppSec/pre-merge | security-auditor | No native gate | local appsec-gate plus upstream security checklist |
| Merge | git-workflow-and-versioning, shipping-and-launch, /ship | finishing-a-development-branch | Superpowers finish mechanics, restricted to PR after local gates |

Do not run both TDD skills. agent-skills' test-driven-development is deliberately excluded from the installer. Incremental implementation must defer to Superpowers' task execution. Local governed-plan/build/ship wrappers are mandatory outer workflows, including when a lifecycle slash command is invoked directly. Upstream fast paths, direct local merge, and work-in-place fallback cannot bypass project gates or epic isolation.

Personas live in `skills/upstream/agent-skills/agents/`; they are role prompts, not executable programs. Read the existing persona in the assigned review session, using its referenced skill and checklists. Do not invent replacements. Where a harness lacks subagents, use separate sessions with explicit handoffs and fresh context per task.

Sources: [agent-skills](https://github.com/addyosmani/agent-skills), [Superpowers](https://github.com/obra/superpowers). Installation details are in [installation.md](installation.md).
