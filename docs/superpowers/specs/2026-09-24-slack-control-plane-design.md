# Provider-neutral Slack control plane

## Purpose

Generated projects will describe how a shared Slack control-plane service routes
work to coding tools. Codex is the first supported provider, but the Slack data
model and message rules are provider-neutral so later adapters (for example Cline
or Claude) can participate without inventing a second workflow.

The template does not deploy the service, hold Slack credentials, or persist live
session state. It provides the operating contract and a non-secret workspace
descriptor that the external service consumes.

## Channel and workspace model

One workspace channel represents one repository/environment/provider tuple and is
named:

```
#ws-<repo-name>-<provider>
```

Examples are `#ws-autowriter-codex` and `#ws-autowriter-cline`. A repository can
therefore have distinct workspace channels and histories for different providers.
Each generated repository declares its own default descriptor: repository identity,
channel name, local timezone, daily-summary time, and preferred provider. It never
contains a channel ID, credential, session ID, or other mutable operational value.

The deployed control-plane registry resolves this descriptor to Slack channel IDs,
provider/environment connection details, and policy. It rejects a message if its
workspace mapping is absent or ambiguous, asking the sender to choose rather than
guessing.

## Durable state and idempotency

The service owns these durable, external records:

| Record | Stable key | Required values |
| --- | --- | --- |
| Workspace | repository + environment + provider | channel ID, timezone, policy, provider adapter |
| Session | workspace + Slack root timestamp | provider, provider session ID, state |
| Pull request | repository + PR number | `#pull-requests` root timestamp, workspace thread timestamp(s) |
| Event delivery | Slack or GitHub delivery ID | processing outcome and timestamps |

Delivery records are written before effects are retried. A repeated Slack, GitHub,
or provider event must update or resume its existing record; it must never create a
second session root, PR root, or notice. Completed sessions remain mapped so a later
explicit mention in the same root thread resumes the existing provider session.

## Slack instruction routing

A new top-level message in a workspace channel starts work only when it explicitly
mentions the configured provider agent (initially `@Codex`). The service creates one
session record keyed by that root timestamp and sends the instruction to its provider
adapter.

A reply continues work only when it explicitly mentions that provider agent and the
root timestamp already maps to a session. The service sends it to the stored provider
session ID. Non-mentions are discussion: they are neither routed nor treated as
authorization. A provider adapter may request confirmation for irreversible actions;
Slack routing never substitutes for that confirmation.

At meaningful turn boundaries, the adapter replies in the same Slack thread with the
outcome or progress, files changed, validation result, PR URL when available, and
blockers, decisions, or a recommended next action. It posts no routine intermediate
noise. It must not open a duplicate root message for an existing session.

Every turn closes with one explicit state: `COMPLETE` when no reply is needed,
`ACTION REQUIRED` when the requester must decide, clarify, or authorize an action, or
`BLOCKED` when an external condition prevents progress. An `ACTION REQUIRED` reply
begins `ACTION REQUIRED — <@requester>` so Slack notifies the requester in the
canonical thread. It states the exact request, why safe progress cannot continue, the
recommended option and material alternatives, and the next action after a reply. The
session is stored as waiting for user input rather than complete. A `BLOCKED` reply
names the external owner and its unblock condition. The service does not send DMs or
automated reminder noise; unresolved action-required records are carried into the next
daily workspace summary with their owner.

## Pull-request synchronization

GitHub PR events are associated by repository and PR number. On the first open event,
the service creates exactly one `#pull-requests` root message:

```
PENDING <title> — <author> — <repository> — <PR link>
```

It stores that root timestamp and posts a linked summary in the originating workspace
session thread when known. If no session is known, it starts one dedicated PR thread in
the applicable `#ws-<repo>-<provider>` channel. Review comments, review summaries,
approval events, and merge/closure events are replies in those existing PR threads,
with author attribution and a link to the relevant PR, review, or comment.

The service updates only the prefix of the stored `#pull-requests` root while retaining
the rest of its original text: `PENDING`, `APPROVED`, `MERGED`, or `DISMISSED`.
Closure without merge, dismissal, and discard are all `DISMISSED`. PR state is shared
across provider channels; the `#pull-requests` message remains canonical.

## Daily summaries

At the configured morning delivery time, the scheduler evaluates each workspace's
previous calendar day in that workspace's timezone. If the workspace has meaningful
activity, it posts exactly one top-level `Daily summary — YYYY-MM-DD` message in that
workspace channel. The summary links to relevant Slack threads and PRs and covers
completed and unfinished work, PR state changes, validation results and failures,
blockers/decisions, and owner-tagged next steps. It posts nothing for an inactive day
and does not repeat turn-level detail. An unresolved `ACTION REQUIRED` item is
included even when no other work occurred during the day, because it requires a named
owner's response.

## Safety and boundaries

The service may post only in a mapped workspace channel, its session/PR threads, and
`#pull-requests`. It enforces explicit mentions for instruction routing, validates
event signatures, applies least-privilege Slack/GitHub scopes, and keeps credentials
and mutable records out of Git. The provider adapter is the sole component that turns
an accepted instruction into tool work; it records failures in the session thread as a
meaningful milestone and leaves the thread open for future continuation.

## Validation strategy

The future implementation must cover routing and safety with deterministic tests:

- explicit-mention start/continuation versus ignored discussion;
- missing or ambiguous workspace routing;
- retry/idempotency for Slack messages and GitHub deliveries;
- canonical PR creation, prefix-only status edits, linked workspace notices, and
  attributed replies;
- local-timezone daily summary scheduling, inactivity suppression, and single-post
  behavior; and
- posting allow-lists plus explicit-confirmation handling for irreversible actions.

An integration test should exercise Slack event intake through provider adapter output
and GitHub PR events against a durable test store. Provider conformance tests should
verify that Codex and later adapters emit the same turn-update contract.

## Rollout and compatibility

The first generated-project guide enables the Codex adapter only. This is the required
post-implementation capability matrix:

| Functionality | Codex | Cline | Claude |
| --- | --- | --- | --- |
| Workspace-channel session start and continuation | Enabled | Disabled | Disabled |
| Threaded turn summaries and decision/failure milestones | Enabled | Disabled | Disabled |
| Pull-request workspace-thread linkage | Enabled | Disabled | Disabled |
| Canonical `#pull-requests` synchronization | Enabled | Disabled | Disabled |
| Daily workspace summaries | Enabled | Disabled | Disabled |
| Provider conformance contract | Enabled | Defined, not enabled | Defined, not enabled |

Shared workflow governance in `AGENTS.md`, `CLAUDE.md`, and `.clinerules` remains
tool-neutral and is not changed by this work. A later provider is enabled only after
its adapter passes the conformance contract and has an intentionally registered
`ws-<repo>-<provider>` workspace mapping; it does not require a new Slack
control-plane protocol.
