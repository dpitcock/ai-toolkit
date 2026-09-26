import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import {handleWorkflowEvent} from '../scripts/workflow-event.mjs';
import {workspaceConfigDigest,workspaceTierDefinition} from '../scripts/lib/workspace-config.mjs';
import {readWorkflowState,withWorkflowState} from '../scripts/lib/workflow-state.mjs';

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
 const overlay={...policy,workspace:{...policy.workspace,provider:'vscode'},worktree_overrides:['workspace.provider']};
 const effective={...policy,workspace:{...policy.workspace,provider:'vscode'}};
 fs.writeFileSync(path.join(worktree,'config/workspace-config.yaml'),YAML.stringify(overlay));fs.writeFileSync(path.join(worktree,'project/workspace-config-history.jsonl'),history(effective));git(worktree,['add','config','project']);git(worktree,['commit','-m','linked policy']);
 const provenance={digest:workspaceConfigDigest(effective),definition:workspaceTierDefinition(effective),rootAcceptance:`workspace:1:${workspaceConfigDigest(policy)}`,worktreeAcceptance:`workspace:1:${workspaceConfigDigest(effective)}`};
 withWorkflowState(worktree,state=>{state.authorizations.routine={id:'routine',repository:'workflow-fixture',branch:'epic/EPIC-999',scope:['epics/EPIC-999'],allowedActions:['epic.start','task.dispatch','review.ready','merge.eligible','epic.complete'],completionCriteria:['workflow-event'],policy:provenance,authorizedBy:'owner'};});
 return {root,worktree};
}
function event(type,fields={}) { return {id:'delivery-1',type,epic:'EPIC-999',authorizationId:'routine',completionCriterion:'workflow-event',...fields}; }

test('runs a bounded routine sequence from internally resolved policy in autopilot and delegated modes',t=>{
 for(const autopilot of [true,false]) {
  const {root,worktree}=fixture(t,{autopilot});
  for(const type of ['epic.start','task.dispatch','review.ready','merge.eligible']) {
   const result=handleWorkflowEvent({root:worktree,event:event(type,{id:`${autopilot}-${type}`} ),actor});
   assert.equal(result.decision,autopilot?'continue':'delegate');assert.equal(result.action.type,type);
  }
  withWorkflowState(worktree,state=>{state.epics['EPIC-999']={completion:{id:'complete-1'}};});
  assert.equal(handleWorkflowEvent({root:worktree,event:event('epic.complete',{id:`${autopilot}-complete`,completionId:'complete-1'}),actor}).decision,autopilot?'continue':'delegate');
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
