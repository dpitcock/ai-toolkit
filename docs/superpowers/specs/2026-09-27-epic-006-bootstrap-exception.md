# EPIC-006 supersession bootstrap exception

Date: 2026-09-27

## Owner decision

The owner approved a one-time bootstrap exception in the current Codex
conversation. Its purpose is to resolve the circular dependency between the
unfinished EPIC-006 and the policy/admission controls that require EPIC-006 to
be merged before any successor can begin.

This is an authorization to prepare and independently review a narrowly scoped
bootstrap route. It is not a status change, merge, completion receipt, policy
acceptance, reviewer verdict, or host-protection waiver.

## Why the ordinary route cannot start

The coordination-root configuration contains a worktree-only marker and is
therefore rejected by workspace status and preflight. The ordinary policy
adoption route requires the original EPIC-006 plan to be merged. Epic admission
also requires every earlier epic to be merged with verified completion before a
successor worktree can be provisioned. EPIC-006 is active and its plan remains
in review with unresolved required findings.

Consequently, neither a successor epic nor the supersession implementation can
be dispatched through the normal route at this revision. Directly editing the
status, deleting the epic, accepting a policy candidate without its transaction,
or treating historical approval as successor approval would conceal rather than
resolve that condition.

## Narrow permitted bootstrap scope

The bootstrap route may do only the following, in this order:

1. Create an amended canonical EPIC-006 plan that adds one bounded
   supersession task and records the current owner decision. The amendment must
   receive fresh independent Principal, QA, and AppSec plan review; prior
   approvals and open findings remain historical evidence and cannot be
   relabeled.
2. Use the existing workspace policy transaction to produce the exact root
   policy-repair candidate and its append-only history record. The candidate
   must remove the coordination-root-only `worktree_overrides` marker and keep
   direct merge disabled. It remains subject to an explicit human acceptance
   and exact-head independent review.
3. Implement the approved supersession contract only on the existing
   `epic/EPIC-006` branch, with the immutable assessment, focused RED/GREEN
   evidence, full affected QA, and fresh final independent code and AppSec
   reviews required by the current repository policy.
4. Submit the resulting change through a PR. The authenticated host review and
   protected-branch path remain mandatory. The bootstrap route never pushes,
   merges, or treats a local validator result as host authorization.

The bootstrap scope is limited to the files and behavior in
`2026-09-27-epic-006-supersession-design.md` plus the root policy transaction
needed to make ordinary workspace validation possible. It must not add a
successor epic, enable Tier 1 direct merge, alter unrelated historical records,
delete branches or worktrees, or change provider/approval/accessibility policy.

## Required safeguards

- The supersession decision is durable, additive, and bound to the observed
  owner decision, canonical head, and current epic/plan revisions.
- `superseded` is terminal and cannot be handwritten or used as merge,
  completion, activation, review, or successor authority.
- The old EPIC-006-specific policy and release controllers reject retirement
  instead of falling back to generic implementation routing.
- The root-policy candidate is evaluated through its existing proposal and
  acceptance ledger. Its history is never rewritten.
- The exception expires when the approved bootstrap PR is merged or rejected.
  A retry requires a new exact-head review and owner decision.
- Host observations, identities, and reviewer verdicts remain external facts;
  neither this document nor an agent may fabricate them.

## Required evidence before implementation dispatch

Before the new task begins, retain all of the following in the amended
canonical plan or associated review record:

- the owner decision reference and its date;
- the exact EPIC-006 branch and starting head;
- the replacement scope: an independently governed policy-migration epic;
- fresh plan-review records from the required independent roles;
- the proposed root-policy digest and a precise changed-field list; and
- an explicit statement that the successor is neither created nor approved by
  the exception.

If any item is absent, the bootstrap route stops and awaits human direction.

## Completion and handoff

Successful implementation does not itself archive EPIC-006. The authenticated
supersession event and gate transition must validate the reviewed, current head.
Only then may the project record EPIC-006 as superseded and begin normal
admission of a separately planned successor. A rejected PR, stale head,
unresolved final-review finding, or failed policy transaction leaves EPIC-006
unchanged and active.
