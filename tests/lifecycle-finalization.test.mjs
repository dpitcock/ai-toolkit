import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,git,exerciseLifecycle} from './helpers/lifecycle-fixture.mjs';

test('real merged CLI authenticates host merge and submitted-head reviews before writing',t=>{
 const f=fixture(t);
 const result=f.run('check-gate.mjs',['epics/EPIC-999/epic-plan.md','merged','--write']);
 assert.equal(result.status,0,result.stderr);assert.match(fs.readFileSync(path.join(f.root,'epics/EPIC-999/epic-plan.md'),'utf8'),/status: merged/);
 const epic=f.run('check-gate.mjs',['epics/EPIC-999/epic.md','merged','--write']);assert.equal(epic.status,0,epic.stderr);
});
test('real check-pr admits only authenticated postmerge markers',t=>{
 const f=fixture(t),head=f.finalize();
 const result=f.run('check-pr.mjs',[],{BASE_SHA:f.merged,HEAD_SHA:head,HEAD_REF:'epic/EPIC-999'});
 assert.equal(result.status,0,result.stderr);
});

test('integrated main can advance through verified bookkeeping while preserving original merge',t=>{
 const f=fixture(t),head=f.finalize();f.host.main=head;f.host.publication={head,state:'closed'};f.saveHost();
 const observed=f.script(`import {observeEpicIntegration} from './scripts/lib/epic-integration.mjs';console.log(JSON.stringify(observeEpicIntegration(${JSON.stringify({repository:'example/repo',epic:'EPIC-999',pullRequest:7,submittedHead:f.submitted,integrationSha:head,host:{mergeCommit:f.merged,smoke:{revision:head,result:'passed'}}})})));`);
 assert.equal(observed.status,0,observed.stderr);const receipt=JSON.parse(observed.stdout);
 assert.equal(receipt.mergeCommit,f.merged);assert.equal(receipt.integrationSha,head);assert.equal(receipt.finalization.paths.length,2);
});

test('a direct bookkeeping push cannot stand in for a merged finalization PR',t=>{
 const f=fixture(t),head=f.finalize();f.host.main=head;f.saveHost();
 const result=f.script(`import {observeEpicIntegration} from './scripts/lib/epic-integration.mjs';observeEpicIntegration(${JSON.stringify({repository:'example/repo',epic:'EPIC-999',pullRequest:7,submittedHead:f.submitted,integrationSha:head,host:{mergeCommit:f.merged,smoke:{revision:head,result:'passed'}}})});`);
 assert.equal(result.status,1,result.stdout);assert.match(result.stderr,/finalization PR/i);
});

test('real merged CLI rejects unmerged, wrong repository, stale/dismissed reviews, pending checks and races without writing',t=>{
 for(const [mutation,reason] of [[{mergedState:false},/original PR is not confirmed merged/],[{reviews:false},/no effective approval/],[{checks:false},/check gates is pending or did not pass/],[{repository:'wrong/repo'},/original PR is not confirmed merged/],[{reviewHead:'c'.repeat(40)},/no effective approval/],[{reviewState:'DISMISSED'},/approval is dismissed/],[{checkStatus:'in_progress'},/check gates is pending/],[{race:true},/merged host state changed during observation/]]) {
  const f=fixture(t);Object.assign(f.host,mutation);f.saveHost();
  const result=f.run('check-gate.mjs',['epics/EPIC-999/epic-plan.md','merged','--write']);
  assert.equal(result.status,1);assert.match(result.stderr,reason);assert.match(fs.readFileSync(path.join(f.root,'epics/EPIC-999/epic-plan.md'),'utf8'),/status: ready-for-pr/);
  if(mutation.race) assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,'.host/state.json'),'utf8')).mainReads,2,'race is rejected after the second real host observation');
 }
});

test('real finalization PR checks reject source, policy, body, approval, task and assessment changes',t=>{
 const changes=[
  f=>fs.appendFileSync(path.join(f.root,'source.mjs'),'export const changed = true;\n'),
  f=>fs.appendFileSync(path.join(f.root,'config/policy'),'unauthorized change\n'),
  f=>fs.appendFileSync(path.join(f.root,'epics/EPIC-999/epic-plan.md'),'New scope\n'),
  f=>{const file=path.join(f.root,'epics/EPIC-999/epic-plan.md');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('approvals:','# New instructions\napprovals:'));},
  f=>{f.docs['epics/EPIC-999/epic-plan.md'].approvals.appsec_review.by='other';f.save();},
  f=>{f.docs['epics/EPIC-999/tasks/TASK-001.md'].evidence.qa='Different evidence';f.save();},
  f=>{fs.mkdirSync(path.join(f.root,'project/task-assessments'));fs.writeFileSync(path.join(f.root,'project/task-assessments/new.yaml'),'tier: 3\n');},
 ];
 for(const mutate of changes) {
  const f=fixture(t);f.finalize();mutate(f);git(f.root,['add','.']);git(f.root,['commit','-m','Rejected mutation']);
  const head=git(f.root,['rev-parse','HEAD']);
  const result=f.run('check-pr.mjs',[],{BASE_SHA:f.merged,HEAD_SHA:head,HEAD_REF:'epic/EPIC-999'});assert.equal(result.status,1,result.stdout);
  const pre=f.run('check-gate.mjs',['epics/EPIC-999/epic-plan.md','finalization-pr']);assert.equal(pre.status,1,pre.stdout);
  assert.match(result.stderr,/only same-epic status|reviewed body, scope, approvals and evidence|cannot authorize a Tier 3 assessment/);
  assert.match(pre.stderr,/only same-epic status|reviewed body, scope, approvals and evidence/);
 }
});

test('real finalization pre-PR gate authenticates original merge and rejects an unmerged original',t=>{
 const f=fixture(t);f.finalize();
 const args=['epics/EPIC-999/epic-plan.md','finalization-pr'];
 const allowed=f.run('check-gate.mjs',args);assert.equal(allowed.status,0,allowed.stderr);
 f.host.mergedState=false;f.saveHost();const rejected=f.run('check-gate.mjs',args);assert.equal(rejected.status,1);assert.match(rejected.stderr,/original PR is not confirmed merged/);
});

test('generated lifecycle preserves original PR while publishing finalization verdicts and completing at new main',t=>{
 exerciseLifecycle(fixture(t));
});
