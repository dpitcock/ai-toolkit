import assert from 'node:assert/strict';
import test from 'node:test';
import {admitEpic,evaluateCompletion} from '../scripts/lib/epic-completion.mjs';

const submitted='a'.repeat(40),integrated='b'.repeat(40),policy='c'.repeat(64);

function completion(overrides={}) {
 return {
  repository:'dpitcock/ai-toolkit',epic:'EPIC-006',pullRequest:42,
  submittedHead:submitted,integrationSha:integrated,
  host:{source:'authenticated-github-api',observedAt:'2026-09-26T12:00:00.000Z',merged:true,mergeCommit:integrated,
   checks:[{id:'101',name:'governance',status:'completed',conclusion:'success',head:integrated}],
   smoke:{revision:integrated,result:'passed'}},
  policy:{digest:policy,loadedRevision:7},
  findings:{unresolved:[]},documentation:{revision:integrated,current:true},
  activation:{source:'session-harness',observedAt:'2026-09-26T12:01:00.000Z',active:true,agentPath:'codex',resourceIds:['session-1']},
  cleanup:{source:'session-harness',observedAt:'2026-09-26T12:02:00.000Z',revalidated:true,
   worktrees:[{id:'wt-1',path:'/work/epic-006',owner:'EPIC-006',contained:true,clean:true,root:false,symlink:false}],
   branches:[{id:'branch-1',name:'epic/EPIC-006',owner:'EPIC-006',pushed:true}],
   processes:[{id:'process-1',owner:'EPIC-006',contained:true,stopped:true,forced:false}]},
  correctivePullRequests:[],
  ...overrides,
 };
}
function admission(receipt,overrides={}) {
 return {completion:receipt,activeEpics:[],hostObservation:{
  source:'authenticated-github-api',observedAt:'2026-09-26T12:03:00.000Z',repository:receipt.repository,pullRequest:receipt.pullRequest,
  integrationSha:receipt.integrationSha,mergeCommit:receipt.integrationSha,checks:receipt.host.checks,smoke:receipt.host.smoke,
 },...overrides};
}

test('accepts authenticated integration receipts and permits the sequential epic',()=>{
 const result=evaluateCompletion(completion());
 assert.equal(result.complete,true);
 assert.equal(result.receipt.integrationSha,integrated);
 assert.deepEqual(admitEpic(admission(result.receipt),{id:'EPIC-007'}),{admitted:true,epic:'EPIC-007'});
});

test('allows squash or rebase integration SHA distinct from submitted head',()=>{
 assert.equal(evaluateCompletion(completion()).receipt.submittedHead,submitted);
});

test('arbitrary green JSON, pending checks, and intermediate merges cannot admit',()=>{
 assert.throws(()=>evaluateCompletion(completion({host:{source:'fixture',observedAt:'2026-09-26T12:00:00.000Z',merged:true,mergeCommit:integrated,checks:[],smoke:{revision:integrated,result:'passed'}}})),/authenticated/i);
 assert.throws(()=>evaluateCompletion(completion({host:{...completion().host,checks:[{id:'101',name:'gate',status:'in_progress',conclusion:null,head:integrated}]}})),/pending/i);
 assert.throws(()=>evaluateCompletion(completion({host:{...completion().host,mergeCommit:submitted}})),/integration SHA/i);
});

test('incomplete activation or owned cleanup, unresolved findings, and restart fail closed',()=>{
 assert.throws(()=>evaluateCompletion(completion({activation:{...completion().activation,active:false}})),/activation/i);
 assert.throws(()=>evaluateCompletion(completion({cleanup:{...completion().cleanup,worktrees:[{...completion().cleanup.worktrees[0],root:true}]}})),/root|cleanup/i);
 assert.throws(()=>evaluateCompletion(completion({findings:{unresolved:['SEC-1']}})),/findings/i);
 const receipt=evaluateCompletion(completion()).receipt;
 assert.throws(()=>admitEpic(admission(receipt,{activeEpics:['EPIC-006']}),{id:'EPIC-007'}),/active/i);
});

test('a corrective PR or changed integration keeps the same epic active',()=>{
 assert.throws(()=>evaluateCompletion(completion({correctivePullRequests:[43]})),/corrective/i);
 const receipt=evaluateCompletion(completion()).receipt;
 assert.throws(()=>admitEpic(admission(receipt,{currentIntegrationSha:submitted}),{id:'EPIC-007'}),/changed/i);
});

test('deleted state needs recovery and legacy history is an explicit baseline',()=>{
 const receipt=evaluateCompletion(completion()).receipt;
 assert.throws(()=>admitEpic(admission(receipt,{deleted:true}),{id:'EPIC-007'}),/recovery/i);
 assert.throws(()=>admitEpic({historical:true,activeEpics:[]},{id:'EPIC-007'}),/baseline/i);
 assert.deepEqual(admitEpic({historical:true,historicalBaseline:{epic:'EPIC-005',integrationSha:integrated,recordedAt:'2026-09-26T12:00:00.000Z'},activeEpics:[]},{id:'EPIC-007'}),{admitted:true,epic:'EPIC-007',historical:true});
});

test('explicitly observed empty process inventory needs no invented process cleanup',()=>{
 const evidence=completion();evidence.cleanup.processes=[];
 assert.equal(evaluateCompletion(evidence).complete,true);
 delete evidence.cleanup.processes;
 assert.throws(()=>evaluateCompletion(evidence),/processes/i);
});

test('keeps original merge and integrated bookkeeping SHA distinct with bounded host proof',()=>{
 const value=completion();value.host.mergeCommit=submitted;
 value.host.finalization={from:submitted,to:integrated,paths:['epics/EPIC-006/epic-plan.md','epics/EPIC-006/epic.md']};
 const result=evaluateCompletion(value);
 assert.equal(result.receipt.host.mergeCommit,submitted);
 const observed=admission(result.receipt);observed.hostObservation.mergeCommit=submitted;observed.hostObservation.finalization=value.host.finalization;
 assert.equal(admitEpic(observed,{id:'EPIC-007'}).admitted,true);
 value.host.finalization.paths.push('config/workspace-config.yaml');
 assert.throws(()=>evaluateCompletion(value),/finalization/i);
});
