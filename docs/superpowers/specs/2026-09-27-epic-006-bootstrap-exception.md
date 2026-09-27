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

## Status: proposal only

This exception is not executable authority. Independent review found that the
existing policy transaction calls accepted-policy validation before it can
repair the malformed root; the existing EPIC-006 assessment binds plan revision
1 and completed task evidence; and four required review findings remain open.
The current transaction, plan-amendment, and PR routes therefore cannot carry
the proposed work without a separate recovery design.

No agent may use this document to edit the root policy, reset or amend the
canonical EPIC-006 plan, dispatch a new EPIC-006 task, create a successor, or
open a bootstrap PR. Those actions remain blocked until the recovery design
below receives its own independent review and a host-authorized delivery path.

## Required recovery design

The recovery design must define a single reviewed bootstrap PR route that:

1. repairs the rejected coordination-root configuration through a recovery
   transaction that preserves its append-only policy history and requires the
   existing human acceptance;
2. migrates the immutable assessment, completed-task parent revisions, and
   canonical plan revision without rewriting or relabeling historical evidence;
3. preserves all four EPIC-006 required findings as unresolved audit evidence
   while providing a supersession-specific PR gate that does not falsely mark
   them resolved; and
4. permits no policy adoption, merge, completion, activation, or successor
   admission until a validated terminal supersession record exists.

That design must be reviewed independently for governance, AppSec, and QA
before any implementation begins. Its delivery needs a native-host or other
authenticated maintainer decision; a local document and local test result are
not substitutes for that authority.

## Required safeguards

- The supersession decision is durable, additive, and bound to the observed
  owner decision, canonical head, and current epic/plan revisions.
- `superseded` is terminal and cannot be handwritten or used as merge,
  completion, activation, review, or successor authority.
- The old EPIC-006-specific policy and release controllers reject retirement
  instead of falling back to generic implementation routing.
- The root-policy candidate preserves the proposal and acceptance ledger; its
  recovery transaction may not rewrite history or infer acceptance.
- Any future exception expires when its independently reviewed bootstrap PR is
  merged or rejected. A retry requires a new exact-head review and owner
  decision.
- Host observations, identities, and reviewer verdicts remain external facts;
  neither this document nor an agent may fabricate them.

## Required evidence before any future implementation dispatch

Before the recovery design can permit a task, retain all of the following in
its canonical plan and associated independent review record:

- the owner decision reference and its date;
- the exact EPIC-006 branch and starting head;
- the replacement scope: an independently governed policy-migration epic;
- fresh plan-review records from the required independent roles;
- the proposed root-policy digest and a precise changed-field list; and
- an explicit statement that the successor is neither created nor approved by
  the exception.

If any item is absent, the recovery route stops and awaits human direction.

## Completion and handoff

Successful recovery implementation does not itself archive EPIC-006. The
authenticated supersession event and gate transition must validate the reviewed,
current head. Only then may the project record EPIC-006 as superseded and begin
normal admission of a separately planned successor. A rejected PR, stale head,
unresolved final-review finding, or failed policy transaction leaves EPIC-006
unchanged and active.
