# EPIC-006 bootstrap correction

Owner authorization: 2026-09-26, current Codex conversation
`01a0df14-1771-7920-b79c-c1554998e641`. The owner explicitly authorized
"a bootstrap correction that retains the existing approved gates while
repairing the new dispatch integration before activation".

The resumed session found no supplied workflow harness actor or stored
authorization. The new `task.dispatch` entrypoint rejected dispatch with
`trusted harness actor is required`. Bootstrap work therefore uses the
previously approved canonical plan/task gates under this explicit owner
authorization until the adapter is repaired and verified. This exception is
limited to EPIC-006 bootstrap; it supplies no fabricated identity, independent
approval, host review, or activation evidence. All final review, AppSec,
PR-only merge, host protection and integrated activation gates still apply.

TASK-015's original focused suite passes 12/12, but inspection found missing
GitHub CLI authentication and no explicit exact-head status publication.
The gate rejected reopening TASK-015 because completed documents cannot reset.
Preserve that historical record; repair these acceptance gaps through bounded
follow-up implementation/evidence commits under the active approved plan before
TASK-016. Independent Principal assessment `/root/bootstrap_governance_route`
confirmed these restore existing TASK-015 acceptance without expanding scope.
The immutable plan revision and preflight remain unchanged; final reviews must
cover all corrections. This records corrective work, not a new approval.
Verify the review event workflow itself comes from trusted base code, including
review and check-completion delivery. Install host protections only after
integration and observation of the actual required status.

Dispatch integration must resolve real harness session context and reference
owner-authorized, accepted-policy-bound records. Tests or invented environment
claims must never be recorded as actual session activation. Finish adapter
verification before claiming activation or releasing EPIC-007.
