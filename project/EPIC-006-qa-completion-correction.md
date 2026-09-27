# EPIC-006 completion regression correction

Developer: Codex `/root`, 2026-09-27.
Source: `76a2785bdbe4b641a4e614dd29579a2799036389`.

The focused same-PR2 regression exposed two production schema mismatches:

- Three completion checks read `adoption.original.head`, although the strict
  adoption proof schema defines `adoption.original.submittedHead`.
- Admission supplied `releaseVerification` as an extra host-receipt input key,
  which the strict host schema rejects. The verified relation already travels
  through the separate validation context and remains validated there.

The correction uses the canonical field and removes only the redundant,
forbidden host-input key. No authority or equality check is removed. The
fixture now uses the actual observed check ID. Exact expected rejection text
is updated for false J identity and already-recorded integration. New pure
negative assertions reject a different submitted head and original merge SHA.

Retained failing runs, all on Node 24.11.0:

- `/tmp/epic006-j-completion-corrected-20260927.tap`: exit 1, 1 failed,
  213872.639833 ms; valid completion rejected by the wrong original-head field.
- `/tmp/epic006-j-completion-schema-green-20260927.tap`: exit 1, 1 failed,
  213598.568875 ms; subsequent admission rejected the extra host-input key.
- `/tmp/epic006-j-completion-binding-green-20260927.tap`: exit 1, 1 failed,
  217692.481208 ms; completion and its persisted state passed, then the replay
  rejection assertion expected stale wording. This failed run is not a pass.

GREEN: `node --test --test-concurrency=1 --test-reporter=tap
--test-name-pattern='same open PR2 correction invalidates both readiness
boundaries and requires fresh independent review'
tests/epic-policy-adoption.test.mjs` passed 1/1, exit 0, zero failed,
skipped, cancelled or todo, 218284.41875 ms. The full log is retained at
`/tmp/epic006-j-completion-final-green-20260927.tap`. The run used Node 24.11.0
and the exact source subsequently committed above. `git diff --check` passed.

Independent QA `/root/verify_full_qa` inspected the canonical schema and
completion/admission path and agreed with the narrow corrections. The wider
independent personal-use QA result is recorded in `EPIC-006-personal-use-qa.md`.
This regression is not full-suite, final Staff/AppSec or hosted activation
evidence.

## Deferred hosted observer finding

QA also identified that the default `observeEpicIntegration` adapter still
treats advancement beyond the original merge as status-only finalization.
The J continuation includes policy/evidence changes. The local regression
uses a typed injected observer and cannot prove that the default live adapter
supports J. Retain this finding for the deferred hosted activation route;
do not claim live J readiness, canonical completion or full release QA here.
