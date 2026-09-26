import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {createTaskAssessment} from '../scripts/lib/task-assessment.mjs';
import {workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
import {validateTier2Assessment} from '../scripts/check-tier2.mjs';

const assessmentPath='project/task-assessments/tier2-change.yaml';
const checkPrScript=fileURLToPath(new URL('../scripts/check-pr.mjs',import.meta.url));
const roles=['principal','qa','appsec'];
const risks={auth:false,secrets:false,schema:false,publicApi:false,financial:false,userData:false,criticalInfrastructure:false,hardToRevert:false};
const answers={developer:'implementer-session',scope:'one-subsystem',risks,userFacingUI:false,claimedTier:2,intendedFiles:['src/notify.js','src/format.js'],accessibilityEvidence:null};

function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }

function history(config) {
  const digest=workspaceConfigDigest(config);
  return [
    {kind:'proposal',revision:1,date:'2026-09-25',digest,config,reasons:{}},
    {kind:'acceptance',revision:1,date:'2026-09-25',digest,by:'Dennis',reason:'Accepted fixture policy',changes:[]},
  ].map(record=>JSON.stringify(record)).join('\n')+'\n';
}

function makeReview(commit,by,revision=1) {
  return {by,date:'2026-09-25',notes:'Reviewed the bounded Tier 2 change.',revision,commit};
}

function fixture(t,{input=answers,missingRoles=[],review={},roleEdits={},assessmentEdits={},extraActualFiles=[],extraAfterReview=[],
  policyDrift=false,accessibilityFinalReview=false,accessibilityFinalReviewEdits={},multipleAssessments=false,
  secondAssessmentEdits={},initialEvidenceEdits={},headRef='feature/tier2-check'}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier2-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const config={
    workspace:{repository:'tier2-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-tier2-fixture-codex',timezone:'UTC'},
    approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},
    approvals_overrides:{reason:'No UI in fixture',exempt:['accessibility_reviewer','ui_designer']},
    daily_summary:{local_time:'09:00'},task_tiers:{tier_1_direct_merge:false},
  };
  fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'project'),{recursive:true});
  fs.writeFileSync(path.join(root,'README.md'),'fixture\n');
  fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(config));
  fs.writeFileSync(path.join(root,'project/workspace-config-history.jsonl'),history(config));
  git(root,'init','-q');git(root,'config','user.email','qa@example.test');git(root,'config','user.name','QA');
  git(root,'add','.');git(root,'commit','-qm','accepted fixture policy');
  const baseSha=git(root,'rev-parse','HEAD');
  if(multipleAssessments) git(root,'checkout','-qb','tier2-primary');
  const assessment=createTaskAssessment({id:'tier2-change',answers:input,coordinationRoot:root,worktreeRoot:root});
  if(Object.keys(initialEvidenceEdits).length) {
    const initial=YAML.parse(fs.readFileSync(path.join(root,assessmentPath),'utf8'));
    Object.assign(initial,initialEvidenceEdits);
    fs.writeFileSync(path.join(root,assessmentPath),YAML.stringify(initial,{lineWidth:0}));
  }
  git(root,'add','--',assessmentPath);git(root,'commit','-qm','initial assessment evidence');
  if(multipleAssessments) {
    git(root,'checkout','-qb','tier2-secondary',baseSha);
    createTaskAssessment({id:'tier2-second',answers:input,coordinationRoot:root,worktreeRoot:root});
    git(root,'add','--','project/task-assessments/tier2-second.yaml');git(root,'commit','-qm','second initial assessment evidence');
    git(root,'checkout','-q','tier2-primary');
    git(root,'merge','--no-ff','-m','combine independent assessment branches','tier2-secondary');
  }
  if(policyDrift) {
    const changedConfig=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
    changedConfig.workspace.provider='changed-after-acceptance';
    fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(changedConfig));
  }
  for(const file of input.intendedFiles) {
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,`export const value = '${path.basename(file)}';\n`);
  }
  for(const file of extraActualFiles) {
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,`export const extra = '${path.basename(file)}';\n`);
  }
  git(root,'add','--',...input.intendedFiles,...extraActualFiles);git(root,'commit','-qm','implement Tier 2 change');
  const reviewedCommit=git(root,'rev-parse','HEAD');
  for(const file of extraAfterReview) {
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'export const later = true;\n');
  }
  if(extraAfterReview.length) { git(root,'add','--',...extraAfterReview);git(root,'commit','-qm','change code after review'); }

  const assessmentPaths=[assessmentPath,...(multipleAssessments?['project/task-assessments/tier2-second.yaml']:[])];
  for(const currentPath of assessmentPaths) {
    const current=YAML.parse(fs.readFileSync(path.join(root,currentPath),'utf8'));
    const edits=currentPath===assessmentPath?assessmentEdits:secondAssessmentEdits;
    current.reviewEvidence={mode:'independent',...makeReview(reviewedCommit,'reviewer-session'),...review};
    if(accessibilityFinalReview && current.accessibilityEvidence) {
      current.accessibilityEvidence.finalReview={...makeReview(reviewedCommit,'accessibility-reviewer'),...accessibilityFinalReviewEdits};
    }
    current.roleEvidence=Object.fromEntries(roles.filter(role=>!missingRoles.includes(role)).map(role=>[
      role,{...makeReview(reviewedCommit,`${role}-reviewer-session`),...(roleEdits[role]??{})},
    ]));
    Object.assign(current,edits);
    fs.writeFileSync(path.join(root,currentPath),YAML.stringify(current,{lineWidth:0}));
  }
  git(root,'add','--',...assessmentPaths);git(root,'commit','-qm','record Tier 2 reviews');
  const headSha=git(root,'rev-parse','HEAD');
  return {root,config,baseSha,headSha,headRef,reviewedCommit,assessment:assessment.record};
}

function validate(state,options={}) {
  return validateTier2Assessment({assessmentPath,repoRoot:state.root,baseSha:state.baseSha,headSha:state.headSha,headRef:state.headRef,...options});
}

function runCheckPr(state) {
  return spawnSync(process.execPath,[checkPrScript],{
    cwd:state.root,encoding:'utf8',
    env:{...process.env,BASE_SHA:state.baseSha,HEAD_REF:state.headRef},
  });
}

test('accepts a valid Tier 2 PR with exact reviewed commit and required role evidence',t=>{
  const state=fixture(t);
  const result=validate(state);
  assert.equal(result.tier,2);
  assert.equal(result.status,'passed');
  assert.deepEqual(result.actualFiles,['src/format.js','src/notify.js']);
});

test('accepts a self-check written by the developer while keeping role approvals independent',t=>{
  const state=fixture(t,{review:{mode:'self-check',by:' IMPLEMENTER-SESSION '}});
  assert.equal(validate(state).status,'passed');
});

test('requires each configured role that applies',t=>{
  for(const role of roles) {
    const state=fixture(t,{missingRoles:[role]});
    assert.throws(()=>validate(state),new RegExp(`required ${role} approval is missing`));
  }
});

test('rejects a required role approval from the developer',t=>{
  const state=fixture(t,{roleEdits:{principal:{by:' IMPLEMENTER-SESSION '}}});
  assert.throws(()=>validate(state),/principal approval must be independent/);
});

test('rejects malformed, mismatched, or reviewer-colliding review evidence',t=>{
  for(const review of [
    {date:'2026-02-30'},
    {revision:2},
    {commit:'0'.repeat(40)},
    {mode:'independent',by:' Implementer-Session '},
    {mode:'self-check',by:'reviewer-session'},
    {mode:'unknown'},
  ]) {
    const state=fixture(t,{review});
    assert.throws(()=>validate(state));
  }
});

test('rejects stale accepted policy and changes to committed initial facts',t=>{
  const stalePolicy=fixture(t,{policyDrift:true});
  assert.throws(()=>validate(stalePolicy),/policy is stale|digest is stale|changed after acceptance/);
  for(const assessmentEdits of [{scope:'cross-cutting'},{selectedTier:1},{intendedFiles:['src/notify.js']}]) {
    const state=fixture(t,{assessmentEdits});
    assert.throws(()=>validate(state),/differs from the first committed assessment evidence/);
  }
});

test('requires a preflight baseline with empty post-review evidence fields',t=>{
  const state=fixture(t,{initialEvidenceEdits:{reviewEvidence:{mode:'independent',...makeReview('0'.repeat(40),'reviewer')}}});
  assert.throws(()=>validate(state),/initial assessment must not contain review evidence/);
});

test('requires complete PR context bound to the checked-out HEAD',t=>{
  const state=fixture(t);
  assert.throws(()=>validate(state,{headRef:''}),/PR context/);
  assert.throws(()=>validate(state,{headSha:'0'.repeat(40)}),/HEAD/);
});

test('allows only assessment metadata changes after the reviewed commit',t=>{
  const state=fixture(t,{extraAfterReview:['src/format.js']});
  assert.throws(()=>validate(state),/after reviewedCommit.*task-assessment metadata/);
});

test('refuses a Tier 2 assessment when the actual diff reclassifies to Tier 3',t=>{
  const state=fixture(t,{extraActualFiles:['src/expanded-scope.js']});
  assert.throws(()=>validate(state),/reclassifies to Tier 3/);
});

test('accepts UI evidence only when preflight and final review evidence are independent and current',t=>{
  const input={...answers,userFacingUI:true,accessibilityEvidence:{
    triage:{by:'accessibility-triage',date:'2026-09-25',notes:'Triaged the UI change.',revision:1},
    plan:{by:'accessibility-planner',date:'2026-09-25',notes:'Reviewed the planned controls.',revision:1},
  }};
  const state=fixture(t,{input,accessibilityFinalReview:true});
  assert.equal(validate(state).status,'passed');
});

test('routes missing or mismatched UI final review evidence away from Tier 2',t=>{
  const input={...answers,userFacingUI:true,accessibilityEvidence:{
    triage:{by:'accessibility-triage',date:'2026-09-25',notes:'Triaged the UI change.',revision:1},
    plan:{by:'accessibility-planner',date:'2026-09-25',notes:'Reviewed the planned controls.',revision:1},
  }};
  const missing=fixture(t,{input});
  assert.throws(()=>validate(missing),/Tier 3/);
  const wrongCommit=fixture(t,{input,accessibilityFinalReview:true,accessibilityFinalReviewEdits:{commit:'0'.repeat(40)}});
  assert.throws(()=>validate(wrongCommit),/Tier 3/);
});

test('preflight accessibility evidence cannot be self-approved',t=>{
  const input={...answers,userFacingUI:true,accessibilityEvidence:{
    triage:{by:'implementer-session',date:'2026-09-25',notes:'Self-triaged.',revision:1},
    plan:{by:'accessibility-planner',date:'2026-09-25',notes:'Reviewed the planned controls.',revision:1},
  }};
  const state=fixture(t,{input,accessibilityFinalReview:true});
  const result=validate(state);
  assert.equal(result.tier,3);
  assert.equal(result.status,'epic-gate-required');
});

test('check-pr validates every changed assessment file in the same PR',t=>{
  const input={...answers,intendedFiles:['project/src/notify.js','project/src/format.js']};
  const state=fixture(t,{input,multipleAssessments:true,secondAssessmentEdits:{reviewEvidence:{mode:'invalid'}}});
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stdout,/tier2-change\.yaml: Tier 2 passed/);
  assert.match(result.stderr,/reviewEvidence/);
  assert.doesNotMatch(result.stdout,/tier2-second\.yaml: Tier 2 passed/);
});

test('check-pr keeps the existing epic-plan PR gate before Tier 2 validation',t=>{
  const input={...answers,intendedFiles:['project/src/notify.js','project/src/format.js']};
  const state=fixture(t,{input,headRef:'epic/EPIC-004'});
  const planDirectory=path.join(state.root,'epics/EPIC-004');
  fs.mkdirSync(planDirectory,{recursive:true});
  const approvals=Object.fromEntries(['principal_engineer','appsec','qa_lead','code_review','appsec_review','accessibility','accessibility_review'].map(role=>[role,null]));
  const plan={kind:'epic-plan',id:'EPIC-004-PLAN',owner:'developer',status:'approved',revision:1,approvals};
  fs.writeFileSync(path.join(planDirectory,'epic-plan.md'),`---\n${YAML.stringify(plan)}---\n`);
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/PR requires ready-for-pr epic plan/);
  assert.doesNotMatch(result.stdout,/Tier 2 passed/);
});
