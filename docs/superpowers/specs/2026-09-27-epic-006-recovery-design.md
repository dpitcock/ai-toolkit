# EPIC-006 recovery design

## Purpose

Define the one recovery route required before the already-approved
supersession implementation can start. It must repair the repository's
bootstrap deadlock without treating a handwritten status, a local agent review,
or a policy-history edit as authority.

## Observed blockers

1. The coordination configuration contains `worktree_overrides`, which is
   invalid at the root. Existing `propose-change` and `apply-change` validate
   the root before mutation, so they cannot repair it.
2. EPIC-006 is active. A normal successor cannot be admitted unless every
   predecessor is merged and completed.
3. Revising the canonical EPIC-006 plan invalidates its revision-1 assessment
   and completed-task bindings. Its four required review findings also prevent
   the ordinary PR gate while they remain unresolved.

## Recovery record

Add a versioned `project/recoveries/EPIC-006.md` record. It binds an observed
owner decision, the pre-recovery main SHA, the exact invalid policy digest,
the canonical epic/plan revisions, the four historical finding IDs, and the
replacement scope. It is evidence only: it grants no review, merge, completion,
or successor authority.

## Controlled recovery transition

Implement a distinct `recovery-pr` controller, not a fallback in ordinary
`check-pr` or policy adoption. It accepts only a recovery record whose values
match the trusted base and permits exactly these changes:

- a repaired root policy and append-only accepted-history transition;
- a migration record that preserves the immutable assessment and completed
  task evidence while explicitly marks them historical; and
- the supersession schema, event, admission, and terminal-state protections
  from the approved supersession design.

It rejects source unrelated to those contracts, an EPIC-006 policy-adoption
claim, a merge/completion claim, successor creation, or a changed base/head.
The ordinary implementation, finalization, and adoption routes remain strict.

## Review and delivery

The recovery plan must have fresh independent Principal, QA, and AppSec review.
The implementation must receive independent staff and AppSec review on its
exact head. The host must expose a dedicated, authenticated recovery approval
path; local state and a branch-protection bypass cannot stand in for it.

## Verification

Tests must prove that malformed-root recovery is impossible through the normal
transaction, valid recovery is limited to the listed paths, historical task and
assessment evidence cannot become new approval, open EPIC-006 findings remain
auditable without blocking the dedicated recovery gate, and successor admission
requires a validated terminal supersession record plus fresh successor evidence.
