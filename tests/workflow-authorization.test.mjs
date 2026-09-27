import assert from 'node:assert/strict';
import test from 'node:test';
import {decideAction} from '../scripts/lib/workflow-authorization.mjs';

const policy={
  workflow:{autopilot:true},
  provenance:{
    digest:'a'.repeat(64),
    definition:{version:1,digest:'b'.repeat(64)},
    rootAcceptance:'root-acceptance-1',
    worktreeAcceptance:'worktree-acceptance-1'
  }
};
const actor={harness:{authenticated:true,sessionId:'session-1',identity:'agent-1',ownerDecisionIds:['owner-1']}};
const authorization={
  id:'routine-1',repository:'agent-canvas',branch:'epic/EPIC-006',
  scope:['epics/EPIC-006'],allowedActions:['task.dispatch'],
  completionCriteria:['tests-pass'],policy:structuredClone(policy.provenance)
};
const action={repository:'agent-canvas',branch:'epic/EPIC-006',scope:'epics/EPIC-006',name:'task.dispatch',completionCriterion:'tests-pass'};

test('continues a bound routine action without an action item',()=>{
  assert.deepEqual(decideAction({authorization,action,policy,actor}),{
    decision:'continue',reason:'authorized-routine',actionItem:null
  });
});

test('delegates valid routine authority when autopilot is disabled',()=>{
  const disabled=structuredClone(policy);disabled.workflow.autopilot=false;
  assert.deepEqual(decideAction({authorization,action,policy:disabled,actor}),{
    decision:'delegate',reason:'autopilot-disabled',actionItem:null
  });
});

test('requires a trusted harness actor instead of event actor claims',()=>{
  assert.deepEqual(decideAction({authorization,action,policy,actor:'owner'}),{
    decision:'human-needed',reason:'trusted-harness-actor-required',actionItem:null
  });
  assert.deepEqual(decideAction({authorization:{...authorization,allowedActions:['task.deploy'],ownerDecision:{id:'owner-1',ownerId:'owner',allowedActions:['task.deploy']}},action:{...action,name:'task.deploy',effects:['deploy']},policy,actor:{harness:{authenticated:true,sessionId:'session-1',identity:'agent-1',ownerDecisionIds:[]}}}),{
    decision:'human-needed',reason:'trusted-owner-decision-required',actionItem:null
  });
});

test('binds every routine decision to repository branch scope action and completion criterion',()=>{
  for(const changed of [
    {repository:'other'}, {branch:'main'}, {scope:'project'}, {name:'task.other'}, {completionCriterion:'other'}
  ]) {
    const result=decideAction({authorization,action:{...action,...changed},policy,actor});
    assert.equal(result.decision,'human-needed');
  }
});

test('requires an owner decision that covers restricted effects',()=>{
  const deploy={...action,name:'task.deploy',effects:['deploy']};
  assert.deepEqual(decideAction({authorization:{...authorization,allowedActions:['task.deploy']},action:deploy,policy,actor}),{
    decision:'human-needed',reason:'owner-authorization-required',actionItem:null
  });
  const ownerAuthorization={...authorization,allowedActions:['task.deploy'],ownerDecision:{
    id:'owner-1',ownerId:'owner',repository:'agent-canvas',branch:'epic/EPIC-006',scope:['epics/EPIC-006'],
    allowedActions:['task.deploy'],completionCriteria:['tests-pass'],effects:['deploy'],policy:structuredClone(policy.provenance)
  }};
  assert.deepEqual(decideAction({authorization:ownerAuthorization,action:deploy,policy,actor}),{
    decision:'continue',reason:'authorized-owner-decision',actionItem:null
  });
  for(const effects of [['access'],['cost'],['destruction']]) {
    const result=decideAction({authorization:ownerAuthorization,action:{...deploy,effects},policy,actor});
    assert.deepEqual(result,{decision:'human-needed',reason:'owner-authorization-required',actionItem:null});
  }
});

test('policy and authorization provenance fail closed only for the affected action',()=>{
  const stale={...authorization,policy:{...policy.provenance,digest:'c'.repeat(64)}};
  assert.deepEqual(decideAction({authorization:stale,action,policy,actor}),{
    decision:'human-needed',reason:'policy-provenance-mismatch',actionItem:null
  });
  const disabled=structuredClone(policy);disabled.workflow.autopilot=false;
  assert.deepEqual(decideAction({authorization:stale,action,policy:disabled,actor}),{
    decision:'human-needed',reason:'policy-provenance-mismatch',actionItem:null
  });
  assert.equal(decideAction({authorization,action,policy,actor}).decision,'continue');
});

test('stale authorization blocks only its own bound action',()=>{
  assert.deepEqual(decideAction({authorization:{...authorization,status:'revoked'},action,policy,actor}),{
    decision:'human-needed',reason:'authorization-stale',actionItem:null
  });
  assert.equal(decideAction({authorization,action,policy,actor}).decision,'continue');
});

test('does not grant tool permissions',()=>{
  const result=decideAction({authorization,action:{...action,toolPermissions:['shell']},policy,actor});
  assert.deepEqual(result,{decision:'human-needed',reason:'tool-permissions-are-independent',actionItem:null});
});
