---
kind: task
id: TASK-001
owner: "Codex"
status: done
revision: 1
parent: ../epic-plan.md
parent_revision: 1
depends_on: [ tasks/TASK-000.md ]
evidence:
  red: "node --test tests/tier-defaults.test.mjs: failed with ERR_MODULE_NOT_FOUND
    for scripts/lib/tier-defaults.mjs before the resolver existed."
  green: "node --test tests/tier-defaults.test.mjs: 6 passed, 0 failed."
  qa: "QA-GOV-001/002: every selected tier preserves its floor; unknown tier,
    override key, and type fail closed; Tier 2/3 and template direct merge
    remain disabled; versioned definition provenance changes when its definition
    changes."
  commit: "943e16c"
approvals:
  principal_engineer: null
  appsec: null
  qa_lead: null
  code_review: null
  appsec_review: null
  accessibility: null
  accessibility_review: null
---

# TASK-001: Shared tier definitions

## Acceptance, interfaces, and verification

Files: create `policy/task-tier-defaults.yaml`,
`scripts/lib/tier-defaults.mjs`, `tests/tier-defaults.test.mjs`.
Interface: `resolveTierDefaults({tier,overrides,templateRepository})` returns
validated effective rules plus definition version/digest and field sources.
Only `direct_merge` is initially overridable. Default direct merge stays false
for compatibility; eligible adopters may explicitly request true only at Tier 1.
Tier 2/3 require PRs; Tier 3 requires isolation and independent final review.
RED/GREEN: `node --test tests/tier-defaults.test.mjs`.
Assertions: unknown tier/key/type fails; stricter floors cannot be relaxed;
definition changes change the digest; false applies to every selected tier.

## TDD and QA handoff

- [ ] Run the named regression and record actual RED evidence.
- [ ] Implement this contract and run the focused GREEN command.
- [ ] Verify mapped QA-GOV requirements from project/EPIC-006-QA.md.
- [ ] Commit this task separately; record SHA and actual evidence above.

Use the approved common/security contracts in
`project/EPIC-006-implementation-plan.md`. Do not change other task scope.
