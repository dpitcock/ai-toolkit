# EPIC-006 personal-use QA result

**PASS for the approved local checkpoint.** Independently verified by QA Lead
`/root/verify_full_qa` on 2026-09-27. This records bounded personal-use QA,
not canonical full QA, final implementation review or release approval.

Source: `76a2785bdbe4b641a4e614dd29579a2799036389`.
Tested evidence HEAD: `eb27ea563f2c37b4afd2d8dfdc8e6cb7cfbf5f18`.
The latter differs only in three project evidence/checkpoint documents.
Worktree: `/Users/dpitcock/Code/agent-canvas/.worktrees/EPIC-006`.
Branch: `epic/EPIC-006`. Runtime: Node 24.11.0 and the existing native `fs-ext`
installation on this Mac. No clean installation, native rebuild or machine
change was performed for this checkpoint.

## Coverage and complete results

**259 passing tests:** 221 newly executed by independent QA and 38 accepted
from complete retained runs. Coverage is 17 complete required files plus seven
selected cases. Every counted run exited 0 with zero failures, cancellations,
skips or todos. Failed and interrupted runs were not counted as passes.

Fresh groups ran serially from the worktree with `set -o pipefail` and:

```sh
/Users/dpitcock/.nvm/versions/node/v24.11.0/bin/node --test --test-reporter=tap --test-concurrency=1 <arguments> 2>&1 | tee <log>
```

| Group | Passed | Exit | Duration (ms) | Full log |
| --- | ---: | ---: | ---: | --- |
| Logic | 52 | 0 | 403.0775 | `/tmp/epic006-personal-qa-logic-20260927.tap` |
| Assessment | 18 | 0 | 11890.462917 | `/tmp/epic006-personal-qa-assessment-20260927.tap` |
| Tier checks | 54 | 0 | 124994.432125 | `/tmp/epic006-personal-qa-tier-checks-20260927.tap` |
| Governance | 93 | 0 | 208747.165416 | `/tmp/epic006-personal-qa-governance-20260927.tap` |
| Workspace safety | 4 | 0 | 1400.467875 | `/tmp/epic006-personal-qa-workspace-safety-20260927.tap` |

Exact file arguments:

```text
Logic:
tests/task-tier.test.mjs tests/tier-defaults.test.mjs tests/review-evidence.test.mjs tests/review-scheduling.test.mjs tests/release-review-integrity.test.mjs tests/controlled-host-transport.test.mjs tests/epic-completion.test.mjs
Assessment:
tests/task-assessment.test.mjs tests/preflight.test.mjs
Tier checks:
tests/check-tier1.test.mjs tests/check-tier2.test.mjs
Governance:
tests/gates.test.mjs tests/bootstrap-policy.test.mjs tests/workflow-event.test.mjs
```

Exact workspace-safety arguments:

```sh
--test-name-pattern='^(policy candidates cannot self-declare delegated owner acceptance|policy changes stay read-only until matching human approval is applied|a failed history append restores the accepted config and history pair|two waiters recover after an advisory-lock holder dies without deleting its lock path)$' tests/init-workspace.test.mjs
```

## Accepted retained evidence

- 35 tests from `/tmp/epic006-independent-qa-group4-20260927.tap`:
  workflow-authorization 8, workflow-state 6, workspace-config 21. The original
  complete run was 55/55, exit 0, 80193.127834 ms, Node 24.11.0, at
  `6015a8fd8913bdd35e951e6e7e7d291ff7b48eac`. QA verified unchanged relevant
  tests, implementation dependency paths, policy defaults and package identities.
  Workflow-event 19 was rerun fresh; Slack 1 is outside this checkpoint.
- Two materialization cases from
  `/tmp/epic006-materialization-corrected-green-20260927.tap`: 2/2, exit 0,
  37079.049833 ms, source `7f8c87024ad548bc412a55b45710ccc0b13245c2`.
  QA verified unchanged selected cases, fixtures and exercised paths.
- Same-PR2 completion from `/tmp/epic006-j-completion-final-green-20260927.tap`:
  1/1, exit 0, 218284.41875 ms, exact source `76a2785`. This includes successful
  J completion and persisted state, wrong submitted-head/original-merge
  negatives, exact J status/workflow rejection and replay rejection.

Recorded commands for those runs:

```sh
node --test --test-reporter=tap --test-concurrency=2 tests/workflow-authorization.test.mjs tests/workflow-event.test.mjs tests/workflow-state.test.mjs tests/workspace-config-slack.test.mjs tests/workspace-config.test.mjs
node --test --test-reporter=tap --test-name-pattern='real CI release route is selected|integration materializes the API-bound J object' tests/epic-policy-adoption.test.mjs
/Users/dpitcock/.nvm/versions/node/v24.11.0/bin/node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern='same open PR2 correction invalidates both readiness boundaries and requires fresh independent review' tests/epic-policy-adoption.test.mjs > /tmp/epic006-j-completion-final-green-20260927.tap 2>&1
```

The materialization record preserves the exact selector and Node 24 runtime;
its original executable spelling (bare `node` or absolute path) was not retained
in the available handoff. This limitation does not supply a different runtime.

Production-dependency audit: `npm audit --omit=dev --ignore-scripts --cache .npm-cache`
exited 0 with zero vulnerabilities; full log `/tmp/epic006-audit-20260927.log`.
QA verified unchanged lock blob `24902f510e4e61fb9c1c4c9ffa47292da7eff5b0`.

## Local smoke and correction assessment

`/tmp/epic006-personal-qa-smoke-20260927.log` records exit 0: Node 24.11.0,
installed `fs-ext.flockSync`, registered epic worktree/branch and accepted
workspace revision 2. Effective policy digest:
`a9008f1f352e53a0d39bf66a8b1376d09914ff0523da25b6dbbc45f34643cf5a`.
`git diff --check` passed and the tested worktree was clean. No owned test
process remained running at independent QA completion.

QA inspected the applied fixes. All 16 prior routing failures now pass within
the complete 37-test check-tier2 file. Completion reads canonical `submittedHead`;
strict host input excludes the forbidden extra property while release-proof
validation remains in context. Rejection protections remain exercised.

## Log SHA-256 identities

Names below correspond to the full paths above, omitting their common
`/tmp/epic006-` prefix and `-20260927.tap` suffix (smoke and audit use `.log`).

```text
8fd58ca64aba458cd4a036834bfa5319a63e78c21978c7486228e5a3b8cba891  personal-qa-logic
0ea0ea3531e195393f1fdee95cb295b5789a8dfcb62dd2fedbe042c0f76043a1  personal-qa-assessment
92b4a7eb3e4142fd446e3fdf92a9fdaef78caad5b75686d33f659d09a3a0ac83  personal-qa-tier-checks
0c310529808bbfb1a23e136d947c1fa2498942715ea79380e81c428766e20a78  personal-qa-governance
937a6a412f30f4d5cd926090648c229eac3eb2d278f7d4ca5809d6a548e3ebae  personal-qa-workspace-safety
97f7ee51c4f5ddd51150c652441ceba788e5f7eecfa2cae3d5ac6cb3bd7f5ea1  personal-qa-smoke
b68a4f344e9fd42394ff47bd74852b9c1157e61db4dd36d318911332d26c7fd4  independent-qa-group4
431326f3cd80e3a98b8925a8c4e92a1f2e043f01c8fc250ea1b491a727a81e97  materialization-corrected-green
eff94c7072c2c173f907605926fd92a97a8aa42bdb2f69982afe782c5462ffee  j-completion-final-green
6d8c5c8f3d7684adb070417bd608d01ae90aa3dc26a65af03ffda4955f38d9a3  audit
```

## Deferred and unresolved

Default live `observeEpicIntegration` still applies status-only finalization to
the original-merge-to-current-main transition. The passing J fixture injects a
typed observer; live J adapter readiness remains unresolved and deferred.

Canonical full QA, independent final Staff then AppSec review, PR gates, hosted
activation, root-policy migration, release continuation, cleanup/completion
receipts and QA-GOV-010 remain pending. Existing canonical findings remain open.
This result does not establish actual activation, merge, EPIC-006 completion
or permission to admit EPIC-007. No canonical status transition or external
action was performed. The personal-use checkpoint is satisfied within these
explicit boundaries.
