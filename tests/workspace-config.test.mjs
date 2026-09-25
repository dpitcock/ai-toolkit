import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
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

function linkedWorktrees(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-git-root-'));
  const linked=path.join(os.tmpdir(),`workspace-config-linked-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['config','user.email','qa@example.test'],{cwd:root});
  execFileSync('git',['config','user.name','QA'],{cwd:root});
  fs.writeFileSync(path.join(root,'README.md'),'fixture\n');
  execFileSync('git',['add','README.md'],{cwd:root});
  execFileSync('git',['commit','-qm','fixture'],{cwd:root});
  execFileSync('git',['worktree','add','-q','-b','linked-policy',linked],{cwd:root});
  return {root,linked};
}

function writeConfig(root,value) {
  fs.mkdirSync(path.join(root,'config'),{recursive:true});
  fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(value));
}

test('parses non-secret config and hashes equivalent YAML identically',()=>{
  const parsed=parseWorkspaceConfig(sample,{partial:false});
  assert.equal(parsed.workspace.slack_channel_name,'ws-example-repository-codex');
  assert.deepEqual(parsed.approvals_overrides.exempt,['accessibility_reviewer','ui_designer']);
  assert.match(workspaceConfigDigest(parsed),/^[a-f0-9]{64}$/);
  const commented=parseWorkspaceConfig(sample.replace('provider: codex','provider: codex # adapter'));
  assert.equal(workspaceConfigDigest(parsed),workspaceConfigDigest(commented));
});

test('an empty exemption list remains valid after normalization and hashing',()=>{
  const uiConfig=sample.replace('  reason: No user interface in this project\n  exempt: [accessibility_reviewer, ui_designer]',
    '  exempt: []').replace('  accessibility_reviewer: false','  accessibility_reviewer: true').replace('  ui_designer: false','  ui_designer: true');
  const parsed=parseWorkspaceConfig(uiConfig);
  assert.deepEqual(parsed.approvals_overrides,{reason:'',exempt:[]});
  assert.match(workspaceConfigDigest(parsed),/^[a-f0-9]{64}$/);
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

test('linked worktree applies only explicit provider, role, and exemption overrides',t=>{
  const {root,linked}=linkedWorktrees(t);
  const rootConfig=parseWorkspaceConfig(sample);
  const worktreeConfig={
    ...rootConfig,
    workspace:{...rootConfig.workspace,provider:'claude'},
    approvals_required:{...rootConfig.approvals_required,qa:false},
    approvals_overrides:{reason:'Linked worktree has no UI',exempt:['accessibility_reviewer','ui_designer']},
    worktree_overrides:['workspace.provider','approvals_required.qa','approvals_overrides'],
  };
  writeConfig(root,rootConfig);
  writeConfig(linked,worktreeConfig);
  const result=resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked});
  assert.equal(result.config.workspace.provider,'claude');
  assert.equal(result.config.workspace.repository,'example-repository');
  assert.equal(result.config.approvals_required.qa,false);
  assert.equal(result.config.approvals_required.appsec,true);
  assert.deepEqual(result.config.approvals_overrides,worktreeConfig.approvals_overrides);
  assert.equal(result.sources['workspace.provider'],'worktree');
  assert.equal(result.sources['workspace.repository'],'root');
  assert.equal(result.sources['approvals_required.qa'],'worktree');
  assert.equal(result.sources['approvals_required.appsec'],'root');
  assert.equal(result.sources['approvals_overrides.exempt'],'worktree');
  assert.equal(result.sources['approvals_overrides.reason'],'worktree');
});

test('linked worktree rejects missing, duplicate, unknown, and incomplete override markers',t=>{
  const {root,linked}=linkedWorktrees(t);
  const rootConfig=parseWorkspaceConfig(sample);
  writeConfig(root,rootConfig);
  const changed={...rootConfig,workspace:{...rootConfig.workspace,provider:'claude'}};
  writeConfig(linked,changed);
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/worktree_overrides/);
  writeConfig(linked,{...changed,worktree_overrides:['workspace.provider','workspace.provider']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/duplicate/);
  writeConfig(linked,{...changed,worktree_overrides:['workspace.unknown']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/known override/);
  writeConfig(linked,{...changed,worktree_overrides:['approvals_overrides.reason']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/known override/);
});
