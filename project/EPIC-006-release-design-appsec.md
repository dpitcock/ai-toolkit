# EPIC-006 independent AppSec release-design review

Reviewer: Codex AppSec `/root/appsec_release_design`, independently assigned
session, 2026-09-26. Canonical plan revision: 1. Detailed plan revision: 2.
Review target: `project/EPIC-006-release-continuation-design.md`, initially
committed at `d128260d5c322581c62f03ed4cb10c768bed431e`, with the independently
reviewed Principal clarification at
`05a8dd8bea5b4f75b3d44c856089a61ad85de829`.

Verdict: **APPROVE THE BOUNDED DESIGN** at the clarified revision above, subject
to the exact implementation conditions below and all restrictions in that
design. No unresolved blocking design findings remain. No implementation
approval is given. Implementers may proceed with the authorized repair; any
broader exception or inability to satisfy these conditions requires renewed
design review, not a weakened predicate.

This review addresses the design response to CR-006-001 and CR-006-004. It does
not close those implementation findings, approve CR-006-002/003, provide final
AppSec approval, authorize a PR, accept policy, authorize coordination-root
writes, or establish host protection or session activation. No canonical
approval, source, policy, task, or status field was changed by this reviewer.

## Review basis and verified facts

Read AGENTS.md, roles/workflow/gates guidance, local appsec-gate, the upstream
security-auditor persona, security-and-hardening and security checklist, the
canonical epic/plan, detailed plan contracts, original Staff report, immutable
assessment, candidate policy and Principal design. Inspected the current
assessment/final-check, config/history, initializer, runtime state/authorization,
PR/host gate, finalization, integration and completion interfaces. Concurrent
CR-006-002/003 work was treated only as an interface dependency.

Read-only Git and parser checks independently confirmed:

- B `553daf9fb49df58e55c3c5a6fbb68df6a0be0a41` contains neither policy path.
- P `74c7c7f66924f43319e1850ad6728708a5adc96b` changes only those two paths;
  accepted root revision 1 has digest
  `a9008f1f352e53a0d39bf66a8b1376d09914ff0523da25b6dbbc45f34643cf5a`.
- S `a91beb92f858c4be00e09f23de39de3ccee3c17f` adds only the empty override
  marker to policy and appends one revision-2 history record. Raw digest is
  `d58b8020bf9db0f73ab1ddcbe8867106132d3a713491c906a6711373a6eab7ab`.
- A `2a51c8fe0a35ebe224840d702ef5ae30f271407e` is a direct child of S and
  adds only `project/task-assessments/governance-activation.yaml`. Its recorded
  raw/root/effective provenance agrees with these snapshots.
- Neither policy path changed after S through the initial design revision.
  Candidate normalized digest recomputes as
  `7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd`.

These are historical consistency checks, not authentication of the handwritten
acceptor. Actual owner/session authority and live host reviews remain distinct.
The proposed CR-006-001/004 implementation does not yet exist. No executable
success of that future route or new release dependency audit is claimed.

## Threat model and implementation conditions

Assets are accepted root authority, immutable preflight evidence, independent
review identity, PR/main integrity and truthful epic completion. Attacker inputs
include candidate-controlled files/history, caller JSON, stale runtime records,
host event payloads and sibling worktree selection. The model is cooperative
local governance backed by authenticated harness and host observations, not
protection against an attacker who already controls all local Git/runtime files.

1. **SEC-GOV-001, tampering/elevation:** The bootstrap exception must require
   the complete approved B/P/S/A lineage and every Principal predicate. Base
   absence alone or matching schema cannot establish acceptance. Bind original
   assessment identity/content and plan/task/branch; reject partial policy,
   forged/truncated history, nonempty markers, later edits including reverts,
   ambiguous ancestry and unavailable objects. Other intended paths keep their
   original before-preflight checks. No user-supplied switch bypasses a failure.
2. **SEC-GOV-001/003, policy substitution:** A canonical mirror requires exact
   config bytes and full ledger bytes from the actual Git-common coordination
   root, with valid current acceptance/definition at both ends. Matching a
   digest or arbitrary sibling is insufficient. Registration and existing
   safe regular-file checks remain mandatory. Nonidentical linked policy keeps
   explicit override requirements; no tier or role weakening is introduced.
3. **SEC-GOV-002/003/005, spoofing/elevation:** The adoption candidate cannot
   select its own evaluator, owner authority, role map or review floor. Trusted
   integrated F code and independently proven old root authority govern the
   exact preapproved migration. H1 changes only the two permitted regular
   policy paths, preserves the ledger prefix and appends exactly one next
   revision with the derived changed fields. Check intermediate commits too.
4. **SEC-GOV-002/004, replay/races:** Separate local Staff then AppSec reviews
   bind H1. Any new head invalidates both. Original PR0 receipts never approve
   PR1. Live native host reviews and trusted workflow checks bind current PR1
   head under old authority, with main/head rechecks before merge. Unavailable,
   pending, dismissed, wrong-head or wrong-actor evidence fails closed.
5. **SEC-GOV-004/005, repudiation/authority confusion:** The bounded release
   record remains under the existing Git-common lock, schema validation and
   atomic replacement. Caller IDs refer to actual observed owner/reviewer
   authority; they cannot create it. Missing/corrupt state needs recovery and
   reacquisition of unprovable authority/reviews. Records hold references and
   evidence, never credentials. Pre-activation staging grants no routine event
   permission and adds no general workflow-event policy escape.
6. **SEC-GOV-006, false completion:** Keep original PR0/H0/M permanently. Prove
   M-to-F status-only finalization separately from F-to-I adoption and validate
   both submitted H1 and integrated I snapshots, including squash/rebase cases.
   Reconstruct both host links, reject direct pushes, second adoption, unrelated
   main advancement and open corrective PRs. Checks, smoke, docs, loaded adapter,
   effective policy, real activation and owned cleanup must describe I. Fresh
   admission observation remains required before EPIC-007.

STRIDE also covers denial of service through malformed/missing state and host
failure: stopping is the intended safe outcome, never permission to fall back
to broader scope. Information disclosure is limited by retaining existing
credential handling and storing no secrets in receipts. Web session/CORS,
database tenancy, uploads and new PII categories are outside this design.

## Design findings resolved before approval

**ASD-006-001 — Separate CI proof from local and host authorization.** The
initial design refers to both a Git-common local release record and fresh CI
entrypoints. CI cannot possess or authenticate that local record. Requiring its
own unfinished `gates` check would also make the first PR1 check circular.
Requested separate committed-provenance CI validation, mandatory prepublication
local owner/Staff/AppSec gate, and trusted live host merge gate. Do not export
fabricated local receipts to Git or treat CI success as prepublication consent.

Resolved in `05a8dd8`: the new validation-boundaries section makes CI structural
and historical only, with no runtime or PR1-status/review dependency. The local
prepublication gate requires out-of-band authenticated controller context and
actual owner/independent H1 review evidence; a standalone call or missing state
fails. The trusted hosted merge gate separately requires live H1 reviews/checks
under old authority and rechecks F/H1. Missing local evidence still blocks local
publication and completion. Required tests now exercise all three separately.

**ASD-006-002 — Explicitly confine bootstrap recognition.** The initial text's
historical predicates are sound but must be attached to this approved EPIC-006
assessment/lineage. Another epic or freshly written shape-compatible assessment
must not acquire a general exception for policy created before preflight.

Resolved in `05a8dd8`: production recognition is pinned to `dpitcock/ai-toolkit`,
`epic/EPIC-006`, canonical plan revision 1, exact B/P/S/A, assessment path and
initial blob `d4c633fc8387df67422861cb87508fa7c2af75b4`. I independently checked
that blob against A. The design forbids caller-selectable identity overrides
and requires the full historical predicates even after identity matches.
Tests must reject other histories and may preserve actual objects in clones.

These are resolved design ambiguities, not claims about fixed implementation.
No broader product decision or canonical plan revision change is required for
this approved correction. All SEC-GOV-001 through SEC-GOV-006 remain touched.

## Required verification and retained release gates

Implementation evidence must cover every failed bootstrap predicate, exact-byte
mirror rejection, candidate/history/path tampering, all review/authority and
head races, unchanged ordinary policy/finalization rejection, restart/recovery,
and completion/admission freshness. Run the actual original-PR entrypoint in a
fresh single checkout against real B and the corrected candidate. The generated
lifecycle must exercise bootstrap, original PR, marker PR, adoption PR, canonical
mirror, real entrypoint activation evidence and completion in that order. Its
observations are test evidence only; they cannot establish live activation.

After implementation and full QA, obtain independent final Staff then AppSec on
the same corrected implementation revision. Repeat separate actual local and
host reviews for adoption H1 at release. Explicit owner authority for the
concrete root update, installed host protections, live integrated verification,
actual-session activation and safe cleanup remain release responsibilities.
