# EPIC-006 QA routing correction

Developer: Codex `/root`, 2026-09-26 (2026-09-27 UTC).
Source: `05d31f2eb94c4f4cb8e0e84a9e68edf78ab1f19f`.

The independent QA session `/root/verify_full_qa` ran the full test inventory
in four groups, with bootstrap separately verified. On source `8dc4f20`,
group 1 passed 70/86 and failed 16 ordinary PR tests. Release stage discovery
requested a canonical GitHub origin before determining whether the trusted
base contained the relevant merged EPIC-006 plan. That incorrectly intercepted
ordinary repositories and prevented their existing validators from running.

The correction classifies the trusted base first, then retains canonical
repository validation for the applicable release stage. It does not inspect
candidate-controlled status or relax any adoption proof.

RED: `/tmp/epic006-independent-qa-group1-20260927.tap`, 70 passed, 16 failed,
zero skipped/cancelled/todo, 299892.324208 ms. All failures were in
`tests/check-tier2.test.mjs`; the independent QA session inspected the log.

GREEN: `node --test --test-reporter=tap --test-name-pattern='PR CLI accepts canonical mirrors|check-pr accepts its exact ready-for-PR Tier 3 plan' tests/check-tier2.test.mjs`
passed 2/2, zero failed/skipped/cancelled/todo, exit 0, 5549.400167 ms.
Log: `/tmp/epic006-routing-green-20260927.tap`. `git diff --check` passed.

QA-GOV-005/009: ordinary PR routing again reaches existing Tier 2/Tier 3
validation. Complete affected regression QA and independent final Staff and
AppSec reviews remain required. No status transition or external action occurred.

Other baseline observations: isolated bootstrap passed 56/56; group 4 passed
55/55. Groups 2/3 were explicitly cancelled to repair confirmed failures and
their retained logs are incomplete, not passing evidence. Their owned process
groups and descendants exited. No test assertion was changed or suppressed.
