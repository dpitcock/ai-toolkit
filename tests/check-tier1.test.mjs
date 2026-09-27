import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {createTaskAssessment} from '../scripts/lib/task-assessment.mjs';
import {workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
import {checkTier1} from '../scripts/check-tier1.mjs';

const cli=path.resolve(import.meta.dirname,'../scripts/check-tier1.mjs');
const assessmentPath='project/task-assessments/quick-fix.yaml';
const noRisks={auth:false,secrets:false,schema:false,publicApi:false,financial:false,userData:false,criticalInfrastructure:false,hardToRevert:false};
const lowRisk={developer:'implementer-session',scope:'single-file',risks:noRisks,userFacingUI:false,claimedTier:1,intendedFiles:['src/notify.js'],accessibilityEvidence:null};
function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function history(config) {
  const digest=workspaceConfigDigest(config);
  return [{kind:'proposal',revision:1,date:'2026-09-25',digest,config,reasons:{}},{kind:'acceptance',revision:1,date:'2026-09-25',digest,by:'Dennis',reason:'Accepted fixture policy',changes:[]}].map(record=>JSON.stringify(record)).join('\n')+'\n';
}
function fixture(t,{tier1=true,omitTier1=false,answers=lowRisk,commitTogether=false,sourceBeforeEvidence=false}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier1-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const config={workspace:{repository:'tier1-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-tier1-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI in fixture',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},...(omitTier1?{}:{task_tiers:{tier_1_direct_merge:tier1}})};
  fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'project'),{recursive:true});
  fs.writeFileSync(path.join(root,'README.md'),'fixture\n');
  fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(config));
  fs.writeFileSync(path.join(root,'project/workspace-config-history.jsonl'),history(config));
  git(root,'init','-q');git(root,'config','user.email','qa@example.test');git(root,'config','user.name','QA');git(root,'add','.');git(root,'commit','-qm','accepted fixture policy');
  const startingHead=git(root,'rev-parse','HEAD');
  const preflight=createTaskAssessment({id:'quick-fix',answers,coordinationRoot:root,worktreeRoot:root});
  if(sourceBeforeEvidence || commitTogether) {
    const source=path.join(root,answers.intendedFiles[0]);
    fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'export const notify = () => true;\n');
    if(sourceBeforeEvidence) {
      git(root,'add','--',answers.intendedFiles[0]);git(root,'commit','-qm','incorrectly precede evidence with implementation');
      git(root,'add','--',assessmentPath);git(root,'commit','-qm','late assessment evidence');
    } else {
      git(root,'add','--',assessmentPath,answers.intendedFiles[0]);git(root,'commit','-qm','combine evidence and implementation');
    }
  } else {
    git(root,'add','--',assessmentPath);git(root,'commit','-qm','initial assessment evidence');
  }
  return {root,config,startingHead,answers,assessmentPath,record:preflight.record};
}

function assessmentFixture(t,options={}) {
  return fixture(t,options);
}

function linkedFixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier1-coordination-'));
  const worktree=path.join(os.tmpdir(),`check-tier1-linked-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(worktree,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});});
  const config={workspace:{repository:'tier1-linked-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-tier1-linked-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI in fixture',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tiers:{tier_1_direct_merge:true}};
  const write=(base,value)=>{
    fs.mkdirSync(path.join(base,'config'),{recursive:true});fs.mkdirSync(path.join(base,'project'),{recursive:true});
    fs.writeFileSync(path.join(base,'config/workspace-config.yaml'),YAML.stringify(value));
    fs.writeFileSync(path.join(base,'project/workspace-config-history.jsonl'),history(value));
  };
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'README.md'),'fixture\n');write(root,config);
  git(root,'init','-q');git(root,'config','user.email','qa@example.test');git(root,'config','user.name','QA');git(root,'add','.');git(root,'commit','-qm','coordination policy');
  git(root,'worktree','add','-q','-b','linked-tier1',worktree);
  const overlay=structuredClone(config);overlay.workspace.provider='vscode';overlay.worktree_overrides=['workspace.provider'];write(worktree,overlay);
  git(worktree,'add','config/workspace-config.yaml','project/workspace-config-history.jsonl');git(worktree,'commit','-qm','linked overlay');
  const preflight=createTaskAssessment({id:'quick-fix',answers:lowRisk,coordinationRoot:root,worktreeRoot:worktree});
  git(worktree,'add','--',assessmentPath);git(worktree,'commit','-qm','initial assessment evidence');
  return {root,worktree,preflight};
}

test('Tier 1 verifies the exact one-file diff, appends final evidence, and leaves code untouched',t=>{
  const state=assessmentFixture(t);
  const {root,startingHead,assessmentPath}=state;
  const source=path.join(root,'src/notify.js');
  fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'export const notify = () => true;\n');
  git(root,'add','src/notify.js');git(root,'commit','-qm','implement notification fix');
  const result=checkTier1({assessmentPath,repoRoot:root});
  assert.equal(result.tier,1);
  assert.equal(result.directMergeEligible,true);
  assert.match(result.output,/direct merge eligible/i);
  assert.match(result.output,/host rules.*separate adopter responsibility/i);
  assert.equal(fs.readFileSync(source,'utf8'),'export const notify = () => true;\n');
  const record=YAML.parse(fs.readFileSync(path.join(root,assessmentPath),'utf8'));
  assert.equal(record.startingHead,startingHead);
  assert.equal(record.selectedTier,1);
  assert.equal(record.finalChecks.length,1);
  assert.deepEqual(record.finalChecks[0].actualFiles,['src/notify.js']);
});

test('CLI reports the policy result and host-rule limitation',t=>{
  const state=assessmentFixture(t);
  fs.mkdirSync(path.join(state.root,'src'),{recursive:true});
  fs.writeFileSync(path.join(state.root,'src/notify.js'),'export const notify = () => true;\n');
  git(state.root,'add','src/notify.js');git(state.root,'commit','-qm','implement notification fix');
  const result=spawnSync(process.execPath,[cli,'--assessment',assessmentPath],{cwd:state.root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Direct merge eligible: yes/);
  assert.match(result.stdout,/Compatible host rules are a separate adopter responsibility/);
});

test('a false or omitted accepted Tier 1 policy preserves the PR route',t=>{
  for(const options of [{tier1:false},{omitTier1:true}]) {
    const state=assessmentFixture(t,options);
    const {root,assessmentPath}=state;
    fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.writeFileSync(path.join(root,'src/notify.js'),'export const notify = () => true;\n');
    git(root,'add','src/notify.js');git(root,'commit','-qm','implement notification fix');
    const result=checkTier1({assessmentPath,repoRoot:root});
    assert.equal(result.tier,1);
    assert.equal(result.directMergeEligible,false);
    assert.match(result.output,/pull request/i);
  }
});

test('resolves current accepted policy through a registered coordination worktree',t=>{
  const state=linkedFixture(t);
  fs.mkdirSync(path.join(state.worktree,'src'),{recursive:true});
  fs.writeFileSync(path.join(state.worktree,'src/notify.js'),'export const notify = () => true;\n');
  git(state.worktree,'add','src/notify.js');git(state.worktree,'commit','-qm','implement notification fix');
  const result=checkTier1({assessmentPath,repoRoot:state.worktree});
  assert.equal(result.tier,1);
  assert.equal(result.directMergeEligible,true);
});

test('actual file expansion routes upward and empty implementation diffs are refused',t=>{
  const expanded=assessmentFixture(t);
  fs.mkdirSync(path.join(expanded.root,'src'),{recursive:true});
  fs.writeFileSync(path.join(expanded.root,'src/notify.js'),'export const notify = () => true;\n');
  fs.writeFileSync(path.join(expanded.root,'src/format.js'),'export const format = value => value;\n');
  git(expanded.root,'add','src');git(expanded.root,'commit','-qm','expand implementation');
  const routed=checkTier1({assessmentPath:expanded.assessmentPath,repoRoot:expanded.root});
  assert.equal(routed.tier,3);
  assert.equal(routed.directMergeEligible,false);
  assert.match(routed.output,/Tier 3/i);

  const empty=assessmentFixture(t);
  assert.throws(()=>checkTier1({assessmentPath:empty.assessmentPath,repoRoot:empty.root}),/empty|no implementation diff/i);
});

test('rejects stale accepted config and edits to immutable preflight answers',t=>{
  const stale=assessmentFixture(t);
  const changed=structuredClone(stale.config);changed.task_tiers.tier_1_direct_merge=false;
  const previousDigest=workspaceConfigDigest(stale.config),digest=workspaceConfigDigest(changed);
  fs.writeFileSync(path.join(stale.root,'config/workspace-config.yaml'),YAML.stringify(changed));
  fs.writeFileSync(path.join(stale.root,'project/workspace-config-history.jsonl'),history(stale.config)+JSON.stringify({kind:'change',revision:2,date:'2026-09-25',digest,by:'Dennis',reason:'Accepted policy change',changes:['task_tiers.tier_1_direct_merge']})+'\n');
  git(stale.root,'add','config/workspace-config.yaml','project/workspace-config-history.jsonl');git(stale.root,'commit','-qm','change accepted policy');
  assert.notEqual(previousDigest,digest);
  assert.throws(()=>checkTier1({assessmentPath:stale.assessmentPath,repoRoot:stale.root}),/stale|changed|digest/i);

  for(const field of ['risks','selectedTier','startingHead']) {
    const tampered=assessmentFixture(t);
    const file=path.join(tampered.root,tampered.assessmentPath),record=YAML.parse(fs.readFileSync(file,'utf8'));
    if(field==='risks') record.risks.auth=true;
    else if(field==='selectedTier') record.selectedTier=2;
    else record.startingHead='f'.repeat(40);
    fs.writeFileSync(file,YAML.stringify(record));
    assert.throws(()=>checkTier1({assessmentPath:tampered.assessmentPath,repoRoot:tampered.root}),/initial|immutable|assessment evidence/i,field);
  }
});

test('unknown risk answers and UI evidence cannot enter Tier 1',t=>{
  for(const [name,answers] of [
    ['unknown-risk',{...lowRisk,risks:{...noRisks,auth:null}}],
    ['ui',{...lowRisk,scope:'one-subsystem',userFacingUI:true,claimedTier:2,intendedFiles:['src/components/Notice.tsx']}],
  ]) {
    const state=assessmentFixture(t,{answers});
    const source=path.join(state.root,answers.intendedFiles[0]);
    fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'export const changed = true;\n');
    git(state.root,'add','--',answers.intendedFiles[0]);git(state.root,'commit','-qm',`implement ${name}`);
    const result=checkTier1({assessmentPath:state.assessmentPath,repoRoot:state.root});
    assert.ok(result.tier>1,name);
    assert.match(result.output,/Tier [23]/i,name);
  }
});

test('all Git access uses the injected read-only adapter and only assessment metadata changes',t=>{
  const state=assessmentFixture(t);
  const source=path.join(state.root,'src/notify.js');
  fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'export const notify = () => true;\n');
  git(state.root,'add','src/notify.js');git(state.root,'commit','-qm','implement notification fix');
  const commands=[];
  const adapter={run(args){
    commands.push([...args]);
    assert.ok(!['add','commit','push','merge','branch','reset','checkout','update-ref'].includes(args[0]),args.join(' '));
    return execFileSync('git',['-C',state.root,...args],{encoding:'utf8'});
  }};
  const result=checkTier1({assessmentPath:state.assessmentPath,repoRoot:state.root,gitAdapter:adapter});
  assert.equal(result.tier,1);
  assert.ok(commands.length>0);
  assert.ok(commands.every(args=>['rev-parse','worktree','status','log','diff','diff-tree','show','rev-list','ls-files','ls-tree','merge-base'].includes(args[0])));
  assert.equal(git(state.root,'status','--porcelain=v1','--untracked-files=all'),`M ${state.assessmentPath}`);
  assert.equal(fs.readFileSync(source,'utf8'),'export const notify = () => true;\n');
});

test('refuses a hard-linked assessment before changing any alias',t=>{
  const state=assessmentFixture(t);
  fs.mkdirSync(path.join(state.root,'src'),{recursive:true});
  fs.writeFileSync(path.join(state.root,'src/notify.js'),'export const notify = () => true;\n');
  git(state.root,'add','src/notify.js');git(state.root,'commit','-qm','implement notification fix');
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier1-hardlink-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const assessment=path.join(state.root,state.assessmentPath);
  const alias=path.join(outside,'assessment.yaml');
  const original=fs.readFileSync(assessment);
  fs.linkSync(assessment,alias);
  assert.equal(fs.statSync(assessment).nlink,2);

  assert.throws(()=>checkTier1({assessmentPath:state.assessmentPath,repoRoot:state.root}),/hard.link|multiple links/i);
  assert.deepEqual(fs.readFileSync(assessment),original);
  assert.deepEqual(fs.readFileSync(alias),original);
});

test('initial evidence must be the sole changed path directly atop starting HEAD',t=>{
  const together=assessmentFixture(t,{commitTogether:true});
  assert.throws(()=>checkTier1({assessmentPath:together.assessmentPath,repoRoot:together.root}),/sole|initial evidence commit/i);
  const late=assessmentFixture(t,{sourceBeforeEvidence:true});
  assert.throws(()=>checkTier1({assessmentPath:late.assessmentPath,repoRoot:late.root}),/parent|initial evidence commit/i);
});

test('a parent-directory swap during the final write cannot redirect assessment writes outside the worktree',t=>{
  const state=assessmentFixture(t);
  fs.mkdirSync(path.join(state.root,'src'),{recursive:true});
  fs.writeFileSync(path.join(state.root,'src/notify.js'),'export const notify = () => true;\n');
  git(state.root,'add','src/notify.js');git(state.root,'commit','-qm','implement notification fix');
  const assessmentDirectory=path.join(state.root,'project/task-assessments');
  const relocatedDirectory=path.join(state.root,'project/task-assessments-relocated');
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier1-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const outsideAssessment=path.join(outside,'quick-fix.yaml');
  const outsideSentinel='outside assessment must remain unchanged\n';
  fs.writeFileSync(outsideAssessment,outsideSentinel);

  const originalRename=fs.renameSync;
  const originalWrite=fs.writeSync;
  let swapped=false;
  function swapParent(sourcePath) {
    swapped=true;
    if(sourcePath) fs.copyFileSync(sourcePath,path.join(outside,path.basename(sourcePath)));
    originalRename(assessmentDirectory,relocatedDirectory);
    fs.symlinkSync(outside,assessmentDirectory);
  }
  fs.writeSync=function(descriptor,buffer,offset,length,position) {
    if(!swapped) swapParent();
    return originalWrite.call(fs,descriptor,buffer,offset,length,position);
  };
  fs.renameSync=function(source,destination) {
    if(!swapped && path.basename(destination)==='quick-fix.yaml') {
      swapParent(source);
    }
    return originalRename(source,destination);
  };
  try {
    assert.throws(()=>checkTier1({assessmentPath:state.assessmentPath,repoRoot:state.root}),/assessment (directory|path) changed/i);
    assert.equal(swapped,true);
    assert.equal(fs.readFileSync(outsideAssessment,'utf8'),outsideSentinel);
    assert.equal(YAML.parse(fs.readFileSync(path.join(relocatedDirectory,'quick-fix.yaml'),'utf8')).finalChecks,undefined);
  } finally {
    fs.renameSync=originalRename;
    fs.writeSync=originalWrite;
    if(fs.lstatSync(assessmentDirectory).isSymbolicLink()) fs.unlinkSync(assessmentDirectory);
    if(fs.existsSync(relocatedDirectory)) originalRename(relocatedDirectory,assessmentDirectory);
  }
});
