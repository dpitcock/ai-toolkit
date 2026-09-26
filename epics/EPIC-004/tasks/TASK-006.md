---
kind: task
id: TASK-006
owner: "Codex"
status: draft
revision: 2
parent: ../epic-plan.md
parent_revision: 2
depends_on:
  - tasks/TASK-004.md
  - tasks/TASK-005.md
evidence:
  red: null
  green: null
  qa: null
  commit: null
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-006

## Acceptance criteria
- Update AGENTS.md, docs/workflow.md, docs/verification.md, and skills/governed-build/SKILL.md with the exact preflight, Tier 1, Tier 2 PR, and Tier 3 routes.
- Require accepted configuration and classification before work; explain that uncertainty/high risk escalates, final diff checks may only raise the tier, Tier 1 excludes UI, and Tier 2 UI requires independent accessibility evidence.
- State that Tier 1 direct merge is off by default, requires accepted policy and compatible host rules, and is never allowed for this template repository. Do not claim local scripts authenticate approvals or enforce host policy.
- Extend tests/scaffold.test.mjs to generate a temporary adopter with accepted EPIC-003-compatible workspace config and execute its initializer, preflight, Tier 1 check, Tier 2 check, and existing check-pr workflow using valid evidence fixtures. Also verify the proposed default-off policy field and preserve existing initializer/PR gate behavior.

## Files and dependencies
- Modify AGENTS.md, docs/workflow.md, docs/verification.md, skills/governed-build/SKILL.md, and tests/scaffold.test.mjs.
- Depends on TASK-004 and TASK-005.

## TDD steps
1. Add generated-project integration coverage that uses accepted configuration and valid fixtures to execute initializer, preflight, Tier 1 and Tier 2 commands, and existing check-pr; assert default-off policy and route guidance. Run node --test tests/scaffold.test.mjs.

~~~~sh
node scripts/preflight.mjs --id quick-fix --coordination-root . --worktree-root . < answers.json
node scripts/check-tier1.mjs --assessment project/task-assessments/quick-fix.yaml
~~~~

2. Expected RED: one or more expected tier instructions or generated files are absent.
3. Update the four workflow documents with the ordered commands, initial evidence-commit requirement, cooperative-control limitation, staged accessibility evidence requirements, and escalation behavior from the approved spec. Preserve existing PR-only and final review gates.
4. Run node --test tests/scaffold.test.mjs. Expected GREEN: generated-project setup remains idempotent and exposes the complete proportional routes.
5. Commit only the four docs and tests/scaffold.test.mjs as docs: document proportional task-tier workflow.

## QA mapping
- QA-004-SCAFFOLD: generated-project commands execute end-to-end with accepted config and instructions agree with executable routes.
- QA-004-CLASSIFICATION, QA-004-TIER1, QA-004-TIER2: commands, evidence, and safe escalation are discoverable before work.

## Handoff
Do not modify EPIC-005 Tier 3 behavior or relax this template's PR-only workflow. Record RED/GREEN/scaffold evidence and the implementation commit before the task's status transitions.
