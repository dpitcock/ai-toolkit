# EPIC-006 dispatch integration correction

Developer: independent task session `/root/correct_dispatch_integration`,
2026-09-26. Source revision: `7482951`. This is local implementation/QA
evidence under the owner-authorized bootstrap correction, not an independent
final review, policy activation, or permission to start EPIC-007. Completed
TASK-011/012 history, plan revision 1, immutable preflight and accepted config
history are preserved.

## Failures reproduced before correction

- Three original security regressions failed: a revoked cached delivery
  returned `continue`; denied epic start persisted active lifecycle state;
  environment actor JSON made the standalone executable succeed.
- Three integration regressions failed: missing task identity/eligibility,
  review/merge stage checks, and arbitrary completion IDs were accepted.
- The actual new-epic executable created a branch/worktree for an incomplete
  predecessor and reached dependency setup before failing. The correction
  rejects before either resource exists.
- Missing predecessor runtime state and an orphan epic branch after deletion
  could be treated as a fresh project. Both now require recovery.
- Acceptance using the raw worktree overlay, as recorded by the real workspace
  initializer, failed with `Workspace configuration changed after acceptance`.
  The old fixture had incorrectly accepted the resolved effective config.
- Explicitly observed empty process inventory was rejected, encouraging
  invented cleanup IDs. Explicit empty arrays now pass; missing arrays and
  unsafe listed resources still fail the existing ownership checks.
- New live integration observer tests initially failed because the observer
  did not exist; all three now pass, including host races and forged checks.

## GREEN and QA

`node --test tests/workflow-event.test.mjs tests/preflight.test.mjs tests/gates.test.mjs tests/epic-completion.test.mjs tests/epic-integration.test.mjs tests/review-scheduling.test.mjs tests/workflow-authorization.test.mjs tests/check-host-reviews.test.mjs`

Result: 69 passed, 0 failed, 0 skipped. `git diff --check` passed before source
commit. QA-GOV-004/006/007/008/009 are exercised: both autopilot modes,
current actor/revocation checks on replay, canonical dependency/stage checks,
durable PR/head/role claims, exact-current-head live merge evidence, typed
completion plus renewed host observation, and pre-provision admission.
Existing gate, authorization, scheduling and preflight assertions remain.
The full integrated suite and independent final reviews remain required.

## Controller boundary and executable route

The embedding controller calls exported
`runWorkflowEvent(args, {actor, observers})`, which consumes the bounded event
from stdin and emits the structured decision. It must supply its observed
session actor separately from stdin. The equivalent in-process API is
`handleWorkflowEvent({root, event, actor, observers})`. Plain CLI use without
that controller emits structured `human-needed` with exit status 1, even if
`WORKFLOW_HARNESS_ACTOR` contains plausible JSON. Tests exercise both routes.

Synchronous observer callbacks run under the common-directory state lock:

- `pullRequest(context)` returns observed canonical repository, PR, and head
  for hosted review scheduling. Pre-PR final reviews retain local stage/head
  and role context without inventing a PR or hosted claim.
- `reviewAuthority(context)` returns the controller's independently obtained
  reviewer identity mappings and authenticated host API. The event invokes
  the existing live review evaluator and canonical PR/merge gates itself.
- `completion(context)` returns typed integration, activation, documentation,
  findings, policy and cleanup evidence from actual observations.
- `integration(receipt)` supplies a fresh authenticated integration observation
  for completion and admission. Missing or asynchronous callbacks fail closed.

These injected values and local persisted records remain cooperative
evidence; an `authenticated` flag is not cryptographic authentication. The
controller owns observing and assigning the real session. Unit fixtures do
not prove actual session activation. The root controller's real-session
legacy-policy denial check is still to be recorded separately.

Repository authority uses the registered checkout's canonical GitHub origin
owner/name. The accepted workspace label is preserved: this repository calls
itself `agent-canvas` while origin is `dpitcock/ai-toolkit`. Permits must bind
the canonical owner/name. Policy provenance combines effective digest with
the actual raw root/worktree acceptance references.

## Provisioning and recovery

`new-epic.sh` calls `admit-epic.mjs` before `git worktree add`. The shared locked
admission helper checks canonical predecessor documents, existing epic
branches, active records, and completion records. First project and explicit
historical baseline are distinct routes; neither manufactures modern
completion evidence. Modern admission uses the existing authenticated `gh`
session to read the merged PR, exact remote-main integration, required gates
check and workflow provenance, and open corrective PRs. It rechecks main/PR
after reads, retrieves no tokens, and performs no host mutation. Integrated
smoke remains the recorded trusted-controller receipt bound to that exact SHA.

Admission persists a provisioning reservation. If setup fails, the reservation
blocks another epic and automatic retry; the controller must inspect the
actual registered worktree/branch/process inventory and explicitly reconcile
that reservation before retry. Existing resources and user work are preserved.
Empty cleanup inventories are allowed only when actually observed as empty;
preserving an in-use owned resource does not mean its cleanup is complete.

No external reviews, host protection changes, merge, cleanup, configuration
migration, or activation occurred in this correction. TASK-016 packaging and
documentation must describe this executable controller boundary and include
the new admission/integration helper files.
