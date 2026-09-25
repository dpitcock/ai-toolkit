---
kind: task
id: TASK-008
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 9
depends_on: [ tasks/TASK-007.md ]
evidence:
  red: "2026-09-25: node --test tests/init-workspace.test.mjs first failed the new
    append-failure test (missing expected exception), journal-schema test
    (missing expected exception), post-recovery accept test (returned revision 2
    instead of restored revision 1), cleanup-kill test (timed out waiting for
    fixed-link removal), and intermittent concurrent bootstrap/accept tests (7/8
    successful children with a malformed-lock rejection)."
  green: "2026-09-25: node --test tests/init-workspace.test.mjs passed 28/28 after
    owner-linked lock acquisition/reclaim/cleanup, pre-snapshot recovery, atomic
    validated journal phases, compensation, and explicit phase pause checkpoints
    were implemented."
  qa: "2026-09-25: npm test passed 52/52 and git diff --check was clean. Real
    child-process proposal/accept/apply contention, stale-base refusal, append
    compensation, all durable phase kills, prepared recovery, and fixed-link
    cleanup interruption were exercised. Independent reviewer
    staff-agent-task008-final-rereview verified CR-005 through CR-010 on
    e4c8804062c36ce22f1f6981986e7c97276d2d67, including 15 repeated
    concurrent-bootstrap and 15 repeated concurrent-accept runs."
  commit: "e4c8804062c36ce22f1f6981986e7c97276d2d67"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-008: Make policy changes atomic under concurrency

## Acceptance criteria

- `propose-change` reports both the candidate digest and the accepted base
  digest it reviewed; `apply-change` requires both values.
- Every history-writing operation uses one root-local history lock: proposal
  bootstrap atomically creates/configures its first proposal, `accept` reads
  and validates its pending proposal and appends acceptance, and `apply-change`
  reads the accepted config, verifies the reviewed base and candidate, and
  applies its recoverable config/history transaction. The lock-aware history
  callback validates the combined existing history plus new record; nested
  locking is prohibited.
- Simultaneous valid requests based on one accepted revision yield exactly one
  accepted change. Every stale or contending request fails without corrupting
  history or replacing the accepted config; `status` remains accepted.
- A root-local, regular non-symlink transaction journal stores exact old config
  bytes, old history bytes/length, intended new config bytes/digest, proposed
  change record, and phase. It lets the next CLI action or `status` recover a
  matching old or committed-new config/history pair after interruption; an
  ordinary second-step failure compensates before the lock is released.
- The history lock cannot strand recovery after abrupt process death. It has a
  verified owner identity that may be reclaimed only after proving its process
  no longer exists; live or ambiguous owners fail busy rather than being
  removed.
- `accept` performs legacy-source revalidation, acceptance append, and any
  post-acceptance legacy retirement under the common lock. A retirement failure
  leaves the accepted config/history pair valid and retryable; it cannot create
  another acceptance record or interleave with a policy change.

## Files and dependencies

Modify `scripts/lib/workspace-history.mjs`, `scripts/init-workspace.mjs`, and
`tests/init-workspace.test.mjs`. Depends on TASK-007 and resolves CR-005.

## TDD steps

1. Add a real temporary-repository integration test that makes multiple child
   Node processes submit different `apply-change` candidates derived from the
   same `propose-change` base. Assert one success, ordered history ending at
   revision 2, a matching active config, and successful `status`. Add a stale
   base case after the winner commits; it must reject without changing either
   artifact. Update existing policy-change tests to supply the base digest
   returned by `propose-change`, and reject absent or non-64-hex base digests.
   Add an injected history-append failure after the chosen config-first rename,
   asserting rollback, removed journal, and accepted `status` at revision 1.
   Add interruption fixtures after prepared-journal persistence, config rename,
   history append, and committed-marker persistence before cleanup; each must
   prove deterministic recovery to a validated matching pair. Kill a child
   process after prepared-journal persistence and verify the next `status`
   safely reclaims its dead-owner lock, recovers the journal, and reports the
   prior accepted revision. Kill a cleanup/reclaim child after fixed-link
   removal and before owner-link removal; the next operation must not strand a
   fixed lock and must report an accepted status.
   Add child-process concurrent-accept and accept-vs-apply tests. The first
   starts multiple accepts from one proposal; it must leave one proposal and
   one acceptance record. The second runs a pending acceptance alongside a
   reviewed policy change and asserts any accepted operations form only the
   valid proposal→acceptance→optional-next-change sequence and `status` stays
   accepted.
2. RED: run `node --test tests/init-workspace.test.mjs`; expect concurrent
   callers to report multiple accepted changes or corrupt history, while the
   new base-digest and fault-injection cases fail because the current CLI lacks
   a recoverable transaction and locks only history append.
3. Add a root-local history-lock callback whose lock path derives from the
   verified real repository root and retains existing regular-file/symlink
   protections. Acquire it with an atomically linked fixed lock and an
   owner-named, fsynced regular companion file containing the creator PID and
   cryptographic nonce, so the fixed lock can be mapped back to its owner
   without trusting incomplete lock-file contents. At acquisition, contention,
   stale reclaim, and normal cleanup, `lstat` both paths as regular,
   non-symlink files and require matching `(dev, ino)` and the expected link
   count; revalidate them immediately before every unlink. Fsync the lock
   directory after atomically linking the fixed lock. On contention, reclaim
   only when fixed/owner identity is revalidated and `kill(pid, 0)` returns
   `ESRCH`; a live, `EPERM`, malformed, missing-companion, changed-inode,
   unexpected-link-count, or PID-reuse-ambiguous owner fails busy/fail-closed.
   Never unlink a replaced fixed or owner path. For normal cleanup and stale
   reclamation, revalidate both links, unlink the fixed link first, fsync its
   directory, revalidate the sole owner link, unlink it second, then fsync the
   directory again; no owner is removed before its fixed link. Its append
   capability must validate the combined locked history and proposed record
   before writing; do not call the existing independently locking append API
   inside it. Route proposal bootstrap and accept through that same callback:
   the former checks config/history state and writes at most one revision-1
   proposal, while the latter re-reads the pending/current tail under lock and
   appends at most one matching acceptance before legacy retirement. Under the
   lock for apply-change, re-read
   the accepted config, validate a 64-hex `--base-digest`, candidate digest, and
   current active target immediately before replacement. Persist a journal at
   `project/workspace-config-transaction.json` only after verifying it is
   inside the real root and neither it nor its parent is a symlink. Journal
   fields include exact old config bytes, exact old history bytes and length,
   exact intended new config bytes/digest, the complete new record, and phase
   `prepared`, `config-replaced`, `history-appended`, or `committed`. Persist
   every phase by fsyncing a temporary journal, atomically renaming it over the
   journal, then fsyncing the journal parent. Fsync the prepared phase before a
   fsynced temporary config file is atomically renamed, fsync the config parent
   after that rename, then durably persist `config-replaced`; append/fsync
   history and durably persist `history-appended`; verify the new digest/history
   chain; durably persist `committed`; then remove and fsync the journal parent.
   On ordinary append failure, restore and fsync the old config/history bytes,
   validate the old accepted pair, then remove the journal. Recovery runs under
   the same lock before every policy operation and `status`: pre-committed
   journals only clean up an unchanged old pair or restore a known old/new
   mixture to the old pair; committed journals clean up only a verified new
   pair. Unknown/tampered bytes or phases fail closed without replacement.
4. GREEN: run `node --test tests/init-workspace.test.mjs`, `npm test`, and
   `git diff --check`.
5. Commit as `fix: serialize workspace policy changes`.

## QA and security mapping

QA-302 and QA-304; SEC-301. Use real filesystem locks and child processes for
contention, and targeted filesystem-operation injection only for the
second-step failure. Capture the pre-fix concurrent corruption as RED and
prove the final history/config/status remain coherent under simultaneous,
stale-base, failed-second-step, and interrupted-transaction conditions.

## Handoff

Record RED, GREEN, full QA, and the implementation SHA. The final reviewer
must verify CR-005 through CR-010 on the post-fix review commit before final
AppSec review.
