import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import YAML from 'yaml';
import {evaluateHostReviewGate} from '../scripts/check-host-reviews.mjs';

const head='a'.repeat(40);
const changedHead='b'.repeat(40);
const identities={
  code_reviewer:{actor:'staff',kind:'human',provenance:{source:'gh-identity',id:'staff-map'},roleEvidence:true},
  appsec:{actor:'security',kind:'human',provenance:{source:'gh-identity',id:'security-map'},roleEvidence:true},
};
function review(id,actor,state='APPROVED',commit_id=head) {
  return {id,user:{login:actor,type:'User'},state,commit_id,submitted_at:`2026-09-26T12:00:0${id}Z`};
}
const passingCheck={id:1,name:'gates',head_sha:head,app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success'};
function gateway({heads=[head,head,head],reviews=[review(1,'staff'),review(2,'security')],checks=[passingCheck]}={}) {
  let index=0;
  return {pull:()=>heads[Math.min(index++,heads.length-1)],reviews:()=>reviews,checks:()=>checks};
}
function input(overrides={}) {
  return {repository:'owner/repo',pr:1,head,stage:'final',requiredRoles:['code_reviewer','appsec'],identities,requiredChecks:['gates'],...overrides};
}

test('re-evaluates a duplicate or out-of-order event against the same exact head',()=>{
  const first=evaluateHostReviewGate({...input(),api:gateway()});
  const duplicate=evaluateHostReviewGate({...input(),api:gateway()});
  assert.deepEqual(duplicate,first);
  assert.equal(first.head,head);
});

test('head races, approval dismissal, and identity mismatches fail closed',()=>{
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({heads:[head,changedHead]})}),/head changed/i);
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({reviews:[review(1,'staff','DISMISSED'),review(2,'security')]})}),/dismissed|approval/i);
  assert.throws(()=>evaluateHostReviewGate({...input({identities:{...identities,appsec:{...identities.appsec,actor:'different'}}}),api:gateway()}),/appsec.*approval/i);
});

test('a missing required status fails closed',()=>{
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({checks:[]})}),/required check.*missing/i);
});

test('trusted workflow runs only base code with scoped permissions',()=>{
  const trusted=YAML.parse(fs.readFileSync('.github/workflows/review-gates.yml','utf8'));
  const candidate=YAML.parse(fs.readFileSync('.github/workflows/workflow.yml','utf8'));
  assert.equal(trusted.on.pull_request_review,undefined);
  assert.deepEqual(trusted.on.workflow_run,{workflows:['workflow'],types:['completed']});
  assert.ok(trusted.on.pull_request_target.types.includes('synchronize'));
  assert.deepEqual(trusted.permissions,{contents:'read','pull-requests':'read',checks:'read',actions:'read',statuses:'write'});
  assert.deepEqual(candidate.permissions,{contents:'read'});
  assert.deepEqual(candidate.on.pull_request_review.types,['submitted','edited','dismissed']);
  assert.equal(candidate.jobs['review-relay'].steps.length,1);
  // A skipped job still creates a check. Its review-event name must not
  // replace the successful CI check used by the trusted publisher.
  assert.equal(candidate.jobs.gates.name,"${{ github.event_name == 'pull_request_review' && 'review-relay-placeholder' || 'gates' }}");
  assert.equal(trusted.jobs['host-review-gate'].steps[0].with.ref,'${{ github.event.repository.default_branch }}');
  assert.equal(trusted.jobs['host-review-gate'].steps[0].with['persist-credentials'],false);
  assert.equal(trusted.jobs['host-review-gate'].steps[0].with['fetch-depth'],0);
  const preparation=trusted.jobs['host-review-gate'].steps.find(step=>step.name==='Prepare trusted validator dependencies');
  assert.equal(preparation.run,'node scripts/install-native-lock.mjs');
  assert.equal(preparation.env,undefined);
  assert.equal(trusted.jobs['host-review-gate'].steps.at(-1).env.GH_TOKEN,'${{ github.token }}');
  assert.deepEqual(trusted.on.workflow_dispatch?.inputs?.bootstrap_pr,{description:'Merged bootstrap PR to verify (diagnostic only)',required:true,type:'string'});
  assert.equal(trusted.jobs['host-review-gate'].name,'Publish host review status');
  assert.match(trusted.jobs['host-review-gate'].if,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  const condition=trusted.jobs['host-review-gate'].if;
  for(const ref of ['refs/heads/epic/EPIC-006','refs/tags/main']) {
    assert.equal(runInNewContext(condition,{github:{event_name:'workflow_dispatch',ref,event:{}}}),false);
  }
  assert.equal(runInNewContext(condition,{github:{event_name:'workflow_dispatch',ref:'refs/heads/main',event:{}}}),true);
});

test('only latest required checks from GitHub Actions at the exact head can pass',()=>{
  for(const patch of [{head_sha:changedHead},{app:{id:7,slug:'github-actions'}},{conclusion:'skipped'},{status:'queued'}]) {
    assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({checks:[{...passingCheck,...patch}]})}));
  }
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({checks:[passingCheck,{...passingCheck,id:2,status:'queued'}]})}));
  assert.doesNotThrow(()=>evaluateHostReviewGate({...input(),api:gateway({checks:[{id:99,name:'host-review-gate',status:'in_progress'},passingCheck]})}));
});

function cli(t,{state='APPROVED',checks=[passingCheck],race=false,auth=true,keychain=false,changedWorkflow=false,wrongRun=false,all=false,
  mode='publish',prNumber='1',closed=false,merged=false,mergeSha='c'.repeat(40),mainSha='d'.repeat(40),comparison='ahead',mainRace=false,mergeRace=false,base='main',baseRepository='owner/repo',throughWorkflow=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'host-gate-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const fixture={head,changedHead,race,changedWorkflow,wrongRun,keychain,closed,merged,mergeSha,mainSha,comparison,mainRace,mergeRace,base,baseRepository,
    checks:checks.map(check=>({check_suite:{id:42},...check})),reviews:[review(1,'staff',state),review(2,'security')]};
  fs.writeFileSync(path.join(dir,'fixture.json'),JSON.stringify(fixture));
  fs.writeFileSync(path.join(dir,'gh'),`#!/usr/bin/env node
const fs=require('fs'),p=require('path');
const root=__dirname,f=JSON.parse(fs.readFileSync(p.join(root,'fixture.json'))),args=process.argv.slice(2);
if(!process.env.GH_TOKEN&&!f.keychain)process.exit(10);
if(args[0]!=='api')process.exit(12);
fs.appendFileSync(p.join(root,'calls'),JSON.stringify(args)+'\\n');
const route=args.find(x=>x.startsWith('repos/'));
let out;
if(args.includes('POST'))out={};
else if(route.includes('/contents/'))out={sha:f.changedWorkflow&&route.includes(f.head)?'different':'trusted'};
else if(route.includes('/check-runs'))out=[{check_runs:f.checks}];
else if(route.includes('/actions/runs?'))out=[{workflow_runs:[{id:9,check_suite_id:route.includes('check_suite_id=41')?41:42,path:f.wrongRun?'.github/workflows/evil.yml':'.github/workflows/workflow.yml',head_sha:f.head,event:'pull_request',status:'completed',conclusion:route.includes('check_suite_id=41')?'failure':'success',repository:{full_name:'owner/repo'}}]}];
else if(route.includes('/reviews'))out=[f.reviews];
else if(route.includes('/pulls?'))out=[[{number:1}]];
else if(route.endsWith('/commits/main')){
 const n=Number(fs.existsSync(p.join(root,'main-count'))?fs.readFileSync(p.join(root,'main-count')):0)+1;
 fs.writeFileSync(p.join(root,'main-count'),String(n));
 out={sha:f.mainRace&&n>(Number.isInteger(f.mainRace)?f.mainRace:1)?'e'.repeat(40):f.mainSha};
}
else if(route.includes('/compare/'))out={status:f.comparison,base_commit:{sha:f.mergeSha},merge_base_commit:{sha:f.mergeSha}};
else if(route.endsWith('/pulls/1')){
 const n=Number(fs.existsSync(p.join(root,'count'))?fs.readFileSync(p.join(root,'count')):0)+1;
 fs.writeFileSync(p.join(root,'count'),String(n));
 out={number:1,state:f.closed?'closed':'open',merged:f.merged,merge_commit_sha:f.mergeRace&&n>2?'f'.repeat(40):f.mergeSha,head:{sha:f.race&&n>2?f.changedHead:f.head},base:{ref:f.base,repo:{full_name:f.baseRepository}}};
}else if(route==='repos/owner/repo')out={default_branch:'main'};
else process.exit(11);
process.stdout.write(JSON.stringify(out));
`,{mode:0o755});
  const commandArgs=['scripts/check-host-reviews.mjs','--repository','owner/repo',...(all?[]:['--pr',prNumber]),'--stage','final','--required-roles','["code_reviewer","appsec"]','--identities',JSON.stringify(identities),'--required-checks','["gates"]',...(mode==='read'?['--head',head]:[`--${mode}`])];
  const workflowScript=YAML.parse(fs.readFileSync('.github/workflows/review-gates.yml','utf8')).jobs['host-review-gate'].steps.at(-1).run;
  const result=spawnSync(throughWorkflow?'bash':process.execPath,throughWorkflow?['-e','-c',workflowScript]:commandArgs,{encoding:'utf8',env:{...process.env,PATH:`${dir}:${process.env.PATH}`,GH_TOKEN:auth?'test-token':'',REPOSITORY:'owner/repo',REQUIRED_ROLES:'["code_reviewer","appsec"]',REVIEW_IDENTITIES:JSON.stringify(identities),EVENT_NAME:mode==='verify-merged'?'workflow_dispatch':'workflow_run',BOOTSTRAP_PR:prNumber}});
  const calls=fs.existsSync(path.join(dir,'calls'))?fs.readFileSync(path.join(dir,'calls'),'utf8').trim().split('\n').map(JSON.parse):[];
  return {...result,calls,posts:calls.filter(call=>call.includes('POST'))};
}

test('authenticated CLI publishes pending then success on the API-resolved head',t=>{
  const result=cli(t);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.posts.length,2);
  for(const call of result.posts){assert.ok(call.includes(`repos/owner/repo/statuses/${head}`));assert.ok(call.includes('context=host-review-gate'));}
  assert.ok(result.posts[0].includes('state=pending'));
  assert.ok(result.posts[1].includes('state=success'));
});

for(const [name,options] of [['dismissed',{state:'DISMISSED'}],['rejected',{state:'CHANGES_REQUESTED'}],['pending',{checks:[{...passingCheck,status:'queued'}]}],['missing',{checks:[]}],['raced',{race:true}],['candidate workflow',{changedWorkflow:true}],['forged workflow check',{wrongRun:true}]]) {
  test(`CLI publishes failure for ${name} evidence`,t=>{
    const result=cli(t,options);
    assert.notEqual(result.status,0);
    assert.ok(result.posts.at(-1)?.includes('state=failure'),result.stderr);
    assert.ok(result.posts.at(-1)?.includes(`repos/owner/repo/statuses/${head}`));
  });
}
test('CLI refuses unauthenticated execution without host writes',t=>{
  const result=cli(t,{auth:false});
  assert.notEqual(result.status,0);
  assert.equal(result.posts.length,0);
});
test('workflow completion wakeups revalidate all live PRs without trusting event metadata',t=>{
  const result=cli(t,{all:true});
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.calls.some(call=>call.includes('repos/owner/repo/pulls?state=open&base=main&per_page=100')));
  assert.ok(result.posts.at(-1).includes('state=success'));
});
test('a newer successful rerun supersedes an older failed required check',t=>{
  const result=cli(t,{checks:[{...passingCheck,conclusion:'failure',check_suite:{id:41}},{...passingCheck,id:2}]});
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.posts.at(-1).includes('state=success'));
});

test('local read-only gate accepts stored gh authentication without token extraction',t=>{
  const result=cli(t,{auth:false,keychain:true,mode:'read'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.posts.length,0);
  assert.ok(result.calls.length>0);
  assert.ok(result.calls.every(call=>call[0]==='api'));
});

test('ordinary publisher continues to reject a closed merged PR',t=>{
  const result=cli(t,{closed:true,merged:true});
  assert.notEqual(result.status,0);
  assert.equal(result.posts.length,0);
});

test('merged verification publishes diagnostic status on submitted head after squash/rebase integration',t=>{
  const result=cli(t,{mode:'verify-merged',closed:true,merged:true});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.posts.length,2);
  assert.ok(result.posts.every(call=>call.includes(`repos/owner/repo/statuses/${head}`)));
  assert.ok(result.posts.at(-1).includes('state=success'));
  assert.ok(result.posts.at(-1).includes('description=Integrated publisher verification (diagnostic): success'));
  const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.kind,'integrated-host-gate-verification');
  assert.equal(receipt.submittedHead,head);
  assert.equal(receipt.integrationSha,'c'.repeat(40));
  assert.equal(receipt.mainSha,'d'.repeat(40));
  assert.equal(receipt.statusContext,'host-review-gate');
  assert.equal(receipt.diagnostic,true);
  assert.ok(result.calls.some(call=>call.includes(`repos/owner/repo/compare/${'c'.repeat(40)}...${'d'.repeat(40)}`)));
});

test('actual workflow shell routes manual merged verification with quoted PR input',t=>{
  const result=cli(t,{mode:'verify-merged',closed:true,merged:true,throughWorkflow:true});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).kind,'integrated-host-gate-verification');
});

test('actual workflow shell keeps completion events on ordinary open-PR mode',t=>{
  const result=cli(t,{all:true,throughWorkflow:true});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).kind,undefined);
  assert.ok(result.calls.some(call=>call.includes('repos/owner/repo/pulls?state=open&base=main&per_page=100')));
});

test('main race after successful publication revokes the diagnostic status',t=>{
  const result=cli(t,{mode:'verify-merged',closed:true,merged:true,mainRace:2});
  assert.notEqual(result.status,0);
  assert.ok(result.posts.some(call=>call.includes('state=success')));
  assert.ok(result.posts.at(-1).includes('state=failure'));
  assert.equal(result.stdout,'');
});

for(const [name,patch] of [['open',{closed:false}],['closed but not merged',{merged:false}],['wrong base',{base:'other'}],['wrong repository',{baseRepository:'other/repo'}],['missing integration',{mergeSha:null}],['not integrated',{comparison:'diverged'}],['main race',{mainRace:true}],['integration race',{mergeRace:true}],['head race',{race:true}],['dismissed review',{state:'DISMISSED'}],['pending checks',{checks:[{...passingCheck,status:'queued'}]}],['candidate workflow',{changedWorkflow:true}]]) {
  test(`merged verification fails closed for ${name}`,t=>{
    const result=cli(t,{mode:'verify-merged',closed:true,merged:true,...patch});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Host review gate failed|Host review evidence/);
    if(['open','closed but not merged','wrong base','wrong repository'].includes(name)) assert.equal(result.posts.length,0);
    else assert.ok(result.posts.at(-1)?.includes('state=failure'));
  });
}
for(const prNumber of ['0','-1','1.5','1e2','abc']) {
  test(`merged verification rejects invalid PR input ${prNumber} before API calls`,t=>{
    const result=cli(t,{mode:'verify-merged',closed:true,merged:true,prNumber});
    assert.notEqual(result.status,0);
    assert.equal(result.calls.length,0);
  });
}
