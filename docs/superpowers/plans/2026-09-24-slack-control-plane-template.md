# Provider-neutral Slack Control-plane Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every generated project a non-secret, Codex-enabled workspace descriptor and a provider-neutral Slack control-plane operating guide.

**Architecture:** The repository exposes declarative configuration and human-readable integration guidance only. A deployed external control plane resolves live channel IDs, credentials, provider session IDs, and delivery records; Codex is the only enabled provider in the initial template while later providers share the same contract.

**Tech Stack:** Markdown, YAML 2.9.0, Node.js 22 `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-24-slack-control-plane-design.md`

## Global Constraints

- Do not add Slack, GitHub, or provider credentials, channel IDs, thread timestamps, or session IDs to Git.
- Use `#ws-<repo-name>-<provider>` as the workspace-channel naming rule; the example's value omits only the Slack `#` sigil.
- Enable every documented control-plane capability for Codex only; Cline and Claude remain disabled.
- Leave shared agent behavior in `AGENTS.md`, `CLAUDE.md`, and `.clinerules` unchanged.
- Treat prose as human documentation: test configuration behavior and scaffold inclusion, not markdown source text.
- Preserve the pre-existing, user-owned README modification.

---

## File structure

- `config/slack-workspace.example.yml` — a non-secret descriptor for one repository/environment/provider workspace.
- `docs/slack-control-plane.md` — operator-facing routing, durable-state, turn-update, PR, daily-summary, safety, and provider-rollout contract.
- `docs/workflow.md` — one optional-integration link to the operator guide; it must not impose Slack behavior on Cline or Claude.
- `tests/slack-workspace-template.test.mjs` — executable validation of the example descriptor's observable configuration contract.
- `tests/scaffold.test.mjs` — verifies isolated epic worktrees retain the generated descriptor.
- `docs/verification.md` — explains the new automated coverage and its boundary.

## Task 1: Add the single-workspace descriptor and operator guide

**Files:**

- Create: `tests/slack-workspace-template.test.mjs`
- Create: `config/slack-workspace.example.yml`
- Create: `docs/slack-control-plane.md`
- Modify: `docs/workflow.md`

**Interfaces:**

- Consumes: YAML parser exposed by `yaml` 2.9.0 and the provider-neutral rules in the approved spec.
- Produces: one parseable descriptor with `workspace.repository`, `workspace.environment`, `workspace.provider`, `workspace.channel_name`, `workspace.timezone`, and `daily_summary.local_time`; one operator guide linked from the workflow.

- [ ] **Step 1: Write the failing descriptor contract test**

Create `tests/slack-workspace-template.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const source=path.resolve(import.meta.dirname,'..');
const descriptor=path.join(source,'config','slack-workspace.example.yml');

test('workspace descriptor enables the Codex workspace without mutable Slack state',()=>{
 const value=YAML.parse(fs.readFileSync(descriptor,'utf8'));
 assert.deepEqual(value.workspace,{
  repository:'example-repository', environment:'production', provider:'codex',
  channel_name:'ws-example-repository-codex', timezone:'America/New_York'
 });
 assert.deepEqual(value.daily_summary,{local_time:'09:00'});
 assert.equal(Object.hasOwn(value.workspace,'channel_id'),false);
 assert.equal(Object.hasOwn(value.workspace,'session_id'),false);
 assert.equal(Object.hasOwn(value.workspace,'credential'),false);
});
```

The production change this catches is an invalid descriptor, a channel name that no
longer derives from repository/provider, a non-Codex initial route, or accidental
live Slack state in the committed configuration.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/slack-workspace-template.test.mjs`

Expected: FAIL with `ENOENT` because `config/slack-workspace.example.yml` does not
exist yet.

- [ ] **Step 3: Add the minimal descriptor**

Create `config/slack-workspace.example.yml`:

```yaml
workspace:
  repository: example-repository
  environment: production
  provider: codex
  channel_name: ws-example-repository-codex
  timezone: America/New_York
daily_summary:
  local_time: "09:00"
```

- [ ] **Step 4: Add the operator guide and optional workflow link**

Create `docs/slack-control-plane.md` with sections for scope/activation, the workspace
descriptor, session routing, durable records, turn updates, PR synchronization, daily
summaries, safety, and the provider capability matrix. The guide must require explicit
provider mentions, durable idempotency records, attributed PR replies, prefix-only PR
root edits, posting allow-lists, and external state. It must reproduce the approved
matrix with Codex enabled and Cline/Claude disabled. Its turn-update section must
define `COMPLETE`, `ACTION REQUIRED`, and `BLOCKED`; require an `ACTION REQUIRED —
<@requester>` thread reply containing the decision/authorization, safety rationale,
recommended option, material alternatives, and post-reply action; and retain the
session as waiting for user input. Its daily-summary section must carry unresolved
action-required items with their owner, without direct messages or reminder spam.

In `docs/workflow.md`, add a short **Optional external Slack control plane** paragraph
that links to this guide and states that it does not change local agent instructions.

- [ ] **Step 5: Run GREEN verification**

Run `node --test tests/slack-workspace-template.test.mjs` and `git diff --check`.
Expected: the descriptor test passes and the diff has no whitespace errors.

- [ ] **Step 6: Commit the task**

Run `git add config/slack-workspace.example.yml docs/slack-control-plane.md docs/workflow.md tests/slack-workspace-template.test.mjs` followed by `git commit -m "feat: add Slack control-plane template"`.

## Task 2: Preserve the descriptor in scaffolded epic worktrees

**Files:**

- Modify: `tests/scaffold.test.mjs`
- Modify: `docs/verification.md`

**Interfaces:**

- Consumes: the descriptor from Task 1 and `scripts/new-epic.sh` worktree creation.
- Produces: a regression test proving the isolated scaffold used for governance tests retains the descriptor, plus user-facing verification guidance.

- [ ] **Step 1: Write the failing scaffold assertion**

Add `assert.ok(fs.existsSync(path.join(worktree,'config','slack-workspace.example.yml')));`
immediately after the existing `TASK-001.md` assertion in the scaffold test. The
production change this catches is a generated or isolated worktree that omits the
workspace descriptor even though the source template declares it.

- [ ] **Step 2: Run the focused test and verify RED**

Run `node --test tests/scaffold.test.mjs`. Expected: FAIL because the fixture copy list
does not yet include `config`.

- [ ] **Step 3: Preserve configuration in the fixture**

Change the fixture copy list from `['scripts','project','epics','tests','package.json','package-lock.json','.gitignore']` to `['scripts','project','epics','tests','config','package.json','package-lock.json','.gitignore']`.

Update `docs/verification.md` to say that the scaffold test also verifies the
non-secret Slack workspace descriptor reaches an isolated epic worktree. State that
this is template/configuration coverage, not evidence of a live Slack integration.

- [ ] **Step 4: Run GREEN and regression verification**

Run `node --test tests/scaffold.test.mjs`, `npm test`, and `git diff --check`.
Expected: the focused scaffold test and all repository tests pass; the diff has no
whitespace errors.

- [ ] **Step 5: Commit the task**

Run `git add tests/scaffold.test.mjs docs/verification.md` followed by `git commit -m "test: retain Slack workspace descriptor in scaffolds"`.

## Review checkpoint

- [ ] Confirm implementation keeps live Slack/GitHub/provider state external.
- [ ] Confirm `AGENTS.md`, `CLAUDE.md`, and `.clinerules` are unchanged.
- [ ] Confirm the Codex-only capability matrix is present in the operator guide.
- [ ] Run `npm test` and `git diff --check` after both commits.
- [ ] Submit the resulting implementation for independent code review and mandatory AppSec review through the repository gates before opening a PR.

## Dependency order

Task 1 must finish before Task 2 because the scaffold test needs the descriptor as a
source asset. The tasks are intentionally serial: both touch the repository's template
contract and test surface.

## Plan self-review

- Spec coverage: Task 1 covers routing, durable state, turn updates, PR synchronization, daily summaries, safety, and the provider matrix in the guide; Task 2 protects descriptor availability in generated worktrees.
- User-action coverage: Task 1 documents direct requester notification, explicit terminal states, pending-input session state, and daily-summary follow-up.
- Test quality: tests parse/validate the descriptor and execute scaffold behavior; they do not assert prose source text.
- Boundary check: the plan adds no credentials, service endpoint, webhooks, or provider runtime, so it cannot falsely claim a deployed Slack integration.
