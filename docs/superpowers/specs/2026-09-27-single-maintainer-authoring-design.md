# Single-maintainer authoring design

## Decision

For this repository, a verified `authoring` route may be merged by the owner
after the trusted `gates` check passes and an independent Code Reviewer
approves the exact head. It does not require a staff, Principal, QA, or AppSec
approval. The owner remains responsible for the merge decision, but cannot
self-approve the authoring change.

## Boundary

This exception is path-based and applies only when trusted-base
`policy/review-paths.json` classifies the complete PR diff as `authoring`.
Production, legacy, policy, workflow, CI, dependency, bootstrap, enforcement,
and canonical-governance paths retain independent review, AppSec, and their
existing PR gates. Candidate changes cannot classify their own paths or weaken
the trusted host rule.

## Host behavior

The default-branch host publisher derives required roles from the trusted path
route. For `authoring`, it verifies the exact head and required `gates` status,
plus the configured independent `code_reviewer` identity, then publishes
`host-review-gate`. Every other route retains the configured role map and
exact-head review validation.

## Verification

Tests must prove authoring-only docs pass with one current-head independent
Code Reviewer and fail without one; a production path, rename, deletion,
malformed policy, or candidate workflow change cannot use that route; and
existing production review failures remain failures.
