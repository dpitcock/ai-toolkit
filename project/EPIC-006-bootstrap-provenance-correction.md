# EPIC-006 bounded bootstrap provenance correction

Developer: Codex `/root/correct_bootstrap_provenance`, 2026-09-26.
Source revision: `0c30590cf2daa6d72eba2b6b1d87de7f5f8aec03`.
Finding addressed: CR-006-001. Canonical plan remains revision 1, in-progress.
Authority: Principal design `05a8dd8` and independent AppSec design `ebaaa51`;
the parent session supplied the existing owner bootstrap-correction authority.
This evidence does not resolve the Staff finding or grant final approval.

## Implemented contract

`scripts/lib/bootstrap-policy.mjs` exports the read-only function
`recognizeBootstrapPolicy({root,baseSha,headSha,headRef,assessmentPath})`.
Its production identities are fixed to `dpitcock/ai-toolkit`, `epic/EPIC-006`,
canonical plan revision 1, the approved B/P/S/A commits and original assessment
path/blob. There is no candidate, environment, event or CLI identity override.
Git reads disable replacement objects. Missing objects or failed proof reject.

The recognizer verifies base policy absence, the exact regular-file provisioning
paths, original root acceptance, deterministic empty-marker materialization,
all raw/root/effective digests and revisions, and the full history prefix plus
one valid marker-change record. It inspects every commit in the range, including
merge-parent diffs; policy changes outside P/S fail even if reverted. It checks
the original sole-path direct-child assessment, its pinned blob, immutable facts
at every subsequent assessment change, and canonical plan/task/branch/policy
bindings. Other intended paths retain their preflight-before-change restriction.

Success returns `root` and `linked` snapshots, each containing `config`,
`configText`, `history`, `historyText`, and `accepted`; also `effective`,
`allowedPaths`, `initialAssessment`, and `initialEvidenceCommit`. The helper
proves the supplied original submission head without reading the working tree
or moving HEAD, so a later adoption validator can revalidate H0. It grants no
review, publication, merge, adoption or activation authority.

`check-tier2.mjs` invokes this proof only when intended policy paths changed
before preflight. The ordinary route remains available to unrelated repositories
using the same assessment ID. After proof, the checker requires exact working
policy/history bytes and regular modes and uses the proven root/effective policy
without consulting arbitrary sibling worktrees. The only exempted provisioning
paths are the two proven policy paths.

## RED, GREEN and verification

- Initial RED: two tests failed with the original `intended source path
  config/workspace-config.yaml changed before initial assessment evidence`
  error, through both `validateTier2Assessment` and the real PR entrypoint.
- A later compatibility RED demonstrated that unconditional ID recognition
  rejected an ordinary accepted-policy assessment in another repository.
  Restricting recognition to required provisioning exceptions fixed that case.
- Final GREEN: `node --test tests/bootstrap-policy.test.mjs
  tests/check-tier2.test.mjs tests/check-tier1.test.mjs
  tests/workspace-config.test.mjs`: **121 passed, 0 failed, 0 skipped**.
  Log: `/tmp/epic006-bootstrap-regression.log`.
- The 56 bootstrap cases cover real-history success, wrong identities,
  unavailable objects, policy edits/reverts, executable and symlink files,
  exact working bytes, assessment fields and edit/revert sequences, canonical
  bindings, sibling independence, read-only historical validation, and the
  ordinary same-ID route. Five initial synthetic fixture checkout errors were
  corrected within disposable fixtures before the complete passing rerun.
- Reconstructed-history negatives cover shape-compatible and malformed P/S/A
  histories: root acceptance, regular modes, missing/extra paths, marker shape,
  history prefix/append/digest/revision/acceptor/reason/date, assessment blob,
  sole-path/direct-parent requirements, and partial base policy. Changing these
  historical objects necessarily changes their identities: these tests prove
  rejection at the pinned ancestry/identity boundary, **not inner-predicate
  negative branch coverage**. The actual pinned history exercises those inner
  historical predicates positively. No test-only production pin override exists.
- `git diff --check` passed. Original config, history, assessment, canonical
  plan, reviewer fields and status were not edited by this correction.

The committed candidate's own `scripts/check-pr.mjs` ran successfully in fresh
single-checkout clone `/tmp/epic006-bootstrap-candidate-F786xn`, with
BASE_SHA `553daf9fb49df58e55c3c5a6fbb68df6a0be0a41`, HEAD_SHA equal to the
source revision above, and HEAD_REF `epic/EPIC-006`. Its actual output was:

```text
EPIC-006-PLAN: in-progress -> implementation-pr permitted
project/task-assessments/governance-activation.yaml: Tier 3 epic-gate-required (Tier 3 governed epic/task workflow)
```

This confirms stage admission only. Both final independent reviews, full QA,
release adoption/activation and host gates remain required. No PR, host write,
policy acceptance, coordination-root change, status transition or review
resolution was performed. CR-006-004 and canonical mirror work remain outside
this bounded task; the parent session owns subsequent verification and release.
