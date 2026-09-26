---
kind: task
id: TASK-001
owner: "Codex"
status: done
revision: 2
parent: ../epic-plan.md
parent_revision: 3
depends_on: []
evidence:
  red: "node --test tests/task-tier.test.mjs failed before implementation with
    ERR_MODULE_NOT_FOUND; later focused runs caught false-low workflow-path,
    control-character-path, and self-review-identity cases before their fixes."
  green: "node --test tests/task-tier.test.mjs: 12/12 passed; npm test: 67/67 passed."
  qa: "Checked all eight risk flags, missing/unknown answers, malformed paths,
    sensitive-path false claims, staged UI evidence, identity collisions, claim
    monotonicity, and actual-file expansion; git diff --cached --check passed."
  commit: "58eb716"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-001

## Acceptance criteria
- Export classifyTask(input) from scripts/lib/task-tier.mjs. Accept stage (preflight or final), developer (nonempty attested identity string), scope (single-file, one-subsystem, cross-cutting, unknown), risks (auth, secrets, schema, publicApi, financial, userData, criticalInfrastructure, hardToRevert; each boolean or null), userFacingUI (boolean or null), claimedTier (1, 2, 3, or null), intendedFiles (string array), optional actualFiles (string array), and accessibilityEvidence.
- accessibilityEvidence has triage and plan entries shaped as {by, date, notes, revision}, plus an optional finalReview entry shaped as {by, date, notes, revision, commit}. Null means absent; malformed objects are never evidence. At preflight stage, UI may be Tier 2 only with valid triage/plan evidence whose reviewer differs from developer; finalReview is not yet expected. At final stage UI also requires finalReview by someone other than developer on the exact reviewedCommit. Identity values are consistency checks, not authentication.
- Return a deterministic {tier, reasons} result. Missing/null risk answers, true high-risk answers, cross-cutting/unknown scope, malformed inputs, or unbounded actual diffs route to Tier 3. A claim above the computed tier is preserved; a lower claim never reduces it.
- Tier 1 requires explicit single-file scope, exactly one intended/actual code file, every risk false, no conventional sensitive-path match, and userFacingUI false. Tier 2 requires explicit one-subsystem scope, no more than five actual files, and no high-risk/unknown answers or sensitive-path match. Deterministically match conventional auth, secret, schema/migration, public API, financial, user-data, and infrastructure path names; any match forces Tier 3 even if the matching caller-supplied risk answer is false. This is conservative evidence, not proof that an unmatched file is semantically low-risk; require the caller to attest after inspecting intended files/diff and state that classification is cooperative. Configured role approvals are not classifier inputs; the Tier 2 PR validator enforces them.
- File count can escalate but cannot establish safety without explicit scope and risk answers.

## Files and dependencies
- Create scripts/lib/task-tier.mjs and tests/task-tier.test.mjs.
- No prerequisite tasks. Do not read workspace config or the filesystem in the pure classifier.

## TDD steps
1. Add table-driven cases in tests/task-tier.test.mjs for Tier 1, Tier 2, Tier 3, each risk flag, every missing/null field, UI at preflight and final stages, higher/lower claimed tiers, actual-file expansion, and each sensitive-path class falsely declared low-risk.

~~~~js
const result = classifyTask({
  stage: 'preflight', developer: 'implementer-session', scope: 'single-file',
  risks: {auth:false, secrets:false, schema:false, publicApi:false, financial:false,
    userData:false, criticalInfrastructure:false, hardToRevert:false},
  userFacingUI: false, claimedTier: 1, intendedFiles: ['src/notify.js']
});
assert.equal(result.tier, 1);
~~~~

2. Run node --test tests/task-tier.test.mjs. Expected RED: module or classifyTask export is missing.
3. Implement the exported function with explicit input validation, stable ordered reasons, and max-tier escalation. Do not infer low risk from the file count.
4. Run node --test tests/task-tier.test.mjs. Expected GREEN: all classifier cases pass, including malformed inputs failing closed.
5. Commit only scripts/lib/task-tier.mjs and tests/task-tier.test.mjs as feat: classify task scope and risk.

## QA mapping
- QA-004-CLASSIFICATION: deterministic unit matrix, unknown/high-risk and sensitive-path escalation, claim monotonicity, and staged Tier 1/Tier 2 UI boundaries.
- SEC-TIER-DOWNGRADE: malformed or incomplete assessment never produces a lower tier.

## Handoff
Export classifyTask(input) and return {tier, reasons}; TASK-003 persists its initial result and TASK-004/TASK-005 reuse it with actual files. Record actual RED/GREEN/QA evidence and the implementation commit before the task's in-review/done transitions.
