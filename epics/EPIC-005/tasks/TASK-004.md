---
kind: task
id: TASK-004
owner: "Codex"
status: draft
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [tasks/TASK-003.md]
evidence: {red: null, green: null, qa: null, commit: null}
approvals: {principal_engineer: null, appsec: null, qa_lead: null, code_review: null, appsec_review: null, accessibility: null, accessibility_review: null}
---

# TASK-004: Wire and Document the Unified Tier 3 PR Gate

## Acceptance criteria

- The PR workflow supplies authoritative base/head/ref context to the single unified validator and continues to run tests for template-only changes.
- The workflow contract contains no duplicated policy logic and no merge/push/branch-deletion operation.

## Files and dependencies

Modify `.github/workflows/workflow.yml` and `tests/scaffold.test.mjs` only. Depends on TASK-003.

## TDD steps

Add a failing workflow/document contract assertion before changing prose/YAML. Run `node --test tests/scaffold.test.mjs`; make the minimal CI/docs edits; rerun green, `npm test`, and `git diff --check`.

## QA mapping

QA-005-CI. Verify no local command claims host enforcement or performs irreversible GitHub actions.
