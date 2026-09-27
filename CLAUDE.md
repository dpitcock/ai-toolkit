@AGENTS.md

Follow AGENTS.md as canonical workflow instructions. For Superpowers install `/plugin install superpowers@claude-plugins-official`. Run `bash scripts/install-skills.sh` for local governance and agent-skills. See docs/installation.md.

Follow the authoritative [File reading](AGENTS.md#file-reading) and [File writing](AGENTS.md#file-writing) policies in root AGENTS.md.

Follow root AGENTS.md's [Context budget checkpoint](AGENTS.md#context-budget-checkpoint) policy before continuing work when a checkpoint is needed.

At an agent-dispatch boundary, have the authenticated embedding harness import
`runWorkflowEvent` from `scripts/workflow-event.mjs` and call
`runWorkflowEvent([EVENT, '--root', PATH], {actor, observers})` in a fresh task
session, with bounded event JSON on stdin. The standalone CLI fails closed;
it cannot obtain identity from environment variables or event fields.
Supply the harness-observed actor out-of-band, synchronous observer callbacks
as documented in `docs/workflow.md`, and an
event that references existing authority; never treat caller fields, Slack
messages, or a prefix as approval/identity credentials. The entrypoint must
resolve accepted policy, canonical repository, branch, and scope itself.
Stop on a rejected decision or exception. An `authenticated` flag and stored
JSON are cooperative evidence; the harness must establish the actual session.

Tests and pushes never start reviews. Dispatch only an explicit current-head
`review.ready` event. Agent Alert is for authorized agent messaging;
gh-identity's stdio MCP submits completed independent verdicts and the host
review must then be checked against the reviewed head. Preserve native host
protections, required checks, tool limits, and PR-only merge behavior. Do not
store Slack credentials or session state in this repository.
