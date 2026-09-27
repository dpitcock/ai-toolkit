# EPIC-006 controlled test transport correction

Developer: Codex `/root/correct_cli_test_transport`, 2026-09-26.
Worktree: `.worktrees/EPIC-006`, branch `epic/EPIC-006`.
Starting evidence revision: `502f19c`; production source remains unchanged.
This is bounded review repair under the existing approved bootstrap scope.

## Diagnosis and scope

The preceding independent run failed five real CLI positives. Its diagnostic
rerun measured `execFileSync('gh')` reaching the existing 30-second timeout
before the generated executable's fixture code ran. Separate startup probes
reproduced the delay for both a Node executable shim and a direct shell shim;
explicit `/bin/sh shim-file` did not exhibit that startup delay. These are
observed process-startup failures; no particular OS daemon is established as
the cause. Original logs remain `/tmp/epic006-release-proof-independent.log`,
`/tmp/epic006-observation-diagnostic-rerun.log`, and
`/tmp/epic006-gh-observation-diagnostics.jsonl`.

The correction changes tests only. Actual `check-pr`, `check-gate`,
`check-host-reviews`, generated-adopter scripts, and workflow shell commands
still execute. An explicit per-child Node `--import` installs a controlled
`execFileSync('gh', ...)` transport and synchronizes built-in ESM exports.
There is no production environment switch, global `NODE_OPTIONS`, live API
request, timeout change, or new executable shim.

The observation profile validates the existing exact API argv, pagination,
30-second timeout, 8 MiB buffer, encoding and stdio contract. The publisher
profile separately validates its existing encoding/stdio contract and exact
status POST fields. Unknown endpoints, malformed commands, response errors,
and unexpected status destinations fail closed. Other commands execute through
the original child-process function. The one scoped historical Git fetch
retains real Git while redirecting its exact canonical request to a local
fixture; unexpected fetch requests fail before invoking Git.

The dynamic lifecycle responder preserves persisted main-read counts, races,
PR state, reviews, checks, workflow provenance and real Git tree/content reads.
The publisher responder preserves authentication/keychain cases, call/write
records, head/main/merge races, and diagnostic merged verification. Negative
CLI cases now require the intended rejection reason so transport failure
cannot count as successful rejection.

## Observed RED and GREEN evidence

- Initial transport contract RED: 0/2 passed, with explicit missing transport
  and preload assertions (`/tmp/epic006-transport-red.log`). Initial GREEN:
  2/2 passed (`/tmp/epic006-transport-contract-green.log`).
- Publisher-contract RED: 2/3 passed; the exact valid status POST was rejected
  before publisher-profile support (`/tmp/epic006-transport-publisher-red.log`).
- Scoped-fetch RED: 3/4 passed; an unexpected local fixture fetch reached Git
  instead of the required controlled rejection
  (`/tmp/epic006-transport-fetch-red.log`).
- Unknown publisher destination RED: 4/5 passed; an unexpected repository/head
  did not throw (`/tmp/epic006-transport-unknown-write-red.log`).
- Frozen contract/publisher run: 43/44 passed in 50,595.263584 ms. The sole
  failure was a new assertion expecting `expected head` where the actual
  production error correctly says `observed head`. The exact assertion was
  corrected, and that real CLI case passed 1/1 in 106.207583 ms. All five
  transport contracts passed. Both logs are retained:
  `/tmp/epic006-transport-frozen-publisher.log` and
  `/tmp/epic006-transport-publisher-correction.log`.
- Final transport/publisher verification:
  `node --test --test-concurrency=1 tests/controlled-host-transport.test.mjs
  tests/host-review-events.test.mjs` passed 44/44, zero failed, cancelled, or
  skipped (70959.061083 ms). Log:
  `/tmp/epic006-transport-final-publisher.log`.

The complete affected batch did not finish locally. Its command was:

```sh
node --test --test-concurrency=1 tests/controlled-host-transport.test.mjs tests/lifecycle-finalization.test.mjs tests/epic-policy-adoption.test.mjs tests/host-review-events.test.mjs tests/review-evidence.test.mjs tests/scaffold.test.mjs
```

Log: `/tmp/epic006-transport-affected.log`. This batch began before the final
publisher-only assertion audit. The current release CI route and the
fresh-checkout adoption CI route completed successfully under the new transport
(108848.1275 ms and 63484.208875 ms respectively). The process then became
idle in Node's event loop. A replacement bounded lifecycle case entered a
synchronous subprocess and likewise stalled with no live descendant. Both
disposable runners were stopped after stack sampling; neither is evidence of
success or a product failure. Samples are
`/tmp/epic006-transport-cli-sample.txt` and
`/tmp/epic006-transport-lifecycle-child-sample.txt`.

The final publisher-only assertion audit changed only the transport contract,
publisher responder, and host-review tests. Its corrected missing-integration
case passed 1/1 in 125.530166 ms. Lifecycle, adoption, scaffold and review
evidence inputs did not change after the incomplete batch began. The changed
publisher/contract files were separately verified as recorded above; failures
and incomplete runs are not erased. Full final QA and hosted Node 22 CI remain
required before review or a PR.

This evidence does not claim full epic QA, independent final Staff/AppSec
approval, live adapter activation, release completion, or merge authority.
No task, plan, policy, assessment, review approval or status was changed.
