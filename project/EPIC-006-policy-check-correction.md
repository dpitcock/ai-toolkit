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
