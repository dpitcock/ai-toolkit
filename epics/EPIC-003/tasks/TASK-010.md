---
kind: task
id: TASK-010
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 13
depends_on: [ tasks/TASK-009.md ]
evidence:
  red: "2026-09-25: node --test tests/init-workspace.test.mjs failed the two new
    adversarial cases under pathname locks: concurrent waiters behind a killed
    lock holder could not recover, and linked status returned while the
    coordination-root transaction was paused at history-appended."
  green: "2026-09-25: node --test tests/init-workspace.test.mjs passed 30/30 after
    descriptor-held fs-ext advisory locks and canonical root/overlay status
    locking were implemented. The adversarial holder and paused-root regressions
    both recovered revision 1 without reporting the candidate."
  qa: "2026-09-25: npm test passed 55/55; npm audit --audit-level=high --omit=dev
    reported 0 vulnerabilities; git diff --check and staged diff checks were
    clean. Persistent verified lock files are never stale-reclaimed by pathname;
    locks release with their descriptors, and linked status locks both roots
    before transaction recovery and policy reads."
  commit: "2edca78"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-010: Use advisory locks for policy transactions

## Acceptance criteria

- Add `fs-ext` 2.1.1 and replace pathname-based history lock ownership and
  stale-reclamation with an exclusive advisory lock held on a verified,
  root-local regular lock file descriptor. The operating system releases the
  advisory lock if its process dies; no process deletes another process's fixed
  lock path during recovery.
- Keep history writes, journal recovery, proposal bootstrap, acceptance/legacy
  retirement, and apply-change under that advisory lock. Preserve all existing
  history/config/journal validation, regular-file, symlink, and digest checks.
- For linked worktree `status`, acquire advisory locks for the coordination
  root and overlay root in canonical realpath order, recover both transactions
  while locked, then resolve and validate the effective policy from that stable
  snapshot. Release both descriptors in reverse acquisition order.
- A deterministic two-reclaimer regression proves a live holder's advisory
  lock remains held and its cleanup succeeds after another contender recovers
  an abandoned writer. A real linked-worktree child paused at
  `history-appended` must never be reported as accepted by overlay `status`;
  after recovery it reports the prior accepted revision.
- Rely on TASK-009's pinned native dependency and sandbox-local install policy;
  do not add a second dependency-install mechanism in this task.

## Files and dependencies

Modify `scripts/lib/workspace-history.mjs`, `scripts/init-workspace.mjs`, and
`tests/init-workspace.test.mjs`. Depends on TASK-009; resolves CR-011 and
CR-012.

## TDD steps

1. Add the two-reclaimer regression using a controllable child-process holder:
   seed an abandoned transaction lock, pause contender A immediately before it
   would recover, let contender B recover, acquire a live holder, then resume
   A. Assert the live holder remains exclusive and exits cleanly. Add a real
   linked Git-worktree fixture that pauses a coordination-root apply at
   `history-appended`; overlay `status` must wait/recover and return revision 1,
   not the uncommitted candidate.
2. RED: run `node --test tests/init-workspace.test.mjs`; expect the live-holder
   or linked-status assertions to fail under the current pathname lock.
3. Open verified root-local lock files with no-follow regular-file checks;
   acquire `flock` exclusive locks through `fs-ext`, and release file
   descriptors in `finally`. Replace owner-link creation, PID probing, and
   pathname stale deletion. Add a sorted multi-root lock helper for linked
   status, with recovery before history/config reads.
4. GREEN: run `node --test tests/init-workspace.test.mjs`, `npm test`,
   `npm audit --audit-level=high --omit=dev`, and `git diff --check`.
5. Commit as `fix: use advisory locks for workspace policies`.

## QA and security mapping

QA-302 and QA-304; SEC-301 and SEC-302. Use real child processes, real Git
worktrees, and actual advisory locks. Do not mock lock acquisition or replace
the production filesystem API in the regression; the scheduled race must prove
the live holder remains protected.

## Handoff

Record actual RED/GREEN/QA evidence and the implementation SHA. A new final
staff review must verify CR-011 and CR-012 with CR-001 through CR-010; final
AppSec must review the same commit before any PR work.
