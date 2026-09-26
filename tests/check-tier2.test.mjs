import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {createTaskAssessment} from '../scripts/lib/task-assessment.mjs';
import {parseWorkspaceConfig,workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
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
  secondAssessmentEdits={},initialEvidenceEdits={},beforeAssessmentFiles=[],implementationOnSideBranch=false,
  implementationOnOrphanRoot=false,mergeCodeAfterReview=false,headRef='feature/tier2-check'}={}) {
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
  for(const file of beforeAssessmentFiles) {
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'export const beforePreflight = true;\n');
  }
  if(beforeAssessmentFiles.length) { git(root,'add','--',...beforeAssessmentFiles);git(root,'commit','-qm','feature code before preflight'); }
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
  let reviewedCommit;
  const implementationBranch=git(root,'branch','--show-current');
  if(implementationOnSideBranch) git(root,'checkout','-qb','implementation-side',baseSha);
  if(implementationOnOrphanRoot) {
    git(root,'checkout','-q','--orphan','implementation-root');
    git(root,'rm','-r','-f','--ignore-unmatch','.');
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
  if(implementationOnSideBranch || implementationOnOrphanRoot) {
    git(root,'checkout','-q',implementationBranch);
    if(implementationOnOrphanRoot) {
      git(root,'merge','--no-ff','--allow-unrelated-histories','-m','merge orphan implementation branch','implementation-root');
    } else git(root,'merge','--no-ff','-m','merge preflight and implementation branches','implementation-side');
  }
  reviewedCommit=git(root,'rev-parse','HEAD');
  for(const file of extraAfterReview) {
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'export const later = true;\n');
  }
  if(extraAfterReview.length) { git(root,'add','--',...extraAfterReview);git(root,'commit','-qm','change code after review'); }
  if(mergeCodeAfterReview) {
    const primaryBranch=git(root,'branch','--show-current');
    git(root,'checkout','-qb','review-side',reviewedCommit);
    fs.writeFileSync(path.join(root,'project/task-assessments/review-side.yaml'),'side metadata\n');
    git(root,'add','--','project/task-assessments/review-side.yaml');git(root,'commit','-qm','side assessment metadata');
    git(root,'checkout','-q',primaryBranch);
    fs.writeFileSync(path.join(root,'project/task-assessments/primary-side.yaml'),'primary metadata\n');
    git(root,'add','--','project/task-assessments/primary-side.yaml');git(root,'commit','-qm','primary assessment metadata');
    git(root,'merge','--no-ff','--no-commit','review-side');
    fs.appendFileSync(path.join(root,input.intendedFiles[0]),'export const mergeResolution = true;\n');
    git(root,'add','--',input.intendedFiles[0]);git(root,'commit','-qm','merge resolution includes code change');
  }

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

function governanceApprovals() {
  return {principal_engineer:null,appsec:null,qa_lead:null,code_review:null,appsec_review:null,accessibility:null,accessibility_review:null};
}

function writeGovernance(root,id,{status='approved',reviewedCommit=null,frontmatter=false,planId=`${id}-PLAN`,planRevision=1,taskPlanRevision=planRevision}={}) {
  const approval=(by,commit=null,revision=1)=>({by,date:'2026-09-25',notes:'Independent governance review.',revision,...(commit===null?{}:{commit})});
  const project={kind:'project',id:'PROJECT',owner:'project-owner',status:'approved',revision:1,approvals:governanceApprovals()};
  project.approvals.principal_engineer=approval('project-principal');
  const epic={kind:'epic',id,owner:'epic-owner',status:'approved',revision:1,parent:'../../project/project-plan.md',parent_revision:1,
    security:{auth:false,data:false,external:false,concerns:[],rationale:'Local test fixture.'},accessibility:{ui:false,rationale:'No UI.'},qa_requirements:['unit'],approvals:governanceApprovals()};
  epic.approvals.qa_lead=approval('qa-reviewer');epic.approvals.appsec='not-required';
  const task={kind:'task',id:'TASK-001',owner:'developer',status:reviewedCommit===null?'approved':'done',revision:1,parent:'../epic-plan.md',parent_revision:taskPlanRevision,depends_on:[],
    evidence:reviewedCommit===null?{red:null,green:null,qa:null,commit:null}:{red:'RED',green:'GREEN',qa:'QA',commit:reviewedCommit},approvals:governanceApprovals()};
  const plan={kind:'epic-plan',id:planId,owner:'developer',status:reviewedCommit===null?'approved':'ready-for-pr',revision:planRevision,parent:'epic.md',parent_revision:1,
    security:{auth:false,data:false,external:false,concerns:[],rationale:'Local test fixture.'},accessibility:{ui:false,rationale:'No UI.'},touches_concerns:[],tasks:['tasks/TASK-001.md'],review_comments:[],review_commit:reviewedCommit,approvals:governanceApprovals()};
  plan.approvals.principal_engineer=approval('plan-principal',null,planRevision);plan.approvals.appsec='not-required';
  if(reviewedCommit!==null) {
    plan.approvals.code_review=approval('code-reviewer',reviewedCommit,planRevision);
    plan.approvals.appsec_review=approval('appsec-reviewer',reviewedCommit,planRevision);
  }
  const write=(relative,value)=>{const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});const serialized=YAML.stringify(value,{lineWidth:0});fs.writeFileSync(target,frontmatter?`---\n${serialized}\n---\n` : serialized);};
  write('project/project-plan.md',project);write(`epics/${id}/epic.md`,epic);write(`epics/${id}/epic-plan.md`,plan);write(`epics/${id}/tasks/TASK-001.md`,task);
}

function tier3Fixture(t,{boundPlanId='EPIC-043',policyEdit=null,loadedPlanId=null,loadedPlanRevision=null}={}) {
  const coordination=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier3-coordination-'));
  const linked=path.join(os.tmpdir(),`check-tier3-linked-${path.basename(coordination)}`);
  t.after(()=>{try { git(coordination,'worktree','remove','--force',linked); } catch {} fs.rmSync(coordination,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
  const config={workspace:{repository:'tier3-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-tier3-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tiers:{tier_1_direct_merge:false}};
  fs.mkdirSync(path.join(coordination,'config'),{recursive:true});fs.mkdirSync(path.join(coordination,'project'),{recursive:true});
  fs.writeFileSync(path.join(coordination,'README.md'),'fixture\n');fs.writeFileSync(path.join(coordination,'config/workspace-config.yaml'),YAML.stringify(config));fs.writeFileSync(path.join(coordination,'project/workspace-config-history.jsonl'),history(config));
  git(coordination,'init','-q');git(coordination,'config','user.email','qa@example.test');git(coordination,'config','user.name','QA');git(coordination,'add','.');git(coordination,'commit','-qm','accepted coordination policy');
  git(coordination,'worktree','add','-q','-b','epic/EPIC-043',linked);
  const overlay={...config,workspace:{...config.workspace,provider:'claude'},worktree_overrides:['workspace.provider']};
  fs.writeFileSync(path.join(linked,'config/workspace-config.yaml'),YAML.stringify(overlay));fs.writeFileSync(path.join(linked,'project/workspace-config-history.jsonl'),history(overlay));
  git(linked,'add','--','config/workspace-config.yaml','project/workspace-config-history.jsonl');git(linked,'commit','-qm','accepted linked policy');
  const baseSha=git(linked,'rev-parse','HEAD');
  writeGovernance(linked,'EPIC-043');
  if(boundPlanId!=='EPIC-043') writeGovernance(linked,boundPlanId);
  git(linked,'add','--','project','epics');git(linked,'commit','-qm','add governed plans');
  const input={developer:'developer',scope:'cross-cutting',risks:{...risks,auth:true},userFacingUI:false,claimedTier:3,intendedFiles:['scripts/tier3-change.mjs'],accessibilityEvidence:null,tier3Binding:{planPath:'epics/EPIC-043/epic-plan.md',taskPath:'epics/EPIC-043/tasks/TASK-001.md'}};
  createTaskAssessment({id:'tier3-change',answers:input,coordinationRoot:coordination,worktreeRoot:linked,enforceTier3Binding:true});
  if(boundPlanId!=='EPIC-043') {
    const assessmentFile=path.join(linked,'project/task-assessments/tier3-change.yaml');const record=YAML.parse(fs.readFileSync(assessmentFile,'utf8'));
    record.tier3Binding.planPath=`epics/${boundPlanId}/epic-plan.md`;record.tier3Binding.planId=`${boundPlanId}-PLAN`;record.tier3Binding.taskPath=`epics/${boundPlanId}/tasks/TASK-001.md`;
    fs.writeFileSync(assessmentFile,YAML.stringify(record,{lineWidth:0}));
  }
  if(policyEdit!==null) {
    const assessmentFile=path.join(linked,'project/task-assessments/tier3-change.yaml');const record=YAML.parse(fs.readFileSync(assessmentFile,'utf8'));
    policyEdit(record.tier3Binding.policy);
    fs.writeFileSync(assessmentFile,YAML.stringify(record,{lineWidth:0}));
  }
  git(linked,'add','--','project/task-assessments/tier3-change.yaml');git(linked,'commit','-qm','initial Tier 3 assessment');
  fs.mkdirSync(path.join(linked,'scripts'),{recursive:true});fs.writeFileSync(path.join(linked,'scripts/tier3-change.mjs'),'export const tier3 = true;\n');git(linked,'add','--','scripts/tier3-change.mjs');git(linked,'commit','-qm','implement Tier 3 change');
  const reviewedCommit=git(linked,'rev-parse','HEAD');
  writeGovernance(linked,'EPIC-043',{reviewedCommit,frontmatter:true,...(loadedPlanId===null?{}:{planId:loadedPlanId}),...(loadedPlanRevision===null?{}:{planRevision:loadedPlanRevision,taskPlanRevision:loadedPlanRevision})});if(boundPlanId!=='EPIC-043') writeGovernance(linked,boundPlanId,{reviewedCommit,frontmatter:true});
  git(linked,'add','--','project','epics');git(linked,'commit','-qm','record final Tier 3 reviews');
  return {root:linked,baseSha,headRef:'epic/EPIC-043'};
}

function linkedFixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'check-tier2-coordination-'));
  const linked=path.join(os.tmpdir(),`check-tier2-linked-${path.basename(root)}`);
  t.after(()=>{try { git(root,'worktree','remove','--force',linked); } catch {} fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
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
  git(root,'add','.');git(root,'commit','-qm','accepted coordination policy');
  git(root,'worktree','add','-q','-b','linked-policy',linked);
  const overlay={...parseWorkspaceConfig(YAML.stringify(config)),workspace:{...config.workspace,provider:'claude'},worktree_overrides:['workspace.provider']};
  fs.writeFileSync(path.join(linked,'config/workspace-config.yaml'),YAML.stringify(overlay));
  fs.writeFileSync(path.join(linked,'project/workspace-config-history.jsonl'),history(overlay));
  git(linked,'add','--','config/workspace-config.yaml','project/workspace-config-history.jsonl');
  git(linked,'commit','-qm','accept linked provider override');
  const baseSha=git(linked,'rev-parse','HEAD');
  const input={...answers,intendedFiles:['src/notify.js','src/format.js']};
  const assessment=createTaskAssessment({id:'tier2-change',answers:input,coordinationRoot:root,worktreeRoot:linked});
  git(linked,'add','--',assessmentPath);git(linked,'commit','-qm','initial assessment evidence');
  for(const file of input.intendedFiles) {
    const target=path.join(linked,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,`export const value = '${path.basename(file)}';\n`);
  }
  git(linked,'add','--',...input.intendedFiles);git(linked,'commit','-qm','implement Tier 2 change');
  const reviewedCommit=git(linked,'rev-parse','HEAD');
  const current=YAML.parse(fs.readFileSync(path.join(linked,assessmentPath),'utf8'));
  current.reviewEvidence={mode:'independent',...makeReview(reviewedCommit,'reviewer-session')};
  current.roleEvidence=Object.fromEntries(roles.map(role=>[role,makeReview(reviewedCommit,`${role}-reviewer-session`)]));
  fs.writeFileSync(path.join(linked,assessmentPath),YAML.stringify(current,{lineWidth:0}));
  git(linked,'add','--',assessmentPath);git(linked,'commit','-qm','record Tier 2 reviews');
  return {root:linked,coordinationRoot:root,config,baseSha,headSha:git(linked,'rev-parse','HEAD'),headRef:'feature/tier2-check',reviewedCommit,assessment:assessment.record};
}

test('accepts a valid Tier 2 PR with exact reviewed commit and required role evidence',t=>{
  const state=fixture(t);
  const result=validate(state);
  assert.equal(result.tier,2);
  assert.equal(result.status,'passed');
  assert.deepEqual(result.actualFiles,['src/format.js','src/notify.js']);
});

test('check-pr accepts a valid Tier 2 assessment for ordinary application paths',t=>{
  const state=fixture(t);
  const result=runCheckPr(state);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/tier2-change\.yaml: Tier 2 passed/);
});

test('rejects a Tier 1 PR assessment without committed final-check evidence',t=>{
  const input={...answers,scope:'single-file',claimedTier:1,intendedFiles:['src/notify.js']};
  const state=fixture(t,{input});
  assert.throws(()=>validate(state),/Tier 1 final check/);
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

test('rejects implementation changes introduced by a post-review merge commit',t=>{
  const state=fixture(t,{mergeCodeAfterReview:true});
  assert.throws(()=>validate(state),/after reviewedCommit.*task-assessment metadata/);
});

test('rejects implementation committed before preflight even if the intended file changes again later',t=>{
  const state=fixture(t,{beforeAssessmentFiles:['src/notify.js','src/format.js']});
  assert.throws(()=>validate(state),/intended source path.*PR base history/i);
});

test('rejects intended implementation commits forked before preflight and merged afterward',t=>{
  const state=fixture(t,{implementationOnSideBranch:true});
  assert.throws(()=>validate(state),/implementation commit.*does not descend from initial assessment/i);
});

test('rejects intended implementation commits from an orphan root merged after preflight',t=>{
  const state=fixture(t,{implementationOnOrphanRoot:true});
  assert.throws(()=>validate(state),/implementation commit.*does not descend from initial assessment/i);
});

test('accepts a linked-worktree task with an accepted nontrivial policy override',t=>{
  const state=linkedFixture(t);
  const result=validate(state,{repoRoot:state.root});
  assert.equal(result.status,'passed');
  assert.equal(result.tier,2);
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

test('check-pr requires Tier 3 changes to pass the epic-plan gate',t=>{
  const input={...answers,risks:{...risks,auth:true},intendedFiles:['project/src/notify.js','project/src/format.js']};
  const state=fixture(t,{input});
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Tier 3.*epic|epic.*Tier 3/i);
});

test('check-pr does not treat a merged-plan metadata exception as a Tier 3 epic gate',t=>{
  const input={...answers,risks:{...risks,auth:true},intendedFiles:['project/src/notify.js','project/src/format.js']};
  const state=fixture(t,{input,headRef:'epic/EPIC-004'});
  const planDirectory=path.join(state.root,'epics/EPIC-004');
  fs.mkdirSync(planDirectory,{recursive:true});
  const approvals=Object.fromEntries(['principal_engineer','appsec','qa_lead','code_review','appsec_review','accessibility','accessibility_review'].map(role=>[role,null]));
  const plan={kind:'epic-plan',id:'EPIC-004-PLAN',owner:'developer',status:'merged',revision:1,pr_url:'https://github.com/example/repo/pull/4',approvals};
  fs.writeFileSync(path.join(planDirectory,'epic-plan.md'),`---\n${YAML.stringify(plan)}---\n`);
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Tier 3.*successfully validated.*epic plan/i);
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

test('check-pr accepts its exact ready-for-PR Tier 3 plan',t=>{
  const state=tier3Fixture(t);
  const result=runCheckPr(state);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/tier3-change\.yaml: Tier 3 epic-gate-required/);
});

test('check-pr rejects a Tier 3 assessment bound to another valid plan',t=>{
  const state=tier3Fixture(t,{boundPlanId:'EPIC-044'});
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Tier 3.*(branch|named plan|binding)/i);
});

test('check-pr rejects a Tier 3 binding whose named plan ID or revision differs from the loaded plan',t=>{
  for(const options of [{loadedPlanId:'EPIC-043-OTHER'},{loadedPlanRevision:2}]) {
    const state=tier3Fixture(t,options);
    const result=runCheckPr(state);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Tier 3.*plan.*(ID|revision|binding)/i);
  }
});

test('check-pr rejects Tier 3 binding policy provenance that differs from accepted root or worktree evidence',t=>{
  const state=tier3Fixture(t,{policyEdit:policy=>{policy.coordination.digest='a'.repeat(64);policy.worktree.revision=99;}});
  const result=runCheckPr(state);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Tier 3.*policy provenance/i);
});
