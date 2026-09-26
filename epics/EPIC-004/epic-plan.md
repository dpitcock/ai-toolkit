---
# kind/id: document type and stable identifier; owner: assigned author.
# status: changed only through check-gate.mjs --write; revision: increment on scope changes.
# approvals: null, appsec-only not-required, or {by, date: "YYYY-MM-DD", notes, revision}.
# Review approvals also contain commit, matching review_commit. Never self-approve.
# parent: relative parent document; parent_revision: revision this document was planned against.
kind: epic-plan
id: EPIC-004-PLAN
owner: "Codex"
status: ready-for-pr
revision: 3
parent: epic.md
parent_revision: 2
security:
  auth: false
  data: false
  external: false
  concerns: []
  rationale: "Classification and tier checks do not handle credentials, user data,
    or external services. They do influence review routing, so the plan touches
    SEC-TIER-DOWNGRADE and requires AppSec signoff."
accessibility:
  ui: false
  rationale: "Only repository scripts, CI, tests, and agent guidance change. The
    plan preserves mandatory accessibility evidence for UI changes and does not
    introduce a user-facing application interface."
touches_concerns: [ SEC-TIER-DOWNGRADE ]
tasks:
  - tasks/TASK-001.md
  - tasks/TASK-002.md
  - tasks/TASK-003.md
  - tasks/TASK-004.md
  - tasks/TASK-005.md
  - tasks/TASK-006.md
  - tasks/TASK-007.md
review_comments:
  - id: CR-001
    status: resolved
    finding: "Independent final review by /root/epic004_final_code_review on
      2026-09-26 found that check-pr rejects ordinary src/* changes before Tier
      2 assessment validation, leaving the intended application PR route
      untested end to end."
    resolution_commit: "b8081a9f47177604c59901317175e855cad0f22d"
    verified_by: "/root/epic004_revision3_final_review"
    verified_date: "2026-09-26"
    verified_commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
  - id: CR-002
    status: resolved
    finding: "Independent final review by /root/epic004_final_code_review on
      2026-09-26 found that check-tier2 accepts Tier 1 assessments without
      committed passing final-check evidence bound to the reviewed
      implementation."
    resolution_commit: "b8081a9f47177604c59901317175e855cad0f22d"
    verified_by: "/root/epic004_revision3_final_review"
    verified_date: "2026-09-26"
    verified_commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
review_commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
pr_url: null
approvals:
  principal_engineer:
    by: "/root/epic004_principal_revision3"
    date: "2026-09-26"
    notes: "Independent Principal review approved revision 3: TASK-007 is a bounded
      policy/regression slice, completed tasks are reconciled without changing
      evidence, and final code/AppSec/PR safeguards remain intact."
    revision: 3
  appsec:
    by: "/root/epic004_appsec_revision3"
    date: "2026-09-26"
    notes: "Independent AppSec plan review approved revision 3. TASK-007 retains
      SEC-TIER-DOWNGRADE protections, exact-commit final reviews, and mandatory
      final AppSec review; governance-directory metadata remains a cooperative
      exception requiring host protections."
    revision: 3
  qa_lead: null
  code_review:
    by: "/root/epic004_revision3_final_review"
    date: "2026-09-26"
    notes: "Independent final review of
      7d7c7fb3817017762889997a564cfea17ec4a7ea..2bb030369d5aef34f2ff1c0f999ec79\
      6d9932612 approved all five axes. CR-001 and CR-002 were reverified on the
      final review commit; no findings remain. Fresh npm test passed 117/117 and
      review-range diff checks were clean."
    revision: 3
    commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
  appsec_review:
    by: "/root/epic004_revision3_final_appsec"
    date: "2026-09-26"
    notes: "Independent final AppSec review of
      7d7c7fb3817017762889997a564cfea17ec4a7ea..2bb030369d5aef34f2ff1c0f999ec79\
      6d9932612 found no Critical, High, Medium, or Low findings. Fresh npm test
      passed 117/117; npm audit against the committed lockfile found 0
      vulnerabilities; review-range diff checks were clean."
    revision: 3
    commit: "2bb030369d5aef34f2ff1c0f999ec796d9932612"
  accessibility: null
  accessibility_review: null
---

# EPIC-004 Epic Plan

**Goal:** Add fail-closed task classification and proportional Tier 1/Tier 2 checks to adopting repositories, while requiring independent staff code review only for the final PR implementation revision.

**Architecture:** A pure classifier combines explicit scope/risk answers with intended or actual changed files and never lowers a claimed tier. It conservatively escalates conventional sensitive path patterns even when supplied risk booleans say false; classification remains cooperative and does not claim to prove semantic risk absent from those inputs. The accepted workspace config holds the Tier 1 direct-merge opt-in (default false); preflight records a branch-local assessment with config provenance and digest. The initial evidence record must be committed before implementation; final checks compare its immutable facts against the first committed record and reject edits, while treating Git history and handwritten evidence as cooperative rather than authenticated controls. Tier 2 stays on PRs and validates applicable review evidence in the existing PR workflow. Tier 3 continues through the existing epic/task gates; its configured-role enforcement is EPIC-005.

**Tech Stack:** Node.js 22+, ESM, built-in node:test, existing yaml/fs-ext dependencies, Git CLI in local scripts and GitHub Actions.

**Spec:** docs/superpowers/specs/2026-09-24-task-tiering-workspace-config-design.md and docs/superpowers/specs/2026-09-26-final-pr-code-review-design.md; approved project scope: project/project-plan.md revision 2.

## Global constraints
- The template repository itself remains PR-only; no Tier 1 command merges or pushes.
- Tier 1 direct merge is opt-in in accepted workspace config and still depends on compatible host rules; local checks cannot prove host configuration or prevent bypass.
- Unknown, malformed, missing, high-risk, sensitive-path, or scope-expanding evidence escalates to Tier 3 or blocks; a final diff check never lowers the recorded tier.
- Tier 1 excludes all UI work. UI can be provisionally classified as Tier 2 before work only after independent accessibility triage and plan evidence exist; the final PR check additionally requires final accessibility evidence on the reviewed code commit. Missing evidence at either stage routes to Tier 3.
- Tier 3 configured-role resolution, full worktree enforcement, and complete scaffold/CI verification remain EPIC-005.
- Continue using EPIC-003's single accepted config and append-only workspace history; do not add secrets or a second policy config.

## Design
Add task-tier assessment records under project/task-assessments/assessment-id.yaml. Each record captures the developer, accepted-config digest/revision, starting commit, explicit scope and risk answers, intended files, initial tier, reasons, and later final-diff/review evidence. The initial record must be the only changed path in a metadata-only commit whose direct parent is the recorded starting commit, before any implementation commit. Final checks locate that first commit, verify its parent/path constraint, and compare all initial facts with its committed blob before trusting the assessment. This is tamper-evident within branch history, not authenticated or tamper-proof; local files and Git history remain cooperative controls. New workspace proposals include task_tiers.tier_1_direct_merge: false. Legacy accepted configs may omit it without changing their digest; omission is interpreted as false, and enabling it requires the existing reviewed policy-change and human-acceptance workflow.

The pure API is classifyTask({stage, developer, scope, risks, userFacingUI, claimedTier, intendedFiles, actualFiles, accessibilityEvidence, reviewedCommit}). It returns {tier, reasons}. It applies a deterministic conservative matcher to changed/intended path names for conventional auth, secret, schema/migration, public API, financial, user-data, and infrastructure surfaces; a sensitive match forces Tier 3 even if caller-supplied booleans say false. Answers remain cooperative attestations: the developer must inspect the intended change and diff, and the classifier does not claim to detect all semantic risk or prevent bypass. Tier 1 requires single-file scope, exactly one actual/intended code file, every risk explicitly false, no sensitive path match, and userFacingUI false. Tier 2 requires one-subsystem scope, at most five actual files, and no high-risk/unknown answers or sensitive path match. The classifier does not decide whether configured roles have approved; the PR validator requires all applicable configured evidence. At preflight stage UI requires independent accessibility triage and plan evidence from someone other than the developer; at final stage it also requires independent final evidence on reviewedCommit. Cross-cutting, high-risk, uncertain, missing, or unbounded work is Tier 3. Explicit higher claims are preserved. A final check compares recomputed tier to the recorded tier and fails with the higher route when the diff expands.

Preflight requires an accepted config and a clean linked worktree, writes the assessment atomically under the repository's project/task-assessments directory, and reports selected tier, risk reasons, provider, every effective role setting/source, exemptions, and policy digest. Its output instructs the user to commit the initial evidence as the sole changed path in a commit directly on top of the recorded starting commit, before implementation. Tier 1 final check validates that committed baseline and actual Git diff through read-only Git operations; it exposes no merge/push/branch-delete operation. Tier 2 assessment validation is called by the existing check-pr command in CI, preserving current epic-plan validation and checking final accessibility evidence against the reviewed commit. No GitHub API or host-protection claim is added.

## File map
- scripts/lib/task-tier.mjs: pure classification and monotonic escalation rules.
- scripts/lib/workspace-config.mjs and scripts/init-workspace.mjs: validate and propose the default-off Tier 1 policy field.
- scripts/lib/task-assessment.mjs and scripts/preflight.mjs: validate/persist assessment evidence and report accepted policy provenance; require an initial evidence commit before implementation.
- scripts/check-tier1.mjs and scripts/check-tier2.mjs: final-diff Tier 1 check and Tier 2 PR evidence validation, checking immutable initial facts against their first committed assessment blob.
- scripts/check-pr.mjs and existing .github/workflows/workflow.yml: invoke Tier 2 validation without weakening epic-plan checks.
- tests/task-tier.test.mjs, tests/task-assessment.test.mjs, tests/preflight.test.mjs, tests/check-tier1.test.mjs, tests/check-tier2.test.mjs: unit and integration coverage.
- tests/workspace-config.test.mjs and tests/init-workspace.test.mjs: accepted-policy parsing, proposal, and digest coverage.
- AGENTS.md, docs/roles.md, docs/workflow.md, docs/gates.md, skills/governed-build/SKILL.md, and skills/governed-ship/SKILL.md: adopter workflow, final-PR-only code-review policy, and safe escalation instructions.

## Security mapping
- SEC-TIER-DOWNGRADE is touched by classifier rules, known-sensitive-path escalation, assessment persistence and committed baseline verification, final diff reclassification, Tier 1 policy opt-in, Tier 2 evidence validation, and agent instructions. TASK-007 preserves the final-review requirement on the final implementation revision while avoiding a per-task staff-review mandate. Tests prove malformed/unknown inputs, known sensitive paths falsely labeled low-risk, and modified initial assessment facts cannot silently reduce the tier. These remain cooperative checks and do not authenticate the author or make branch history immutable.
- Auth, data, and external-service boundaries are unaffected: these tasks read local repository/config/assessment files and Git metadata only. Assessment records contain no secrets.

## Accessibility mapping
The plan changes no user-facing interface. Tier 1 rejects UI work. For Tier 2 UI, preflight requires independent accessibility triage and plan evidence before work; the final PR check additionally requires final evidence on the reviewed commit. Missing staged evidence escalates to Tier 3. No UI implementation or WCAG visual testing is in scope.

## Small tasks
1. TASK-001 builds and tests the classifier. 2. TASK-002 adds the default-off accepted policy field. 3. TASK-003 adds accepted-config-aware preflight and durable assessment records. 4. TASK-004 adds Tier 1 final-diff checks. 5. TASK-005 validates Tier 2 PR evidence through check-pr. 6. TASK-006 updates proportional-workflow instructions and scaffold coverage. 7. TASK-007 clarifies that staff code review is final-PR-only and verifies the retained final-review gate. Each task is listed in its task document with exact files, dependencies, QA IDs, RED/GREEN commands, and a separate implementation commit; tasks execute sequentially.

## Review evidence
Staff review: correctness, readability, architecture, security, performance. Record every finding in `review_comments`. A finding is resolved only after its fix is committed and the independent code reviewer verifies it on the final `review_commit`. Mandatory AppSec final review follows.
