# EPIC-006 QA bar

Defined by independent QA Lead `/root/qa_bar`, 2026-09-26, against project
revision 3 and the governance-first proposal. This is requirements evidence,
not implementation approval. Preserve all existing gate assertions.

| ID | Required evidence |
| --- | --- |
| QA-GOV-001 | All workspace-default/computed-tier combinations; risk, UI and final diff may raise but never lower the selected tier; unknown risk fails closed; selection does not rewrite policy |
| QA-GOV-002 | Shared definition version/digest provenance; unknown/invalid overrides rejected; root/worktree disagreement fails; Tier 2/3 and this template remain PR-only |
| QA-GOV-003 | Legacy omitted/false/true merge setting; immutable old hashes/history; explicit migration, candidate changes, conflicting syntax, transaction interruption/retry; preserve workspace and Slack fields |
| QA-GOV-004 | Authorization binds repository/branch/scope/actions/completion and accepted policy provenance; both autopilot modes; stale/missing/wrong/self-authorized inputs fail; no agent-granted tool access |
| QA-GOV-005 | Initial plan approval distinct from implementation; plan receipt binds ID/revision/SHA/role; unresolved requests block; reject source or policy changes in plan-only PR, including code hidden in nominal docs paths |
| QA-GOV-006 | Live authenticated repository/PR/current-head reviews/checks; wrong actor/role/head, dismissed approvals, pending checks and raced heads fail; metadata-only commits and historic evidence cannot satisfy the new live gate |
| QA-GOV-007 | Pushes dispatch zero reviews; ready/claim/ack/reconcile dedup per role/PR/head; concurrent claims, restarts, transport ambiguity and stale responses cannot duplicate acknowledged work or approve a new head |
| QA-GOV-008 | Both modes block next epic until remote-main integration, required checks/smoke, activation, resolved introduced debt, docs and safe cleanup; squash/rebase supported; dirty/unpushed/unrelated resources preserved; restart recovery |
| QA-GOV-009 | Real entrypoints and new-epic use the same gates; generated adopters package policy assets and isolate instance state; CI never dispatches reviews on pushes; documentation checks supplement behavior tests |
| QA-GOV-010 | Actual-session transcript: multiple authorized commits/pushes, zero routine confirmations or Staff calls, zero review dispatches before readiness, one per eligible role/head afterward, same PR for fixes; integrated revision/digest and persisted cleanup/admission outcome |

Focused commands are specified in each implementation task. Run `npm test`
after all tasks; rerun affected checks after final-review fixes. New test paths
are planned artifacts, not passing tests yet. No unexplained skips/deletions,
weakened assertions, unfinished stubs, suppression of failures, or secrets.

## Baseline observations

On 2026-09-26 the provisioned coordination checkout ran 134 tests: 131 passed,
3 failed. All three failures are generated-adopter initialization in
`tests/scaffold.test.mjs`: it copies workspace acceptance history from `project/`
but not the matching workspace config. This is addressed by TASK-000 before
other implementation. The existing assertions remain required; no skip or
assumed pass is permitted. Log: `/tmp/agent-canvas-baseline.log` (local evidence).

## Initial detailed-plan review

The first QA review requested four corrections: remove the circular post-merge
task, bind authorization provenance, define authoritative host evidence, and
make activation measurable. Detailed-plan revision 2 incorporates these.
Independent re-review must confirm resolution before recording approval.
