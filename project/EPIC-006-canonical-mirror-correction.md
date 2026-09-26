# EPIC-006 canonical policy mirror correction evidence

Developer: Codex `/root/correct_canonical_policy_mirror`, 2026-09-26.
Implementation: `610b02569fadabf103cfe7907125cbbd1e203358` on `epic/EPIC-006`.
Canonical plan revision: 1. This addresses only the exact canonical-mirror
portion of CR-006-004, under the Principal design at `05a8dd8` and independent
AppSec design approval recorded in `project/EPIC-006-release-design-appsec.md`.
It is development evidence, not a final review or finding resolution.

## Implemented boundary

A registered linked checkout without `worktree_overrides` inherits root policy
only when its complete config and history buffers equal those of the actual
Git-common coordination checkout. Both snapshots validate acceptance and current
tier-definition provenance. The result uses root policy and root field sources.
Matching normalized digests, a matching sibling, or a matching PR base cannot
replace a different or unavailable local coordination-root snapshot.

The existing marked-overlay function and semantics are unchanged. Local Tier 1
and Tier 2 final checks use the same mirror resolver as preflight. In a fresh
single checkout, the PR check instead reads both regular, non-executable policy
blobs from the committed PR base and applies the same exact-buffer and accepted
history proof. It cannot fall back to that base when a distinct canonical local
root exists but fails validation. Tier 1's local check still requires its actual
registered coordination checkout.

New interfaces exported by `scripts/lib/workspace-config.mjs`:

- `canonicalCoordinationRoot(worktreeRoot)` derives registration and root identity
  from the Git-common directory, without selecting by policy content.
- `readWorkspacePolicySnapshot(root)` returns raw `configText` and `historyText`
  buffers from regular root-local files, rejecting symlinked files and parents.
- `resolveCanonicalPolicyMirror(rootSnapshot, linkedSnapshot)` performs pure
  exact-byte comparison and validates both acceptances, returning `{config,sources}`.

The pure `workspace-history-validation.mjs` factory holds the prior history
record/parser/definition/acceptance checks and takes config digest/definition
functions as dependencies. `workspace-history.mjs` delegates to it without
changing legacy digest semantics, filesystem transactions or locks. This avoids
a config/history circular import and keeps native locks out of pure resolution.

## Verification

RED: Before production changes, the canonical tests failed on the existing
mandatory-marker behavior, including the positive resolver, preflight and final
CLI cases. Log: `/tmp/epic006-mirror-red.log`.

GREEN: `node --test --test-name-pattern='canonical' tests/workspace-config.test.mjs
tests/preflight.test.mjs tests/check-tier1.test.mjs tests/check-tier2.test.mjs`
passed 11/11, zero failures or skips. Log: `/tmp/epic006-mirror-green.log`.

Regression: `node --test tests/workspace-config.test.mjs tests/preflight.test.mjs
tests/check-tier1.test.mjs tests/check-tier2.test.mjs tests/init-workspace.test.mjs
tests/bootstrap-policy.test.mjs` passed 174/174, zero failures or skips.
Log: `/tmp/epic006-mirror-regression.log`. This includes original bootstrap
single-checkout PR validation, initializer migration/locking, legacy hashes,
both marked autopilot directions, and tier-weakening rejection. `git diff --check`
also passed before the implementation commit.

After committing the implementation, reran the two actual bootstrap and real
`check-pr` entrypoint tests against fresh clones of `610b025`: 2/2 passed, zero
failures or skips. Command: `node --test --test-name-pattern='actual bootstrap
assessment|real check-pr entrypoint' tests/bootstrap-policy.test.mjs`.
Log: `/tmp/epic006-mirror-pr.log`.

Mirror negatives cover same-normalized/different config formatting, complete
ledger byte drift, different acceptor, invalid UTF-8 bytes decoding to equal
strings, missing history at either end, pending acceptance, stale digest and
definition, symlinked files and parent directories, unregistered checkout,
noncanonical matching sibling, and local root drift despite a matching PR base.
CLI tests include a clean preflight, local Tier 1, local Tier 2, and a real
single-checkout PR run, with committed-base byte mismatch rejection.

## Retained boundaries

No historical config, acceptance ledger, assessment, canonical plan/task/status,
approval or review finding was changed. No coordination-root policy write, host
write, runtime authorization, adoption gate, rollout, completion or activation
was performed. The remaining CR-006-004 release continuation is outside this
implementation. Final independent Staff and AppSec review on the eventual full
implementation revision remains required.
