# EPIC-006 QA materialization correction

Developer: Codex `/root`, 2026-09-26 (2026-09-27 UTC).
Source: `7f8c87024ad548bc412a55b45710ccc0b13245c2`.

The real pre-merge CI release test failed on source `8dc4f20` because
`materializeReleaseHistory` unconditionally included an absent integration J
in its required revisions. The correction appends J only when an integration
was supplied. The existing exact PR2/head/base/J host checks still precede
materialization, and every included revision must be a full immutable SHA.

RED: `node --test --test-reporter=tap --test-name-pattern='real CI release route is selected' tests/epic-policy-adoption.test.mjs`
failed 1/1 with `materialization requires immutable revisions`, exit 1,
96632.821042 ms. Log: `/tmp/epic006-premerge-materialization-red-20260927.tap`.

The first two-case rerun passed pre-merge CI but exposed a pre-existing fixture
gap in the remote-only J regression. Squash I excludes submitted H1 from its
ancestry; neither the non-local clone nor the temporary remote advertising
only J contained H1. The fixture now advertises the actual submitted H1 on
a separate remote ref. It still asserts J is absent before materialization
and present afterward; no assertion or production proof was weakened.
That failed rerun is retained at `/tmp/epic006-materialization-green-20260927.tap`.
Independent QA `/root/verify_full_qa` confirmed both diagnoses by inspection.

GREEN: the same test command with pattern
`real CI release route is selected|integration materializes the API-bound J object`
passed 2/2, zero failed/skipped/cancelled/todo, exit 0, 37079.049833 ms.
Log: `/tmp/epic006-materialization-corrected-green-20260927.tap`.
`git diff --check` passed. QA-GOV-008/009 coverage includes pre-merge CI and
remote-only J materialization. Full regression QA and final independent Staff
then AppSec review remain pending. No status or external action occurred.
