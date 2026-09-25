import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseWorkspaceConfig,
  resolveWorkspaceConfig,
  workspaceConfigDigest,
} from '../scripts/lib/workspace-config.mjs';

const sample=`workspace:
  repository: example-repository
  environment: production
  provider: codex
  slack_channel_name: ws-example-repository-codex
  timezone: America/New_York
approvals_required:
  principal: true
  qa: true
  appsec: true
  accessibility_reviewer: false
  ui_designer: false
approvals_overrides:
  reason: No user interface in this project
  exempt: [accessibility_reviewer, ui_designer]
daily_summary:
  local_time: "09:00"
`;

test('parses non-secret config and hashes equivalent YAML identically',()=>{
  const parsed=parseWorkspaceConfig(sample,{partial:false});
  assert.equal(parsed.workspace.slack_channel_name,'ws-example-repository-codex');
  assert.deepEqual(parsed.approvals_overrides.exempt,['accessibility_reviewer','ui_designer']);
  assert.match(workspaceConfigDigest(parsed),/^[a-f0-9]{64}$/);
  const commented=parseWorkspaceConfig(sample.replace('provider: codex','provider: codex # adapter'));
  assert.equal(workspaceConfigDigest(parsed),workspaceConfigDigest(commented));
});

test('rejects malformed YAML, roles, exemptions, and secret-shaped fields',()=>{
  assert.throws(()=>parseWorkspaceConfig(`${sample}workspace: {}\n`));
  const aliased=sample.replace('repository: example-repository','repository: &repo example-repository').replace('reason: No user interface in this project','reason: *repo');
  assert.throws(()=>parseWorkspaceConfig(aliased),/Alias resolution is disabled/);
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  qa: true','  qa: "true"')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  qa: true','  qa: true\n  reviewer: true')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  reason: No user interface in this project\n','')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  ui_designer: false','  ui_designer: true')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  timezone: America/New_York','  timezone: America/New_York\n  channel_id: C123')));
  assert.throws(()=>parseWorkspaceConfig(`${sample}token: secret\n`));
});

test('root resolver reports provenance and refuses missing or escaping config',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-root-'));
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-outside-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'config'));
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root}));
  const file=path.join(root,'config/workspace-config.yaml');
  fs.writeFileSync(file,sample);
  const result=resolveWorkspaceConfig({coordinationRoot:root});
  assert.equal(result.config.workspace.provider,'codex');
  assert.equal(result.sources['workspace.provider'],'root');
  assert.equal(result.sources['approvals_required.qa'],'root');
  fs.unlinkSync(file);
  const escaped=path.join(outside,'workspace-config.yaml');
  fs.writeFileSync(escaped,sample);
  fs.symlinkSync(escaped,file);
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root}));
});
