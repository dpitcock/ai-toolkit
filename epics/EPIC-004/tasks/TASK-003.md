---
kind: task
id: TASK-003
owner: "Codex"
status: draft
revision: 2
parent: ../epic-plan.md
parent_revision: 2
depends_on:
  - tasks/TASK-001.md
  - tasks/TASK-002.md
evidence:
  red: null
  green: null
  qa: null
  commit: null
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-003

## Acceptance criteria
- Add scripts/lib/task-assessment.mjs and scripts/preflight.mjs. Accept one JSON assessment from stdin and a safe --id, --coordination-root, and --worktree-root.
- JSON keys are developer, scope, risks, userFacingUI, claimedTier, intendedFiles, and accessibilityEvidence with the exact shapes defined in TASK-001. Set stage to preflight in the CLI before invoking the classifier. Do not accept derived tier/reasons from stdin.
- Require a syntactically valid and accepted workspace config/history for the coordination root and, when different, the linked worktree. Refuse missing/unaccepted config, policy digest drift, malformed answers, roots that are not registered linked worktrees, and any tracked/untracked worktree changes before writing the assessment.
- Persist one deterministic YAML evidence record under project/task-assessments/assessment-id.yaml with the starting HEAD, accepted effective-config digest/revision, developer attestation, scope/risk/UI answers, intended files, claimed and selected tier, ordered reasons, and null review/role evidence. Create directories/files without following symlinks or escaping the worktree; refuse to overwrite an existing assessment.
- Tell the user to commit the initial assessment as the sole changed path in a metadata-only evidence commit directly on top of starting HEAD, before any implementation changes. Final validators locate that first commit, require its sole parent to equal starting HEAD and its only changed path to equal this assessment, then compare its immutable initial fields with the current record; edits to initial risk answers, tier, or starting commit fail. Treat this as branch-history tamper evidence only, not authenticated or tamper-proof enforcement.
- Print the selected tier and reasons, effective provider and source, each role approval setting and source, exemption list/reason, and accepted policy digest. The record is evidence, not a second policy source.

## Files and dependencies
- Create scripts/lib/task-assessment.mjs, scripts/preflight.mjs, tests/task-assessment.test.mjs, and tests/preflight.test.mjs.
- Depends on TASK-001 and TASK-002.

## TDD steps
1. Add tests for valid/invalid assessment schema, safe IDs, existing-file refusal, symlink/path traversal, accepted-config requirement, linked-root resolution, dirty-worktree refusal, deterministic record output, complete provenance output, evidence commit parent/path constraints, and final-validation rejection when initial facts differ from the first committed assessment blob.

~~~~json
{
  "developer": "implementer-session",
  "scope": "single-file",
  "risks": {"auth": false, "secrets": false, "schema": false, "publicApi": false,
    "financial": false, "userData": false, "criticalInfrastructure": false,
    "hardToRevert": false},
  "userFacingUI": false,
  "claimedTier": 1,
  "intendedFiles": ["src/notify.js"],
  "accessibilityEvidence": {"triage": null, "plan": null, "finalReview": null}
}
~~~~

2. Run node --test tests/task-assessment.test.mjs tests/preflight.test.mjs. Expected RED: the assessment module and preflight command do not exist.
3. Implement schema validation and root-local no-follow/atomic persistence in the library; implement the stdin CLI using resolveWorkspaceConfig, readWorkspaceHistory, and assertAcceptedWorkspaceConfig. Print the evidence-commit requirement before implementation.
4. Run the focused tests. Expected GREEN: all valid records are reproducible and invalid or unaccepted states stop before creating a record.
5. Commit only the two scripts and two focused tests as feat: add task preflight assessment.

## QA mapping
- QA-004-PREFLIGHT: valid, malformed, missing-acceptance, source-provenance, path-safety, and policy-drift integration cases.
- QA-004-CLASSIFICATION: preserve classifyTask's initial result and reasons.
- SEC-TIER-DOWNGRADE: refuse symlinked/out-of-root evidence paths, never infer accepted policy from a proposal, and verify initial facts against their first committed evidence version.

## Handoff
The persisted record is the baseline for final checks. TASK-004 and TASK-005 must compare their actual diff result against this record and must not overwrite or lower its initial tier.
