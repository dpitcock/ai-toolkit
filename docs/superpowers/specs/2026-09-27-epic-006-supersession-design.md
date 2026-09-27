# EPIC-006 supersession and policy-migration design

Date: 2026-09-27

## Goal

Retire the unfinished EPIC-006 governance initiative without deleting its
history, and unblock a successor policy-migration effort that can deliver the
workspace configuration independently.

## Context

EPIC-006 is currently `in-review` with unresolved required findings and no
implementation PR. The workspace policy-adoption controller is hard-coded to
the original EPIC-006 merge/finalization chain. That makes a routine policy
migration appear deliverable through a generic implementation route while the
stricter provenance route is inactive.

The owner has chosen retirement over completing EPIC-006 solely to satisfy that
historical chain.

## Decision

Add an explicit, terminal `superseded` state for an epic and its active epic
plan. A supersession is a recorded governance decision, not deletion, reset,
or merge. It preserves all task records, reviews, findings, branch history,
and policy-history bytes exactly as they are.

An authenticated owner decision must name the retired epic, explain why it is
being retired, name a replacement scope, and bind the current epic-plan
revision and head SHA. The repository stores that decision in a regular,
versioned project record. The old plan and epic reference the decision ID; no
existing approval is relabeled as approval of the successor.

## State and gate behavior

`superseded` is terminal. No transition may leave it, and no `pr`,
`implementation-pr`, `finalization-pr`, completion, release-verification, or
policy-adoption action may use a superseded epic or plan as authority.

The transition is permitted only from nonterminal epic/plan states and only
when both documents reference the same decision, revision, and head. Existing
`merged` and `done` records remain immutable and cannot be superseded. The
validator rejects handwritten status edits, missing or divergent decision
references, incomplete decision fields, and any attempt to use the record as
an approval.

## Successor policy migration

The project plan will add a new, bounded policy-migration epic with its own
isolated worktree, assessment, QA bar, security triage, plan approval, and
independent final reviews. It owns:

- a normal accepted-policy change from the active workspace configuration;
- a replacement for EPIC-006-specific policy-adoption gating;
- migration documentation; and
- tests proving the successor cannot reuse EPIC-006 approvals, evidence, or
  branch history.

The successor ID and exact policy candidate are assigned during its approved
epic plan. No generic implementation route may silently adopt the existing
EPIC-006 candidate while the supersession is pending.

## Implementation boundaries

The implementation updates the canonical document schema and transition graph,
the PR/admission logic, the EPIC-006-specific policy/release controllers, and
the project plan. Admission recognizes only a valid, terminal supersession
record as the predecessor exception; it continues to reject a missing, stale,
forged, or active predecessor. It adds tests for valid supersession, forged or
stale records, terminal-state rejection, and an independent successor
migration. It does not rewrite or delete `epics/EPIC-006/**`, current
workspace-policy history, GitHub PRs, reviews, branches, or worktrees.

## Security and audit requirements

Supersession is security-sensitive because it changes which governance records
can authorize delivery. The decision must be durably recorded before status
changes, be tied to an observed owner decision through the authenticated event
harness, and be independently reviewed. Candidate code cannot declare its own
owner identity, reduce required roles, or treat the retired epic's history as
successor approval.

## Verification

Tests must prove that a valid supersession blocks all EPIC-006 delivery actions
and preserves existing files byte-for-byte. Tests must also prove that only the
validated supersession permits successor admission, and that the successor
requires its own accepted policy, assessment, plan, and reviewer evidence. The
full applicable governance test suite, independent code review, and AppSec
review run on the final implementation revision before any PR.

## Non-goals

- Deleting or rewriting EPIC-006, its Git history, reviews, or policy ledger.
- Treating supersession as merge, completion, activation, or authorization.
- Automatically creating, approving, or merging the successor epic.
