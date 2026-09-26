# EPIC-006 staged migration and release handoff

Prepared by task session `/root/implement_task013`, 2026-09-26, under the
approved plan revision 1 and the sequencing ruling in
`project/EPIC-006-bootstrap-correction.md`. These are exact staged candidates,
not active policy or acceptance evidence. No coordination source, active
configuration, acceptance history or immutable assessment was changed.

## Exact candidate and baseline

The coordination root was inspected read-only at
`/Users/dpitcock/Code/agent-canvas`. Its acceptance is revision 1. The assigned
worktree `/Users/dpitcock/Code/agent-canvas/.worktrees/EPIC-006` has raw
acceptance revision 2 and an empty `worktree_overrides` marker. Its effective
configuration still derives from the coordination root.

| Configuration | Normalized digest |
| --- | --- |
| Current root / current effective policy | `a9008f1f352e53a0d39bf66a8b1376d09914ff0523da25b6dbbc45f34643cf5a` |
| Current raw worktree | `d58b8020bf9db0f73ab1ddcbe8867106132d3a713491c906a6711373a6eab7ab` |
| `project/EPIC-006-root-migration.yaml` | `7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd` |
| `project/EPIC-006-worktree-migration.yaml` | `9d48be910d5a2745aeb870c705192b37684bd961e1bc74ea1037d2e0ef230c53` |

Both candidates bind shared definition version 1, digest
`ba44a5e2fa64ca62d8b7c845bf468fb101eed7538f8453957f29575365569435`.
These are normalized policy digests, not file-byte hashes or Git revisions.
The old two-acceptance rollout is superseded by the independently approved
release-continuation design. The root candidate is adopted once against the
integrated raw revision-2 ledger, producing canonical revision 3. The linked
candidate remains historical staged material and is not applied. After I, root
and linked config/history bytes must match exactly, without an override marker.

Exact changes for each corresponding baseline:

- Remove `task_tiers: {tier_1_direct_merge: false}`.
- Add `task_tier: tier_1` and `tier_overrides: {direct_merge: false}`.
- Add `workflow: {autopilot: true}` as owner-approved scope.
- Preserve workspace repository, environment, provider, Slack channel, timezone,
  all role requirements/exemptions and their reason, and daily summary time.
- The root candidate contains no `worktree_overrides`; the linked candidate
  preserves `worktree_overrides: []`. This grants no worktree policy override.

## Release sequencing and commands

Do not apply these during implementation or use them to rewrite bootstrap
acceptance/preflight. First finish task QA and independent staff then AppSec
review on the same revision, merge through the approved PR path, and verify
integrated main with required checks/smoke. Install and verify host PR-only
protection and the actual trusted required status names before activation.
Source approval and locally staged YAML do not prove deployment or authority.

At that release boundary, the controller must obtain authorization to write
the coordination root: the current exclusive-worktree instruction does not
permit that write. Present these exact candidates and current observed base
digests for the decision. Re-read both accepted configurations and proposal
outputs immediately before applying; if a baseline or definition changed,
stop and review a refreshed candidate. Never substitute a newly observed base
digest into an earlier authorization silently.

First integrate original PR0/H0 as M and its status-only finalization PR as F.
Preserve PR0 in the merged canonical markers. Prepare the clean, registered
epic checkout at F. Run its integrated initializer only after actual owner
authority covers F, old root/raw digests, the exact candidate and subsequent
coordination-root reconciliation. Preserve unrelated root changes.
Set `ROLLOUT_ACCEPTOR` to the actual observed policy acceptor; the variable is
not an invented identity or a substitute for authorization.

```sh
ROLLOUT_ROOT=/Users/dpitcock/Code/agent-canvas
ROLLOUT_WORKTREE=/Users/dpitcock/Code/agent-canvas/.worktrees/EPIC-006
node scripts/init-workspace.mjs propose-change --root "$ROLLOUT_WORKTREE" --candidate project/EPIC-006-root-migration.yaml
node scripts/init-workspace.mjs apply-change --root "$ROLLOUT_WORKTREE" --candidate project/EPIC-006-root-migration.yaml --by "$ROLLOUT_ACCEPTOR" --reason 'Adopt reviewed EPIC-006 policy and canonical root representation' --digest 7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd --base-digest d58b8020bf9db0f73ab1ddcbe8867106132d3a713491c906a6711373a6eab7ab
```

Commit only the two policy files as H1. Preserve every historical ledger byte;
recover interrupted transactions through the initializer. This is staged release
acceptance, not activation. The separate `policy-adoption-pr` controller gate
requires the exact candidate proof and observed independent Staff then AppSec
reviews on H1 before any draft PR1. Standalone CLI/CI success cannot supply
missing local owner or reviewer authority. CI proves provenance; the trusted
F publisher independently requires native H1 reviews/checks and unchanged F.

Record PR1 publication and H1-to-I integration with the bounded controller.
Validate both submitted and integrated snapshots, then reconcile the authorized
root and owned release checkout to I without overwriting unrelated work. Verify
identical accepted revision-3 config/history and current definition at both ends.
The exact canonical mirror resolver supplies inherited root authority without
creating another acceptance or restoring the old linked marker. Policy changes
still cannot use status-only finalization. I is not epic completion: the approved
finite activation-evidence stage through J, actual QA-GOV-010 and cleanup remain.

Revoke or supersede stale permits and bind new narrowly scoped authorization
to the real observed owner/session, current branch and scope, accepted root
and linked revision/digest references, effective root digest, shared definition,
actions and completion criterion. A permit for legacy provenance cannot grant
authority under the new policy. Load the integrated controller revision and
invoke the real exported event boundary with harness-observed identity.

## Remaining release evidence

Actual migration/activation and QA-GOV-010 remain pending. Record integrated
revision, current required checks/smoke, effective digest, loaded adapter
revision, and the real session transcript. Demonstrate authorized routine
commits/pushes without routine confirmations or Staff calls, zero premature
review dispatch, one eligible role/head dispatch after readiness, and fixes on
the same PR. Observe real host reviews and merge facts. Fixture identities and
all-green test transport responses are never release receipts.

Persist safe cleanup of owned worktrees/branches/processes and revalidate
deferred actions before execution. Preserve dirty, unpushed, unrelated or
unowned resources. Completion requires current remote-main integration,
resolved introduced findings, current docs, actual activation and cleanup;
refresh host evidence at next-epic admission. Keep EPIC-007 blocked until that
completion gate succeeds, including across controller restarts.
