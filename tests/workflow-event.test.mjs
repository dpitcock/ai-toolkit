import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import {handleWorkflowEvent} from '../scripts/workflow-event.mjs';
import {workspaceConfigDigest,workspaceTierDefinition} from '../scripts/lib/workspace-config.mjs';
import {readWorkflowState,withWorkflowState} from '../scripts/lib/workflow-state.mjs';
import {reserveEpicProvisioning} from '../scripts/lib/workflow-admission.mjs';

const sha='a'.repeat(40);
const config={workspace:{repository:'workflow-fixture',environment:'test',provider:'codex',slack_channel_name:'ws-workflow-fixture-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tier:'tier_1',tier_overrides:{direct_merge:false},workflow:{autopilot:true}};
const actor={harness:{authenticated:true,sessionId:'session-1',identity:'agent-1',ownerDecisionIds:[]}};

function git(root,args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function history(value) { const digest=workspaceConfigDigest(value),definition=workspaceTierDefinition(value);return `${JSON.stringify({kind:'proposal',digest,revision:1,date:'2026-09-26',config:value,reasons:{fixture:'fixture'},definition})}\n${JSON.stringify({kind:'acceptance',digest,revision:1,date:'2026-09-26',by:'owner',reason:'fixture',changes:[],definition})}\n`; }
function fixture(t,{autopilot=true}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-event-')),worktree=`${root}-epic`;
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));t.after(()=>fs.rmSync(worktree,{recursive:true,force:true}));
 const policy=structuredClone(config);policy.workflow.autopilot=autopilot;
 fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'project'),{recursive:true});
 fs.writeFileSync(path.join(root,'README.md'),'fixture\n');fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(policy));fs.writeFileSync(path.join(root,'project/workspace-config-history.jsonl'),history(policy));
 git(root,['init','--initial-branch=main']);git(root,['config','user.email','tests@example.test']);git(root,['config','user.name','Tests']);git(root,['add','.']);git(root,['commit','-m','fixture']);git(root,['worktree','add','-b','epic/EPIC-999',worktree]);
 git(root,['remote','add','origin','https://github.com/fixture/workflow-fixture.git']);
 const overlay={...policy,workspace:{...policy.workspace,provider:'vscode'},worktree_overrides:['workspace.provider']};
 const effective={...policy,workspace:{...policy.workspace,provider:'vscode'}};
 fs.writeFileSync(path.join(worktree,'config/workspace-config.yaml'),YAML.stringify(overlay));fs.writeFileSync(path.join(worktree,'project/workspace-config-history.jsonl'),history(overlay));git(worktree,['add','config','project']);git(worktree,['commit','-m','linked policy']);
 const provenance={digest:workspaceConfigDigest(effective),definition:workspaceTierDefinition(effective),rootAcceptance:`workspace:1:${workspaceConfigDigest(policy)}`,worktreeAcceptance:`workspace:1:${workspaceConfigDigest(overlay)}`};
 withWorkflowState(worktree,state=>{state.authorizations.routine={id:'routine',repository:'fixture/workflow-fixture',branch:'epic/EPIC-999',scope:['epics/EPIC-999'],allowedActions:['epic.start','task.dispatch','review.ready','merge.eligible','epic.complete'],completionCriteria:['workflow-event'],policy:provenance,authorizedBy:'owner'};});
 const canonical=governance(worktree);
 return {root,worktree,...canonical};
}
function event(type,fields={}) { return {id:'delivery-1',type,epic:'EPIC-999',authorizationId:'routine',completionCriterion:'workflow-event',...(type==='task.dispatch'?{task:'TASK-001'}:{}),...fields}; }

function governance(worktree) {
 const approval={by:'independent-reviewer',date:'2026-09-26',notes:'Fixture review',revision:1};
 const base={owner:'developer',revision:1,approvals:{principal_engineer:approval,appsec:'not-required',qa_lead:approval,code_review:null,appsec_review:null,accessibility:null,accessibility_review:null}};
 const security={auth:false,data:false,external:false,concerns:[],rationale:'Fixture scope'};
 const accessibility={ui:false,rationale:'No user interface'};
 const docs={
  'project/project-plan.md':{...structuredClone(base),kind:'project',id:'PROJECT',status:'approved'},
  'epics/EPIC-999/epic.md':{...structuredClone(base),kind:'epic',id:'EPIC-999',status:'in-progress',parent:'../../project/project-plan.md',parent_revision:1,security,accessibility,qa_requirements:['Fixture QA']},
  'epics/EPIC-999/epic-plan.md':{...structuredClone(base),kind:'epic-plan',id:'EPIC-999-PLAN',status:'in-progress',parent:'epic.md',parent_revision:1,security,accessibility,touches_concerns:[],tasks:['tasks/TASK-001.md'],review_comments:[]},
  'epics/EPIC-999/tasks/TASK-001.md':{...structuredClone(base),kind:'task',id:'TASK-001',status:'approved',parent:'../epic-plan.md',parent_revision:1,depends_on:[]},
 };
 const save=()=>{for(const [name,data] of Object.entries(docs)) {fs.mkdirSync(path.dirname(path.join(worktree,name)),{recursive:true});fs.writeFileSync(path.join(worktree,name),`---\n${YAML.stringify(data,{aliasDuplicateObjects:false})}---\n`);}};
 save();return {docs,save,approval};
}

test('task dispatch requires canonical eligible task and satisfied dependencies',t=>{
 const {worktree}=fixture(t);const {docs,save}=governance(worktree);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{task:undefined}),actor}),/task/i);
 const task=docs['epics/EPIC-999/tasks/TASK-001.md'];task.status='done';save();
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{task:'TASK-001'}),actor}),/eligible|status|done/i);
 task.status='approved';task.depends_on=['tasks/TASK-002.md'];save();
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{task:'TASK-001'}),actor}),/dependency/i);
 task.depends_on=[];save();
 assert.equal(handleWorkflowEvent({root:worktree,event:event('task.dispatch',{task:'TASK-001'}),actor}).decision,'continue');
});

test('review and merge readiness cannot bypass canonical stage or host checks',t=>{
 const {worktree}=fixture(t);governance(worktree);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('review.ready'),actor}),/review|done/i);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('merge.eligible'),actor}),/ready-for-pr/i);
});

test('completion IDs do not replace observed typed evidence and fresh host facts',t=>{
 const {worktree}=fixture(t);governance(worktree);
 withWorkflowState(worktree,state=>{state.epics['EPIC-999']={active:true,completion:{id:'fabricated'}};});
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.complete',{completionId:'fabricated'}),actor}),/completion|merged/i);
 assert.equal(readWorkflowState(worktree).epics['EPIC-999'].active,true);
});

test('runs a bounded routine sequence from internally resolved policy in autopilot and delegated modes',t=>{
 for(const autopilot of [true,false]) {
  const {root,worktree,docs,save}=fixture(t,{autopilot});
  for(const type of ['epic.start','task.dispatch']) {
   const result=handleWorkflowEvent({root:worktree,event:event(type,{id:`${autopilot}-${type}`} ),actor});
   assert.equal(result.decision,autopilot?'continue':'delegate');assert.equal(result.action.type,type);
  }
  docs['epics/EPIC-999/tasks/TASK-001.md'].status='done';
  docs['epics/EPIC-999/tasks/TASK-001.md'].evidence={red:'Expected failure',green:'Passed test',qa:'Passed QA',commit:sha};
  docs['epics/EPIC-999/epic-plan.md'].status='in-review';save();
  const review=handleWorkflowEvent({root:worktree,event:event('review.ready',{id:`${autopilot}-review`}),actor});
  assert.equal(review.decision,autopilot?'continue':'delegate');assert.deepEqual(review.review.roles,['code_reviewer']);
  assert.equal(review.review.stage,'local');assert.deepEqual(readWorkflowState(root).reviews,{});
  assert.equal(readWorkflowState(root).dispatches[`${autopilot}-task.dispatch`].event.type,'task.dispatch');
 }
});

test('rejects caller identity, mismatched branch or repository, and duplicate delivery without rerunning it',t=>{
 const {worktree}=fixture(t);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{actor:'owner'}),actor}),/actor|malformed/i);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{branch:'main'}),actor}),/branch/i);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('task.dispatch',{repository:'other'}),actor}),/repository/i);
 const first=handleWorkflowEvent({root:worktree,event:event('task.dispatch'),actor});
 const replay=handleWorkflowEvent({root:worktree,event:event('task.dispatch'),actor});
 assert.deepEqual(replay,first);
});

test('serializes concurrent epic admission and fails closed for missing completion evidence',t=>{
 const {worktree}=fixture(t);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.complete',{completionId:'absent'}),actor}),/completion/i);
 handleWorkflowEvent({root:worktree,event:event('epic.start'),actor});
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.start',{id:'another'}),actor}),/already active/i);
});

test('cached delivery rechecks revocation and the current actor without lifecycle effects',t=>{
 const {worktree}=fixture(t);
 handleWorkflowEvent({root:worktree,event:event('epic.start'),actor});
 withWorkflowState(worktree,state=>{state.authorizations.routine.status='revoked';});
 assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}).decision,'human-needed');
 withWorkflowState(worktree,state=>{state.authorizations.routine.status='active';});
 assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.start'),actor:{harness:{...actor.harness,identity:'owner'}}}).decision,'human-needed');
});

test('denied start leaves no active epic or successful dispatch behind',t=>{
 const {worktree}=fixture(t);
 withWorkflowState(worktree,state=>{state.authorizations.routine.status='revoked';});
 assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}).decision,'human-needed');
 assert.equal(readWorkflowState(worktree).epics['EPIC-999'],undefined);
 assert.equal(readWorkflowState(worktree).dispatches['delivery-1'],undefined);
});

test('executable CLI cannot authenticate environment JSON and emits a structured denial',t=>{
 const {worktree}=fixture(t);
 const result=spawnSync(process.execPath,[path.resolve('scripts/workflow-event.mjs'),'epic.start','--root',worktree],{input:JSON.stringify(event('epic.start')),encoding:'utf8',env:{...process.env,WORKFLOW_HARNESS_ACTOR:JSON.stringify(actor)}});
 assert.equal(result.status,1);
 assert.equal(JSON.parse(result.stdout).decision,'human-needed');
 assert.equal(readWorkflowState(worktree).epics['EPIC-999'],undefined);
});

test('repository identity is the registered checkout origin, never the accepted slug alone',t=>{
 const {root,worktree}=fixture(t);
 git(root,['remote','set-url','origin','https://github.com/attacker/other.git']);
 assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}).reason,'authorization-scope-mismatch');
});

test('epic start blocks an incomplete predecessor and missing runtime completion after restart',t=>{
 const {worktree}=fixture(t);
 const prior=path.join(worktree,'epics/EPIC-998');fs.mkdirSync(prior,{recursive:true});
 const data=governance(worktree).docs['epics/EPIC-999/epic.md'];
 const save=status=>fs.writeFileSync(path.join(prior,'epic.md'),`---\n${YAML.stringify({...data,id:'EPIC-998',status},{aliasDuplicateObjects:false})}---\n`);
 save('in-progress');
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}),/predecessor|active|incomplete/i);
 save('merged');
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}),/completion|recovery/i);
 withWorkflowState(worktree,state=>{state.epics['EPIC-998']={historicalBaseline:{epic:'EPIC-998',integrationSha:sha,recordedAt:'2026-09-26T00:00:00Z'}};});
 assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}).decision,'continue');
});

test('new-epic executable refuses an active predecessor before provisioning',t=>{
 const {root}=fixture(t);
 fs.cpSync(path.resolve('scripts'),path.join(root,'scripts'),{recursive:true});
 fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
 const skill=path.join(root,'skills/upstream/superpowers/skills/using-git-worktrees');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'SKILL.md'),'Fixture worktree method\n');
 governance(root);fs.writeFileSync(path.join(root,'.gitignore'),'.worktrees/\nnode_modules/\n');
 git(root,['add','.']);git(root,['commit','-m','Fixture tooling']);
 const result=spawnSync('bash',['scripts/new-epic.sh','EPIC-1000'],{cwd:root,encoding:'utf8',env:{...process.env,PATH:process.env.PATH}});
 assert.equal(result.status,1);assert.match(result.stderr,/predecessor|active|incomplete/i);
 assert.equal(fs.existsSync(path.join(root,'.worktrees/EPIC-1000')),false);
 assert.equal(git(root,['branch','--list','epic/EPIC-1000']),'');
});

function readyFixture(t,options={}) {
 const f=fixture(t,options),plan=f.docs['epics/EPIC-999/epic-plan.md'],task=f.docs['epics/EPIC-999/tasks/TASK-001.md'];
 task.status='done';task.evidence={red:'Observed failing test',green:'Passing test',qa:'Passing QA',commit:sha};
 plan.status='in-review';f.save();git(f.worktree,['add','.']);git(f.worktree,['commit','-m','Completed implementation']);
 const head=git(f.worktree,['rev-parse','HEAD']);
 const repository='fixture/workflow-fixture',pr=7;
 const identities=Object.fromEntries(['code_reviewer','appsec'].map(role=>[role,{actor:role,kind:'human',roleEvidence:true,provenance:{source:'controller-fixture',id:role}}]));
 const api={pull:()=>head,checks:()=>[{id:1,name:'gates',head_sha:head,status:'completed',conclusion:'success',app:{id:15368,slug:'github-actions'}}],reviews:()=>['code_reviewer','appsec'].map((role,index)=>({id:index+1,user:{login:role,type:'User'},state:'APPROVED',commit_id:head,submitted_at:`2026-09-26T12:00:0${index}Z`}))};
 return {...f,plan,head,repository,pr,observers:{pullRequest:()=>({repository,pr,head,state:'open',base:'main',headBranch:'epic/EPIC-999'}),reviewAuthority:()=>({identities,api})}};
}

test('host-ready review claims are durable and deduplicate role/PR/head, including replay',t=>{
 const f=readyFixture(t);f.plan.pr_url=`https://github.com/${f.repository}/pull/${f.pr}`;f.plan.status='ready-for-pr';f.plan.review_commit=f.head;
 for(const role of ['code_review','appsec_review']) f.plan.approvals[role]={...f.approval,commit:f.head};f.save();
 const run=id=>handleWorkflowEvent({root:f.worktree,event:event('review.ready',{id}),actor,observers:f.observers});
 const first=run('ready-1'),second=run('ready-2');
 assert.deepEqual(first.review.claims,second.review.claims);assert.equal(first.review.claims.length,2);
 assert.equal(Object.keys(readWorkflowState(f.worktree).reviews).length,2);
 f.observers.pullRequest=()=>({repository:f.repository,pr:f.pr,head:'c'.repeat(40)});
 assert.throws(()=>run('ready-1'),/current PR head/i);
});

test('both modes require live exact-head reviews for merge even on cached delivery',t=>{
 for(const autopilot of [true,false]) {
  const f=readyFixture(t,{autopilot});f.plan.status='ready-for-pr';f.plan.pr_url=`https://github.com/${f.repository}/pull/${f.pr}`;f.plan.review_commit=f.head;
  for(const role of ['code_review','appsec_review']) f.plan.approvals[role]={...f.approval,commit:f.head};f.save();
  const run=()=>handleWorkflowEvent({root:f.worktree,event:event('merge.eligible'),actor,observers:f.observers});
  assert.equal(run().decision,autopilot?'continue':'delegate');
  f.observers.reviewAuthority().api.reviews=()=>[];
  assert.throws(run,/approval/i);
 }
});

test('completed local reviews can publish verified verdicts at ready-for-pr without reopening',t=>{
 const f=readyFixture(t);f.plan.status='ready-for-pr';f.plan.pr_url=`https://github.com/${f.repository}/pull/${f.pr}`;f.plan.review_commit=f.head;
 for(const role of ['code_review','appsec_review']) f.plan.approvals[role]={...f.approval,commit:f.head};f.save();
 f.observers.pullRequest=()=>({repository:f.repository,pr:f.pr,head:f.head,state:'open',base:'main',headBranch:'epic/EPIC-999'});
 const result=handleWorkflowEvent({root:f.worktree,event:event('review.ready'),actor,observers:f.observers});
 assert.deepEqual(result.review.roles,['code_reviewer','appsec']);assert.equal(result.review.purpose,'publish-completed-verdicts');
 assert.equal(f.plan.status,'ready-for-pr');
});

test('both modes complete from typed observations, revalidate replay, and admit only fresh integration',t=>{
 for(const autopilot of [true,false]) {
  const f=readyFixture(t,{autopilot});f.plan.status='merged';f.plan.pr_url=`https://github.com/${f.repository}/pull/${f.pr}`;f.save();
  const policy=readWorkflowState(f.worktree).authorizations.routine.policy;
  const evidence={repository:f.repository,epic:'EPIC-999',pullRequest:f.pr,submittedHead:f.head,integrationSha:sha,
   host:{source:'authenticated-github-api',observedAt:new Date().toISOString(),merged:true,mergeCommit:sha,checks:[{id:'1',name:'gates',status:'completed',conclusion:'success',head:sha}],smoke:{revision:sha,result:'passed'}},
   policy:{digest:policy.digest,loadedRevision:1},findings:{unresolved:[]},documentation:{revision:sha,current:true},activation:{source:'session-harness',observedAt:new Date().toISOString(),active:true,agentPath:'test',resourceIds:['test-session']},cleanup:{source:'session-harness',observedAt:new Date().toISOString(),revalidated:true,worktrees:[],branches:[],processes:[]},correctivePullRequests:[]};
  let reads=0;f.observers.completion=()=>evidence;f.observers.integration=receipt=>{reads++;return {source:'authenticated-github-api',observedAt:new Date().toISOString(),repository:f.repository,pullRequest:f.pr,integrationSha:receipt.integrationSha,mergeCommit:sha,checks:receipt.host.checks,smoke:receipt.host.smoke};};
  const run=()=>handleWorkflowEvent({root:f.worktree,event:event('epic.complete',{completionId:'complete-1'}),actor,observers:f.observers});
  assert.equal(run().decision,autopilot?'continue':'delegate');assert.equal(readWorkflowState(f.worktree).epics['EPIC-999'].completed,true);
  run();assert.equal(reads,2);
  f.docs['epics/EPIC-999/epic.md'].status='merged';f.save();
  assert.equal(reserveEpicProvisioning({root:f.root,epic:'EPIC-1000',observeIntegration:f.observers.integration}).admitted,true);
  assert.throws(()=>reserveEpicProvisioning({root:f.root,epic:'EPIC-1001',observeIntegration:f.observers.integration}),/active/i);
  assert.throws(()=>reserveEpicProvisioning({root:f.root,epic:'EPIC-1000',observeIntegration:f.observers.integration}),/reconcile/i);
  f.observers.integration=()=>{throw new Error('Host unavailable');};assert.throws(run,/unavailable/i);
 }
});

test('embedded CLI uses controller context outside bounded stdin, with initializer-compatible acceptance',t=>{
 const {worktree}=fixture(t);
 const status=spawnSync(process.execPath,[path.resolve('scripts/init-workspace.mjs'),'status','--root',worktree],{encoding:'utf8'});
 assert.equal(status.status,0,status.stderr);
 const moduleUrl=new URL('../scripts/workflow-event.mjs',import.meta.url).href;
 const wrapper=`import {runWorkflowEvent} from ${JSON.stringify(moduleUrl)}; await runWorkflowEvent(process.argv.slice(1), {actor:${JSON.stringify(actor)}});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',wrapper,'task.dispatch','--root',worktree],{input:JSON.stringify(event('task.dispatch')),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).decision,'continue');
});

test('orphan predecessor branch cannot become a fresh project after state deletion',t=>{
 const {root,worktree}=fixture(t);
 git(root,['branch','epic/EPIC-998']);
 assert.throws(()=>handleWorkflowEvent({root:worktree,event:event('epic.start'),actor}),/completion|recovery|predecessor/i);
});

test('a genuine first project reserves provisioning and retains failed setup for recovery',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'first-epic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 git(root,['init','--initial-branch=main']);git(root,['config','user.email','tests@example.test']);git(root,['config','user.name','Tests']);git(root,['commit','--allow-empty','-m','Initial project']);
 assert.equal(reserveEpicProvisioning({root,epic:'EPIC-001'}).firstProject,true);
 assert.throws(()=>reserveEpicProvisioning({root,epic:'EPIC-002'}),/active/i);
 assert.throws(()=>reserveEpicProvisioning({root,epic:'EPIC-001'}),/reconcile/i);
});
