import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
import {buildTaskAssessment,createTaskAssessment,validateAssessmentAnswers,safeAssessmentId,writeTaskAssessment} from '../scripts/lib/task-assessment.mjs';

const noRisks={auth:false,secrets:false,schema:false,publicApi:false,financial:false,userData:false,criticalInfrastructure:false,hardToRevert:false};
const answers={developer:'implementer-session',scope:'single-file',risks:noRisks,userFacingUI:false,claimedTier:1,intendedFiles:['src/notify.js'],accessibilityEvidence:null};

function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function acceptedHistory(config) {
  const digest=workspaceConfigDigest(config);
  return [
    {kind:'proposal',revision:1,date:'2026-09-25',digest,config,reasons:{}},
    {kind:'acceptance',revision:1,date:'2026-09-25',digest,by:'Dennis',reason:'Accepted fixture policy',changes:[]},
  ].map(record=>JSON.stringify(record)).join('\n')+'\n';
}
function fixture(t,{linked=true}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'task-assessment-root-'));
  const worktree=path.join(os.tmpdir(),`task-assessment-worktree-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(worktree,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});});
  const config={workspace:{repository:'assessment-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-assessment-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI in fixture',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tiers:{tier_1_direct_merge:true}};
  const writePolicy=(base,value)=>{
    fs.mkdirSync(path.join(base,'config'),{recursive:true});
    fs.mkdirSync(path.join(base,'project'),{recursive:true});
    fs.writeFileSync(path.join(base,'config/workspace-config.yaml'),YAML.stringify(value));
    fs.writeFileSync(path.join(base,'project/workspace-config-history.jsonl'),acceptedHistory(value));
  };
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'README.md'),'fixture\n');
  writePolicy(root,config);
  git(root,'init','-q');git(root,'config','user.email','qa@example.test');git(root,'config','user.name','QA');
  git(root,'add','.');git(root,'commit','-qm','accepted coordination policy');
  if(!linked) return {root,worktree:root,config,startingHead:git(root,'rev-parse','HEAD')};
  git(root,'worktree','add','-q','-b','assessment-worktree',worktree);
  const overlay=structuredClone(config);overlay.workspace.provider='vscode';overlay.worktree_overrides=['workspace.provider'];
  writePolicy(worktree,overlay);
  git(worktree,'add','config/workspace-config.yaml','project/workspace-config-history.jsonl');
  git(worktree,'commit','-qm','accepted linked policy');
  return {root,worktree,config,overlay,startingHead:git(worktree,'rev-parse','HEAD')};
}

test('validates only declared assessment answers and safe assessment IDs',()=>{
  assert.equal(safeAssessmentId('fix-042.task'),true);
  for(const value of ['','../escape','..','.','has/slash','has\\backslash','-leading','a'.repeat(65)]) assert.equal(safeAssessmentId(value),false,value);
  assert.deepEqual(validateAssessmentAnswers(answers),answers);
  for(const invalid of [
    {...answers,tier:1},
    {...answers,stage:'final'},
    {...answers,developer:''},
    {...answers,risks:{...noRisks,other:false}},
    {...answers,userFacingUI:'false'},
    {...answers,intendedFiles:['../outside.js']},
  ]) assert.throws(()=>validateAssessmentAnswers(invalid));
});

test('writes a deterministic baseline with effective policy provenance and null review evidence',t=>{
  const {root,worktree,startingHead}=fixture(t);
  const options={id:'notification-fix',answers,coordinationRoot:root,worktreeRoot:worktree};
  assert.deepEqual(buildTaskAssessment(options).record,buildTaskAssessment(options).record);
  const result=createTaskAssessment(options);
  assert.equal(result.record.startingHead,startingHead);
  assert.equal(result.record.acceptedConfig.revision,1);
  assert.match(result.record.acceptedConfig.effectiveDigest,/^[a-f0-9]{64}$/);
  assert.match(result.record.acceptedConfig.coordination.digest,/^[a-f0-9]{64}$/);
  assert.equal(result.record.acceptedConfig.coordination.revision,1);
  assert.match(result.record.acceptedConfig.worktree.digest,/^[a-f0-9]{64}$/);
  assert.equal(result.record.acceptedConfig.worktree.revision,1);
  assert.equal(result.record.selectedTier,1);
  assert.deepEqual(result.record.reasons,[]);
  assert.equal(result.record.reviewEvidence,null);
  assert.equal(result.record.roleEvidence,null);
  const first=fs.readFileSync(result.file,'utf8');
  assert.equal(first,YAML.stringify(result.record));
  assert.throws(()=>writeTaskAssessment(worktree,'notification-fix',result.record),/already exists|refus/i);
});

test('requires accepted, current config histories for both linked roots',t=>{
  const pending=fixture(t,{linked:false});
  fs.writeFileSync(path.join(pending.root,'project/workspace-config-history.jsonl'),'');
  assert.throws(()=>createTaskAssessment({id:'pending',answers,coordinationRoot:pending.root,worktreeRoot:pending.root}),/accepted|pending/i);

  const drift=fixture(t);
  const configFile=path.join(drift.worktree,'config/workspace-config.yaml');
  fs.writeFileSync(configFile,fs.readFileSync(configFile,'utf8').replace('provider: vscode','provider: codex'));
  assert.throws(()=>createTaskAssessment({id:'drift',answers,coordinationRoot:drift.root,worktreeRoot:drift.worktree}),/accepted|changed|override/i);
});

test('refuses a nested repository directory even when both roots name it',t=>{
  const {root}=fixture(t,{linked:false});
  const nested=path.join(root,'nested-checkout');
  fs.mkdirSync(path.join(nested,'config'),{recursive:true});
  fs.mkdirSync(path.join(nested,'project'),{recursive:true});
  fs.copyFileSync(path.join(root,'config/workspace-config.yaml'),path.join(nested,'config/workspace-config.yaml'));
  fs.copyFileSync(path.join(root,'project/workspace-config-history.jsonl'),path.join(nested,'project/workspace-config-history.jsonl'));
  git(root,'add','nested-checkout');git(root,'commit','-qm','fixture nested config');
  assert.throws(()=>createTaskAssessment({id:'nested',answers,coordinationRoot:nested,worktreeRoot:nested}),/top-level|registered.*worktree/i);
  assert.equal(fs.existsSync(path.join(nested,'project/task-assessments/nested.yaml')),false);
});

test('refuses invalid JSON answer shape and dirty tracked or untracked worktrees before writing',t=>{
  assert.throws(()=>validateAssessmentAnswers({...answers,reasons:[]}),/not allowed|unknown/i);
  const {root,worktree}=fixture(t);
  fs.writeFileSync(path.join(worktree,'untracked.txt'),'dirty\n');
  assert.throws(()=>createTaskAssessment({id:'dirty',answers,coordinationRoot:root,worktreeRoot:worktree}),/clean|change/i);
  assert.equal(fs.existsSync(path.join(worktree,'project/task-assessments/dirty.yaml')),false);
  fs.unlinkSync(path.join(worktree,'untracked.txt'));
  fs.writeFileSync(path.join(worktree,'README.md'),'modified tracked fixture\n');
  assert.throws(()=>createTaskAssessment({id:'tracked-dirty',answers,coordinationRoot:root,worktreeRoot:worktree}),/clean|change/i);
  assert.equal(fs.existsSync(path.join(worktree,'project/task-assessments/tracked-dirty.yaml')),false);
});

test('refuses symlinked assessment paths, escaping roots, and existing records',t=>{
  const {root,worktree}=fixture(t);
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'task-assessment-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.symlinkSync(outside,path.join(worktree,'project/task-assessments'));
  assert.throws(()=>writeTaskAssessment(worktree,'symlink',{id:'symlink'}),/symlink|inside|regular|path/i);
  assert.deepEqual(fs.readdirSync(outside),[]);
});

test('valid unknown or high-risk attestations are persisted at Tier 3 rather than lowered',t=>{
  const answersWithRisk={...answers,risks:{...noRisks,auth:null},claimedTier:1};
  const {root,worktree}=fixture(t);
  const result=createTaskAssessment({id:'unknown-risk',answers:answersWithRisk,coordinationRoot:root,worktreeRoot:worktree});
  assert.equal(result.record.selectedTier,3);
  assert.ok(result.record.reasons.includes('unknown-risk-auth'));
});
