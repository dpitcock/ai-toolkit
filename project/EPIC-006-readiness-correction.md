# Finite release readiness correction

Developer: `/root/correct_release_readiness`, 2026-09-26. This records bounded
implementation evidence under the existing bootstrap and finite release design
approvals. It is not final Staff/AppSec approval or live QA-GOV-010 acceptance.

## Prerequisite effect boundary

Source: `205db48a025ef90ade691ae7a04f1f2003e22fd6`.

Independent development inspection identified a hidden staged-source path that
could pass working-tree authorization, whitespace trimming of NUL-delimited Git
path identities, and cached branch authority across observation callbacks.

RED: the new real-entrypoint regression failed for missing expected rejection
of staged source (24689 ms total); its whitespace-path extension also failed
for missing expected rejection (63765 ms total).

GREEN: `node --test --test-name-pattern='release commit authorization rejects hidden index' tests/epic-policy-adoption.test.mjs`
passed 1/1, zero failed/cancelled/skipped, duration 62490.430417 ms. The test
exercises hidden source staging, partially staged inconsistent evidence, the
whitespace-prefixed path, valid complete staging, and an observation-time
same-SHA branch switch. `git diff --cached --check` passed before commit.

The controller resolves current registered policy under the state lock and
rechecks branch/policy before dispatch. Staged paths/modes/bytes must match the
authorized evidence snapshot; Git NUL-path output retains exact whitespace.
These generated Git fixtures are development evidence, not actual remote pushes
or session activation. Readiness implementation remains a separate increment.
