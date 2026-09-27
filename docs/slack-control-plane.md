# Slack control plane

This optional integration lets a shared Slack service route work to configured coding
tools. This template supplies the contract and a generated, non-secret workspace
configuration; it does not deploy a Slack app, accept events, or store
credentials/state. Codex is the only enabled provider in this version.

## Workspace configuration

Run `bash scripts/init-project.sh` to generate a pending
`config/workspace-config.yaml`, then review and explicitly accept its digest before
using it for routing. Copy the accepted configuration into the external control-plane
deployment and replace proposal values only through the documented acceptance flow.
Local files record supplied identity and rationale; they do not authenticate a person.
One workspace is one repository, environment, and provider tuple. Its Slack channel is
named `#ws-<repo-name>-<provider>`; the YAML value omits only Slack's `#` sigil.

| Field | Purpose |
| --- | --- |
| `workspace.repository` | Repository identity used for routing and PR association. |
| `workspace.environment` | Deployment/workspace environment name. |
| `workspace.provider` | Active tool adapter; initially `codex`. |
| `workspace.slack_channel_name` | Provider-qualified workspace channel name. |
| `workspace.timezone` | IANA timezone for activity and daily summaries. |
| `daily_summary.local_time` | Morning delivery time in the workspace timezone. |

Keep Slack channel IDs, signing secrets, OAuth tokens, thread timestamps, provider
session IDs, and event-delivery records outside Git. The service registry resolves the
descriptor to those live values and asks the sender to choose a workspace when a mapping
is missing or ambiguous.

Later policy changes require a reviewed candidate and an explicit acceptance record:
`propose-change` is read-only, while `apply-change` requires the reviewed digest,
reviewer identity, and reason. This does not deploy Slack or grant external authority.

## Session routing and state

Only a new top-level message explicitly mentioning `@Codex` in a mapped Codex workspace
channel starts a session. Store the root-thread timestamp with the Codex session ID. A
reply in that thread continues the same session only when it explicitly mentions
`@Codex`; non-mentions are discussion and do not authorize work.

Completed sessions remain mapped, so a future mentioned reply continues that session.
The service persists these idempotent external records:

| Record | Key |
| --- | --- |
| Workspace | repository + environment + provider |
| Session | workspace + Slack root timestamp |
| Pull request | repository + PR number |
| Delivery | Slack/GitHub provider delivery ID |

Retries must reuse these records and never create a duplicate session root, PR root, or
notification.

## Turn updates and action requests

Post meaningful milestones only, always as replies in the session's original thread.
Each turn summary includes outcome or progress, files changed, validation result, PR
link when available, and blockers, decisions, or the recommended next action. Do not
post routine intermediate noise or a second root message.

Every turn ends in exactly one state:

| State | Meaning |
| --- | --- |
| `COMPLETE` | No user reply is needed. |
| `ACTION REQUIRED` | The requester must decide, clarify, or explicitly authorize an action. |
| `BLOCKED` | An external condition prevents progress. |

An action-required update begins `ACTION REQUIRED — <@requester>` to notify the
requester in the canonical thread. It states the exact request, why safe progress cannot
continue, the recommended option and material alternatives, and the action Codex will
take after a reply. Mark its session as waiting for user input rather than complete.
A blocked update names the external owner and unblock condition. Do not send DMs or
reminder spam; unresolved action-required records appear in the next daily summary with
their owner.

## Pull-request synchronization

On the first PR-open event, create exactly one root message in `#pull-requests`:

```
PENDING <title> — <author> — <repository> — <PR link>
```

Store its timestamp as the canonical PR mapping. Post a linked summary in the
originating workspace session thread, or create one dedicated PR thread in the matching
workspace channel if there is no session. Post review comments, review summaries,
approvals, merges, and closures as attributed replies with available source links in the
existing PR threads.

Update only the stored root prefix, preserving its remaining text:

| Event/state | Prefix |
| --- | --- |
| Awaiting approval | `PENDING` |
| Approved | `APPROVED` |
| Merged | `MERGED` |
| Closed without merge, dismissed, or discarded | `DISMISSED` |

Do not create duplicate PR roots. A PR is shared across provider workspace channels,
but `#pull-requests` remains canonical.

## Daily summaries

At `daily_summary.local_time`, evaluate the previous calendar day in the workspace's
local timezone. If meaningful activity occurred, post one top-level message titled
`Daily summary — YYYY-MM-DD` in that workspace channel. Include completed/unfinished
work, PR changes, validation/failures, blockers/decisions, owner-tagged next actions,
and links to relevant threads/PRs. Do not post for inactivity unless an unresolved
action-required item needs its owner's response.

## Safety

The service may post only in mapped workspace channels, their session/PR threads, and
`#pull-requests`. Verify Slack and GitHub event signatures, use least-privilege scopes,
validate workspace mappings, and treat all event content as untrusted. Slack routing
does not authorize irreversible external actions: require explicit authorization at the
provider boundary.

## Provider capability matrix

| Functionality | Codex | Cline | Claude |
| --- | --- | --- | --- |
| Workspace-channel session start and continuation | Enabled | Disabled | Disabled |
| Threaded turn summaries and action-required updates | Enabled | Disabled | Disabled |
| Pull-request workspace-thread linkage | Enabled | Disabled | Disabled |
| Canonical `#pull-requests` synchronization | Enabled | Disabled | Disabled |
| Daily workspace summaries | Enabled | Disabled | Disabled |
| Provider conformance contract | Enabled | Defined, not enabled | Defined, not enabled |

Enable another provider only after its adapter passes the common routing and update
contract and has an intentionally registered `#ws-<repo>-<provider>` mapping.
