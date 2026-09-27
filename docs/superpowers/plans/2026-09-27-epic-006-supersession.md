# EPIC-006 Supersession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: blocked pending recovery design.** The companion bootstrap-exception
> specification records owner authority to prepare that recovery design only.
> It does not permit task dispatch, a root-policy edit, a canonical-plan reset,
> successor creation, or a PR under this plan until an independently reviewed,
> host-authorized recovery route resolves those prerequisites.

**Goal:** Retire EPIC-006 through an authenticated, terminal supersession record and unblock a new policy-migration epic without rewriting historical evidence.

**Architecture:** A dedicated supersession-record validator binds owner authorization, current document revisions, and the retiring head before `check-gate` can transition an epic and plan to `superseded`. PR, event, workflow-state, special EPIC-006 controllers, and epic admission reject retired authority except for a validated successor-admission decision. The project plan records a new successor epic; that successor owns the later workspace-policy migration.

**Tech Stack:** Node.js ESM, YAML frontmatter, existing gate/event controllers, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-epic-006-supersession-design.md`

## Global Constraints

- Preserve every EPIC-006 document, task, review, Git reference, and workspace-policy-history byte unless a new, reviewed transition explicitly changes it.
- `superseded` is terminal and is never merge, completion, activation, or reviewer authority.
- Authenticate owner authority through the existing event harness; event JSON and local files cannot establish it.
- Keep the successor policy migration in a separate epic, branch, assessment, and PR sequence.
- Follow the repository’s PR-only, independent code-review, QA, and AppSec requirements.

## Review Focus

- A hand-edited `superseded` status without a matching durable owner decision must fail.
- A decision bound to an old plan revision or a different head must fail.
- A superseded plan must not authorize implementation, finalization, release verification, or policy adoption.
- Existing merged/done evidence and legacy policy history must remain byte-identical.
- A successor epic must not inherit EPIC-006 approvals, assessments, or runtime records.

## File Structure

- `scripts/lib/supersession-record.mjs`: validates the immutable decision record and its document/head bindings.
- `scripts/check-gate.mjs`: adds the supersession transition and terminal-state rejection.
- `scripts/workflow-event.mjs` and `scripts/lib/workflow-state.mjs`: carry authenticated supersession authority and reject retired runtime use.
- `scripts/check-pr.mjs`, `scripts/lib/epic-policy-adoption.mjs`, and `scripts/lib/release-verification-*.mjs`: refuse EPIC-006-specific delivery paths once retired.
- `scripts/lib/workflow-admission.mjs`: permits a successor only after it validates the terminal supersession record and retains every other predecessor/active-state check.
- `project/` and `docs/`: record the supersession and designate the successor policy-migration epic.
- Focused `tests/*.test.mjs`: establish the contract before implementation.

### Task 1: Add the supersession decision contract

**Files:**
- Create: `scripts/lib/supersession-record.mjs`
- Modify: `scripts/check-gate.mjs`
- Test: `tests/supersession-record.test.mjs`, `tests/gates.test.mjs`

**Interfaces:**
- Produces `validateSupersessionDecision(record, context)` and a gate target that validates an epic/plan pair before writing `superseded`.
- Consumed by event, PR, and runtime-controller tasks.

- [ ] **Step 1: Write failing validation tests**

Cover a valid decision plus missing owner authorization, mismatched epic/plan revision, mismatched head, forged replacement scope, duplicate decision ID, and attempts to supersede `merged` or `done` documents.

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `node --test tests/supersession-record.test.mjs tests/gates.test.mjs`

Expected: supersession cases fail because no record validator or transition exists.

- [ ] **Step 3: Implement the decision schema and transition**

Create the pure validator and add `superseded` only as a terminal epic/epic-plan state. Require the same decision ID, bound revision, and head in both documents; reject hand-edited or incomplete records.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `node --test tests/supersession-record.test.mjs tests/gates.test.mjs`

Expected: all supersession and existing transition tests pass.

- [ ] **Step 5: Commit**

`git commit -m "feat: add governed epic supersession records"`

### Task 2: Bind supersession to authenticated workflow authority

**Files:**
- Modify: `scripts/workflow-event.mjs`, `scripts/lib/workflow-state.mjs`
- Test: `tests/workflow-event.test.mjs`, `tests/workflow-state.test.mjs`

**Interfaces:**
- Consumes the Task 1 decision validator.
- Produces an authenticated `epic.supersede` event path that persists only validated, observed owner authority.

- [ ] **Step 1: Write failing event and state tests**

Exercise accepted observed-owner supersession, unauthenticated actor rejection, stale-head rejection, replay/idempotency behavior, and rejection of EPIC-006 runtime policy/release records after retirement.

- [ ] **Step 2: Run RED tests**

Run: `node --test tests/workflow-event.test.mjs tests/workflow-state.test.mjs`

Expected: new event cases fail.

- [ ] **Step 3: Implement the authenticated event boundary**

Add the typed event and durable state validation. Event input may reference stored authority only; the harness must supply the observed owner and current revision/head facts.

- [ ] **Step 4: Run GREEN tests**

Run: `node --test tests/workflow-event.test.mjs tests/workflow-state.test.mjs`

Expected: new and existing event/state tests pass.

- [ ] **Step 5: Commit**

`git commit -m "feat: authorize governed epic supersession"`

### Task 3: Disable retired EPIC-006 delivery authority

**Files:**
- Modify: `scripts/check-pr.mjs`, `scripts/lib/epic-policy-adoption.mjs`, `scripts/lib/release-verification-proof.mjs`, `scripts/lib/release-verification-runtime.mjs`
- Test: `tests/epic-policy-adoption.test.mjs`, `tests/lifecycle-finalization.test.mjs`, `tests/release-review-integrity.test.mjs`

**Interfaces:**
- Consumes the terminal status and durable supersession decision from Tasks 1–2.
- Produces deterministic rejection for every EPIC-006 policy/release path after retirement.

- [ ] **Step 1: Write failing controller tests**

Prove that policy-adoption, finalization, release-verification, and generic implementation routing reject a superseded EPIC-006 even when old candidate bytes, PR metadata, or runtime records are present.

- [ ] **Step 2: Run RED tests**

Run: `node --test tests/epic-policy-adoption.test.mjs tests/lifecycle-finalization.test.mjs`

Expected: retirement-specific assertions fail before controller changes.

- [ ] **Step 3: Implement explicit retired-authority rejection**

Check the canonical plan/epic terminal state before selecting a special route, and reject instead of falling back to a generic implementation path. Preserve historical proof readers for audit only; they must not grant publication, merge, or completion authority.

- [ ] **Step 4: Run GREEN tests**

Run: `node --test tests/epic-policy-adoption.test.mjs tests/lifecycle-finalization.test.mjs tests/release-review-integrity.test.mjs`

Expected: retired EPIC-006 routes fail closed; non-retired fixtures retain current behavior.

- [ ] **Step 5: Commit**

`git commit -m "fix: reject delivery from superseded epics"`

### Task 4: Record the official EPIC-006 supersession and successor scope

**Files:**
- Create: `project/supersessions/EPIC-006.md`
- Modify: `epics/EPIC-006/epic.md`, `epics/EPIC-006/epic-plan.md`, `project/project-plan.md`, `docs/gates.md`, `docs/workflow.md`, `scripts/lib/workflow-admission.mjs`
- Test: `tests/gates.test.mjs`, `tests/local-review-route.test.mjs`, `tests/workflow-event.test.mjs`

**Interfaces:**
- Consumes the authenticated decision contract and controller behavior.
- Produces a terminal EPIC-006 record and a named successor policy-migration epic in the project plan.
- Allows admission only when it validates that terminal record; missing, forged, stale, incomplete, or active predecessors remain denied.

- [ ] **Step 1: Write failing integration tests**

Use a representative EPIC-006 fixture to prove the decision record is required before both canonical documents become superseded, the project-plan successor has no inherited approvals or task binding, and admission still rejects every nonvalidated predecessor state.

- [ ] **Step 2: Run RED tests**

Run: `node --test tests/gates.test.mjs tests/local-review-route.test.mjs tests/workflow-event.test.mjs`

Expected: the fixture cannot yet archive an active epic or start the independent successor route.

- [ ] **Step 3: Apply the observed owner decision through the event harness**

Create the decision record with the actual current revision/head and replacement scope, then use the new authenticated event/gate transition. Update admission to recognize only that validated terminal record, and update project/docs language to identify the successor as a new policy-migration epic; do not create or start it in this task.

- [ ] **Step 4: Run GREEN tests and documentation validation**

Run: `node --test tests/gates.test.mjs tests/local-review-route.test.mjs tests/workflow-event.test.mjs && git diff --check`

Expected: the retirement record is accepted, EPIC-006 delivery remains blocked, and the successor remains independent.

- [ ] **Step 5: Commit**

`git commit -m "docs: record EPIC-006 supersession"`

### Task 5: Run final governance verification

**Files:**
- Test: `tests/gates.test.mjs`, `tests/workflow-event.test.mjs`, `tests/workflow-state.test.mjs`, `tests/epic-policy-adoption.test.mjs`, `tests/lifecycle-finalization.test.mjs`, `tests/release-review-integrity.test.mjs`

**Interfaces:**
- Consumes all implementation and decision records.
- Produces final QA evidence for independent code review and AppSec review.

- [ ] **Step 1: Run the full affected suite**

Run: `node --test tests/gates.test.mjs tests/workflow-event.test.mjs tests/workflow-state.test.mjs tests/epic-policy-adoption.test.mjs tests/lifecycle-finalization.test.mjs tests/release-review-integrity.test.mjs`

Expected: zero failures, cancellations, or skipped required cases.

- [ ] **Step 2: Verify final scope**

Run: `git diff --check && node scripts/review-route.mjs --base origin/main --head HEAD`

Expected: production route and no unintended paths.

- [ ] **Step 3: Obtain independent final reviews**

Request five-axis staff review, then AppSec review, on the exact final commit. Record actual findings and approvals; do not open a PR until both pass.

## Task Order and Checkpoints

Tasks 1–3 are sequential because each expands the next task’s trusted input.
Task 4 follows only after controller rejection is proven. Task 5 follows all
implementation tasks. The successor policy-migration epic begins only after
this plan merges through a PR.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Status editing bypasses evidence | Require authenticated event plus matching record/head/revision in the gate. |
| Old EPIC-006 controller silently falls back | Add explicit terminal-state rejection before route selection. |
| Supersession erases audit evidence | Make records additive and assert historical bytes in tests. |
| Successor reuses stale authority | Require fresh epic plan, assessment, and reviews; test rejection of inherited bindings. |
