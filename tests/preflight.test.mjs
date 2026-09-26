import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';

const cli=path.resolve(import.meta.dirname,'../scripts/preflight.mjs');
const answers={developer:'implementer-session',scope:'single-file',risks:{auth:false,secrets:false,schema:false,publicApi:false,financial:false,userData:false,criticalInfrastructure:false,hardToRevert:false},userFacingUI:false,claimedTier:1,intendedFiles:['src/notify.js'],accessibilityEvidence:null};
function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function history(config) {
  const digest=workspaceConfigDigest(config);
  return [{kind:'proposal',revision:1,date:'2026-09-25',digest,config,reasons:{}},{kind:'acceptance',revision:1,date:'2026-09-25',digest,by:'Dennis',reason:'Accepted fixture policy',changes:[]}].map(value=>JSON.stringify(value)).join('\n')+'\n';
}
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'preflight-root-'));
  const worktree=path.join(os.tmpdir(),`preflight-worktree-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(worktree,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});});
  const config={workspace:{repository:'preflight-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-preflight-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI in fixture',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tiers:{tier_1_direct_merge:true}};
  const write=(base,value)=>{
    fs.mkdirSync(path.join(base,'config'),{recursive:true});fs.mkdirSync(path.join(base,'project'),{recursive:true});
    fs.writeFileSync(path.join(base,'config/workspace-config.yaml'),YAML.stringify(value));
    fs.writeFileSync(path.join(base,'project/workspace-config-history.jsonl'),history(value));
  };
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'README.md'),'fixture\n');write(root,config);
  git(root,'init','-q');git(root,'config','user.email','qa@example.test');git(root,'config','user.name','QA');git(root,'add','.');git(root,'commit','-qm','accepted coordination policy');
  git(root,'worktree','add','-q','-b','preflight-worktree',worktree);
  const overlay=structuredClone(config);overlay.workspace.provider='vscode';overlay.worktree_overrides=['workspace.provider'];write(worktree,overlay);
  git(worktree,'add','config/workspace-config.yaml','project/workspace-config-history.jsonl');git(worktree,'commit','-qm','accepted linked policy');
  return {root,worktree};
}
function run({root,worktree,id='notification-fix',input=answers}) {
  return spawnSync(process.execPath,[cli,'--id',id,'--coordination-root',root,'--worktree-root',worktree],{input:JSON.stringify(input),encoding:'utf8'});
}

test('preflight consumes only stdin attestations and prints selected route plus complete accepted policy provenance',t=>{
  const {root,worktree}=fixture(t);
  const result=run({root,worktree});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Selected tier:\s+1/);
  assert.match(result.stdout,/Reasons:\s+none/);
  assert.match(result.stdout,/Effective provider:\s+vscode.*worktree/i);
  for(const role of ['principal','qa','appsec','accessibility_reviewer','ui_designer']) assert.match(result.stdout,new RegExp(`${role}: (true|false) \\(source: (root|worktree)\\)`));
  assert.match(result.stdout,/Exemptions:.*accessibility_reviewer.*ui_designer/);
  assert.match(result.stdout,/Exemption reason: No UI in fixture/);
  assert.match(result.stdout,/Accepted policy digest: [a-f0-9]{64}/);
  assert.match(result.stdout,/sole changed path.*directly on top of starting HEAD.*before any implementation/i);
  const record=YAML.parse(fs.readFileSync(path.join(worktree,'project/task-assessments/notification-fix.yaml'),'utf8'));
  assert.equal(record.selectedTier,1);
  assert.equal(record.developer,'implementer-session');
  assert.equal(record.roleEvidence,null);
});

test('preflight refuses derived fields, malformed input, unsafe IDs, and unaccepted histories without writing',t=>{
  const {root,worktree}=fixture(t);
  for(const [id,input] of [
    ['derived',{...answers,tier:1}],
    ['bad-risk',{...answers,risks:{auth:'false'}}],
    ['../escape',answers],
  ]) {
    const result=run({root,worktree,id,input});
    assert.notEqual(result.status,0,`${id} unexpectedly succeeded`);
  }
  assert.equal(fs.existsSync(path.join(worktree,'project/task-assessments/derived.yaml')),false);
  assert.equal(fs.existsSync(path.join(worktree,'project/task-assessments/bad-risk.yaml')),false);
  assert.equal(fs.existsSync(path.join(worktree,'../escape.yaml')),false);
  fs.writeFileSync(path.join(root,'project/workspace-config-history.jsonl'),'');
  const pending=run({root,worktree,id:'pending'});
  assert.notEqual(pending.status,0);
  assert.match(pending.stderr,/accepted|history|pending/i);
  assert.equal(fs.existsSync(path.join(worktree,'project/task-assessments/pending.yaml')),false);
});

test('preflight refuses dirty worktrees and symlinked evidence directories before writing',t=>{
  const {root,worktree}=fixture(t);
  fs.writeFileSync(path.join(worktree,'untracked.txt'),'dirty\n');
  const dirty=run({root,worktree,id:'dirty'});
  assert.notEqual(dirty.status,0);
  assert.match(dirty.stderr,/clean|changed/i);
  fs.unlinkSync(path.join(worktree,'untracked.txt'));

  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'preflight-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.symlinkSync(outside,path.join(worktree,'project/task-assessments'));
  git(worktree,'add','-f','project/task-assessments');git(worktree,'commit','-qm','fixture symlinked assessment directory');
  const linked=run({root,worktree,id:'escaped'});
  assert.notEqual(linked.status,0);
  assert.equal(fs.readdirSync(outside).length,0);
});
