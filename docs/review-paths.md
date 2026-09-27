# Reviewing this toolkit's own changes

The toolkit's everyday development defaults to Code Reviewer only, equivalent
to dev-environment work. Tests, helpers, fixtures, development records, ordinary
docs and internal tooling are authoring infrastructure. Relevant tests and
PR-only delivery still apply. No QA, AppSec, accessibility or UI-design review
is required solely because such work models a production system.

`policy/review-paths.json` is the CODEOWNERS-equivalent path map, consumed by the
local route command and trusted host-review gate. It applies only to
`dpitcock/ai-toolkit`; it does not change an adopter's environment policy.
CODEOWNERS alone cannot require approval from every owner on a matching line.

| Paths | Review |
| --- | --- |
| All paths not listed as production, including `tests/**`, ordinary docs and new internal scripts | Code Reviewer |
| `templates/`, literal `epics/EPIC-XXX/`, `project/project-plan.md.template` | Production |
| `policy/`, workspace config and acceptance history | Production |
| `AGENTS.md`, `CLAUDE.md`, `.clinerules/`, shipped `skills/`, skill lockfile | Production |
| `docs/gates.md`, `docs/roles.md`, `docs/workflow.md`, `docs/installation.md` | Production |
| Explicit bootstrap, adoption and enforcement scripts and their listed library files | Production |
| `.github/workflows/`, `.github/actions/`, actual `action.yml`/`action.yaml` definitions outside test fixtures, CODEOWNERS files | Production |
| `package.json`, `package-lock.json` | Production |

The manifest enumerates script files individually; `scripts/**` is not a
production wildcard. Add newly shipped entrypoints and dependencies to the
manifest in the same PR that introduces their use. `tests/**` contains only
authoring infrastructure, never a shipped runtime dependency. Actual deployment
or adoption of a test helper requires moving it into the shipped boundary.

Production requires Code Reviewer + QA + AppSec, plus applicable configured
Principal, accessibility and UI-design roles. Actions remain SHA-pinned.
Mixed changes inherit production requirements. Deletions and both rename
endpoints count. Existing PRs through `grandfatheredThroughPr` retain their
previous review requirements, including reopened PRs. No review is dismissed
or retroactively waived by this change; PR #12's pinning fix remains intact.

## Local use

Refresh the trusted base, then classify planned files before choosing a workflow:

```sh
git fetch origin main
node scripts/review-route.mjs --base origin/main --files tests/gates.test.mjs
node scripts/review-route.mjs --base origin/main --head HEAD
node scripts/review-route.mjs --base origin/main --head HEAD --pr 99
```

An `authoring` result uses independent Code Reviewer, relevant tests and an
isolated PR branch, without the epic/production approval chain. `production`
uses existing governed stages. `legacy` preserves prior routing, including
pre-adoption bases, grandfathered PRs and adopter repositories. A classification
is not an approval or permission to merge. Reclassify the complete diff before
requesting the final review. Empty/malformed diffs and malformed trusted policy
fail closed. Candidate manifest changes are evaluated using the base manifest.

## Host enforcement and rollout

The existing trusted `review-gates.yml` publisher reads the manifest from the
API-resolved PR base SHA and enumerates all pages of changed files. It verifies
file counts, rename evidence, stable head/base, current-head checks and mapped
reviewers. The candidate never supplies the authoritative path list or policy.
The candidate `check-pr.mjs` uses the same authoring classification before
generic epic gates; the trusted publisher independently enforces final roles.

Keep `GOVERNANCE_REQUIRED_REVIEW_ROLES` as the applicable production role list;
authoring routing always selects only `code_reviewer`. The manifest imposes QA
and AppSec floors for new production PRs even when the variable omits them.
`GOVERNANCE_REVIEW_IDENTITIES` must map every applicable role to verified human
or bot actors using the existing identity/provenance schema. Missing mappings,
stale approvals, dismissals or requests for changes block the required role.
Changing role mappings requires owner-managed host configuration, not PR data.

Before publication, refresh the existing-PR inventory and preserve its cutoff.
The policy change itself requires production review under the prior trusted
policy. Integrate through a reviewed PR; then verify actual publisher results
and configure protected `main` to require `gates`, `host-review-gate`, independent
host review and no direct pushes. Verify those settings using authenticated
host reads. A committed manifest alone does not activate host enforcement.
Do not execute candidate code with write credentials or bypass existing workflow
provenance checks to bootstrap this policy.
