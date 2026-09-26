---
kind: task
id: TASK-006
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 10
depends_on: [ tasks/TASK-003.md, tasks/TASK-004.md, tasks/TASK-005.md ]
evidence:
  red: "Generated-adopter fixture initially failed while establishing accepted
    linked policy and while preflight read raw YAML instead of scaffolded
    Markdown frontmatter; review remediation also exposed the missing real
    new-epic/gate route."
  green: "node --test tests/scaffold.test.mjs passed: 8 tests, 0 failures,
    including named valid and unbound-route cases."
  qa: "Affected Tier 3/gate/preflight suites passed: 61 tests, 0 failures;
    previous serial full-file run covered all repository suites. Independent
    TASK-006 re-review approved c96fbb0 after verifying new-epic.sh, actual
    check-gate lifecycle transitions, valid/adversarial generated-adopter
    routes, and narrow frontmatter parsing. git diff --check passed."
  commit: "c96fbb0"
approvals:
  {
    principal_engineer: null,
    appsec: null,
    qa_lead: null,
    code_review: null,
    appsec_review: null,
    accessibility: null,
    accessibility_review: null
  }
---

# TASK-006: Verify Tier 3 in a Generated Adopter

## Acceptance criteria

- A disposable adopter accepts policy, creates a real isolated epic worktree, records a Tier 3 assessment, completes the exact governed route, and passes the PR entry validator.
- The fixture rejects shared worktree, stale policy, missing role, wrong plan, and a UI accessibility-floor bypass.

## Files and dependencies

Modify `tests/scaffold.test.mjs` and, only if necessary, `tests/check-tier2.test.mjs`. Depends on TASK-003, TASK-004, and TASK-005.

## TDD steps

Add failing cases named `generated adopter completes the Tier 3 route` and `generated adopter rejects unbound Tier 3 routes`. Run `node --test tests/scaffold.test.mjs`; add minimal fixture support; rerun green, `npm test`, and `git diff --check`.

## QA mapping

QA-005-SCAFFOLD, QA-005-WORKTREE-AND-PR, and QA-005-CI. Assert cooperative controls and host branch protection remain distinct.
