# EPIC-006 final policy-check corrections

Developer: Codex task session `/root/correct_policy_final_checks`, 2026-09-26.
Scope: Staff findings CR-006-002 and CR-006-003 under the owner-authorized
bootstrap correction and existing approved plan revision 1. The controller
returned the plan to in-progress through the gate in `e3caa8f`. Completed task
history, immutable assessment, accepted config/history and approvals remain
unchanged. This is developer evidence, not independent finding resolution or
permission to publish a PR. Both final reviews must cover the corrected head.

## CR-006-002: final Tier 1 merge selection

Implementation: `e0c22f8`.

Verified the finding: the final checker read only the legacy field. New policy
now obtains direct-merge rules from `resolveTierDefaults`; legacy omitted,
false and true values preserve their historical behavior and hashes.

RED: `node --test --test-name-pattern='final CLI'
tests/check-tier1.test.mjs` produced one pass and one failure. The new-policy
true case incorrectly printed `Direct merge eligible: no`; higher-tier
escalation passed. An initial test draft incorrectly expected exit zero for
escalation; this was corrected to the existing exit-one contract before RED.

GREEN: `node --test tests/check-tier1.test.mjs tests/tier-defaults.test.mjs`
passed 20/20, zero failures or skips. The actual final CLI covers omitted,
false and true selections in both formats, and configured Tier 2/3 with true.
The shared resolver tests cover the explicit template floor. `git diff --check`
passed before commit.

The generic checker's eligibility result still does not grant merge authority.
AGENTS.md explicitly places this template's mandatory PR path in local workflow
and host protections; no inferred repository identity was added. Its unchanged
accepted policy keeps direct merge false. Host checks/protections and actual
integration/activation remain separate release obligations.

## CR-006-003: shared effective overlay semantics

Implementation: `ba5d162`.

Extracted the canonical preflight overlay semantics as the pure
`applyWorktreeOverlay(rootConfig, worktreeConfig)` export in
`scripts/lib/workspace-config.mjs`. It returns `{config, sources}`. The
filesystem resolver retains root/worktree validation before delegation;
both final checkers consume the helper's effective `config`. Explicit
autopilot markers, equality of legacy/new tier fields, normalized validation,
field provenance and mandatory linked-worktree markers are preserved.
Tier 2 still reconstructs accepted root policy from the committed PR base
when no registered coordination candidate is available.

RED: `node --test --test-name-pattern='autopilot'
tests/check-tier1.test.mjs` failed 2/2. The valid marked override was rejected
as unavailable coordination config; a consistently hashed but unmarked
override was incorrectly admitted. The same focused command for
`tests/check-tier2.test.mjs` failed 3/3: linked positive rejected, isolated CI
positive rejected with unknown `workflow.autopilot`, and invalid unmarked
policy incorrectly admitted by the actual PR CLI.

GREEN: both files' focused autopilot regressions passed 5/5, zero skips.
Full focused regression command:

```sh
node --test tests/check-tier1.test.mjs tests/check-tier2.test.mjs \
  tests/workspace-config.test.mjs tests/preflight.test.mjs \
  tests/tier-defaults.test.mjs
```

Result: 79 passed, zero failed/cancelled/skipped; `git diff --check` passed.
Mapped requirements: QA-GOV-001/002/003/004/009. Coverage includes both
accepted autopilot directions through linked Tier 1 final CLI, linked Tier 2
PR CLI, and isolated single-checkout PR CLI. CI fixtures use a governed Tier 3
plan because policy setup is itself in that PR's diff; intended source changes
still follow initial assessment. Tier 1 has no CI base-policy option, and this
correction adds none. CI clones explicitly have only one registered worktree.

Negative fixtures deliberately supply consistently hashed raw acceptance and
initial evidence to prove final enforcement rejects unmarked autopilot,
weakened new tier selection and direct-merge overrides. These are adversarial
test data, not real acceptance or reviewer approval. Existing marker validation,
legacy digest, stale provenance, immutable assessment, accessibility, review,
and preflight-ordering regressions passed. No markerless linked-policy exception,
bootstrap provenance exception, or release-continuation behavior was introduced.

Findings CR-006-001 and CR-006-004 remain outside this correction. Final finding
resolution and Staff/AppSec approval belong to the assigned independent
reviewers after the controller completes the remaining corrections.

## Independent controller verification

On 2026-09-26, `/root` independently reran the complete five-file focused
command above after both implementation/evidence pairs were committed.
Result: 79 passed, zero failed/cancelled/skipped/todo, 44018.384625 ms.
Log: `/tmp/epic006-policy-check-independent.log`. Inspected the shared-helper
diff and confirmed that new/legacy direct-merge resolution retains the explicit
generic-checker limitation. This verifies the correction; it does not resolve
Staff findings or replace either final review.
