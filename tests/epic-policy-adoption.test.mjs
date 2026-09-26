import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as adoption from '../scripts/lib/epic-policy-adoption.mjs';
import {readWorkflowState,withWorkflowState} from '../scripts/lib/workflow-state.mjs';
import {check} from '../scripts/check-gate.mjs';

const source=fileURLToPath(new URL('..',import.meta.url));
const historicalImplementation='b2b742b066615a860bc82c74c430778a56b676d8';
const policy=['config/workspace-config.yaml','project/workspace-config-history.jsonl'];
const candidate='project/EPIC-006-root-migration.yaml';
const digest='7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd';
const repository='dpitcock/ai-toolkit';
function git(root,...args) {return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
function commit(f,message='fixture evidence') {git(f.root,'add','-A');git(f.root,'commit','--quiet','-m',message);return git(f.root,'rev-parse','HEAD');}
function edit(f,name,change) {const file=path.join(f.root,name);fs.writeFileSync(file,change(fs.readFileSync(file,'utf8')));}
function fixture(t,{originalSquash=false}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'policy-adoption-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 git(root,'clone','--quiet','--shared','--no-checkout',source,'.');
 git(root,'checkout','--quiet','-B','epic/EPIC-006',historicalImplementation);
 git(root,'remote','set-url','origin','https://github.com/dpitcock/ai-toolkit.git');
 git(root,'config','user.name','Controlled adoption fixture');git(root,'config','user.email','fixture@example.test');
 const f={root};
 // H0 is historical evidence; execute today's initializer and shipped ignore rule.
 fs.copyFileSync(path.join(source,'.gitignore'),path.join(root,'.gitignore'));
 edit(f,'epics/EPIC-006/epic-plan.md',text=>text.replace('status: in-progress','status: ready-for-pr'));
 const originalBase=git(root,'rev-parse','HEAD');
 f.h0=commit(f,'fixture original submission');f.m=f.h0;
 if(originalSquash) {
  f.m=git(root,'commit-tree',`${f.h0}^{tree}`,'-p',originalBase,'-m','fixture original squash');
  git(root,'reset','--hard',f.m);
 }
 for(const name of ['epic-plan.md','epic.md']) edit(f,`epics/EPIC-006/${name}`,text=>{
  const changed=text.replace(/status: (ready-for-pr|in-progress)/,'status: merged');
  return changed.includes('pr_url: null')?changed.replace('pr_url: null','pr_url: https://github.com/dpitcock/ai-toolkit/pull/10'):changed.replace('\n---\n','\npr_url: https://github.com/dpitcock/ai-toolkit/pull/10\n---\n');
 });
 f.f=commit(f,'fixture status integration');
 const initialize=(...args)=>JSON.parse(execFileSync(process.execPath,[path.join(source,'scripts/init-workspace.mjs'),...args,'--root',root],{encoding:'utf8'}));
 const change=initialize('propose-change','--candidate',candidate);
 assert.equal(change.digest,digest);
 const accepted=initialize('apply-change','--candidate',candidate,'--by','actual fixture owner','--reason','Controlled fixture canonical adoption','--digest',change.digest,'--base-digest',change.base_digest);
 assert.equal(accepted.revision,3);
 assert.equal(fs.readFileSync(path.join(root,policy[0]),'utf8'),fs.readFileSync(path.join(root,candidate),'utf8'));
 assert.equal(git(root,'check-ignore','project/workspace-config-history.jsonl.lock'),'project/workspace-config-history.jsonl.lock');
 assert.deepEqual(git(root,'diff','--name-only').split('\n'),policy);
 f.h1=commit(f,'fixture adoption');
 assert.equal(git(root,'status','--porcelain'),'');
 f.main=f.f;
 f.pulls={10:{number:10,state:'closed',merged:true,merge_commit_sha:f.m,head:{sha:f.h0,ref:'epic/EPIC-006'},base:{ref:'main',repo:{full_name:repository}}},11:{number:11,state:'closed',merged:true,merge_commit_sha:f.f,head:{sha:f.f,ref:'epic/EPIC-006'},base:{ref:'main',repo:{full_name:repository}}}};
 // Explicit controlled host transport; these are test observations, never live evidence.
 f.api=(endpoint)=>{
  const request=endpoint.replace(`repos/${repository}/`,'');
  if(request==='git/ref/heads/main') return {object:{sha:f.main}};
  if(/^pulls\/\d+$/.test(request)) return f.pulls[request.split('/')[1]];
  if(request.startsWith('pulls?')) return [Object.values(f.pulls).filter(pr=>pr.state==='open')];
  if(request.startsWith('commits/') && request.includes('/pulls?')) return [Object.values(f.pulls).filter(pr=>pr.merge_commit_sha===request.split('/')[1])];
  if(request.startsWith('compare/')) {const [from,to]=request.slice(8).split('...');return {status:from===to?'identical':'ahead',base_commit:{sha:from},merge_base_commit:{sha:git(root,'merge-base',from,to)}};}
  if(request.startsWith('git/trees/')) {const revision=request.split('/')[2].split('?')[0];return {truncated:false,tree:git(root,'ls-tree','-r',revision).split('\n').filter(Boolean).map(line=>{const [,mode,type,sha,name]=line.match(/^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/);return {mode,type,sha,path:name};})};}
  if(request.startsWith('contents/')) {const [name,revision]=request.slice(9).split('?ref=');return {encoding:'base64',content:Buffer.from(execFileSync('git',['-C',root,'show',`${revision}:${decodeURIComponent(name)}`])).toString('base64')};}
  throw new Error(`Unimplemented controlled host request: ${request}`);
 };
 f.options=()=>({root:f.root,baseSha:f.f,headSha:f.h1,headRef:'epic/EPIC-006',api:f.api});
 return f;
}

test('pure adoption proof revalidates pinned H0 and one F-to-H1 canonical acceptance without runtime or PR1 checks',t=>{
 assert.equal(typeof adoption.provePolicyAdoption,'function','bounded adoption proof must exist');
 const f=fixture(t),proof=adoption.provePolicyAdoption(f.options());
 assert.equal(proof.kind,'epic-policy-adoption');assert.equal(proof.original.submittedHead,f.h0);
 assert.equal(proof.finalization.to,f.f);assert.equal(proof.adoption.head,f.h1);
 assert.equal(proof.policy.raw.revision,2);assert.equal(proof.policy.canonical.revision,3);
 assert.equal(proof.policy.canonical.digest,digest);
 assert.equal(fs.existsSync(path.join(f.root,'.git/workflow-state.json')),false);
});

test('historical bootstrap and adoption fixtures remain valid when current source is at F or I',t=>{
 const f=fixture(t);
 const integrated=git(f.root,'commit-tree',`${f.h1}^{tree}`,'-p',f.f,'-m','fixture adopted integration');
 for(const revision of [f.f,integrated]) {
  git(f.root,'checkout','--quiet','--detach',revision);
  // Execute today's modules and tests from a released checkout, while keeping
  // historical H0 evidence independent of that checkout's current lifecycle.
  for(const name of ['scripts','tests']) fs.cpSync(path.join(source,name),path.join(f.root,name),{recursive:true});
  fs.symlinkSync(path.join(source,'node_modules'),path.join(f.root,'node_modules'),'dir');
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-name-pattern=actual bootstrap assessment|pure adoption proof',
   'tests/bootstrap-policy.test.mjs','tests/epic-policy-adoption.test.mjs'],{cwd:f.root,encoding:'utf8',env});
  assert.equal(result.status,0,`Released source ${revision}: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout,/tests 2/);
  fs.unlinkSync(path.join(f.root,'node_modules'));
  git(f.root,'reset','--hard',revision);
 }
});

function controller(f,identity='developer',role) {
 return {actor:{harness:{authenticated:true,identity,sessionId:`fixture-${identity}`,ownerDecisionIds:['fixture-owner-decision']}},
  observers:{api:f.api,owner:proof=>({id:'fixture-owner-decision',owner:'actual fixture owner',repository,epic:'EPIC-006',branch:'epic/EPIC-006',base:proof.adoption.base,candidateDigest:digest,oldRootDigest:proof.policy.root.digest,oldRawDigest:proof.policy.raw.digest,rootUpdate:true,status:'active'}),
   review:proof=>({role,by:identity,sessionId:`fixture-${identity}`,head:proof.adoption.head,verdict:'approved',evidence:'controlled-fixture-review',observedAt:new Date().toISOString()})}};
}
function operation(f,operation,context=controller(f)) {return adoption.controlPolicyAdoption({...f.options(),operation,...context});}
function releaseFixture(t) {
 const f=fixture(t),linked=path.join(f.root,'release');
 git(f.root,'checkout','--quiet','--detach',f.h1);
 git(f.root,'worktree','add','--quiet',linked,'epic/EPIC-006');
 f.root=linked;
 return f;
}
test('local controller requires observed owner and separate Staff then AppSec before publication, preserving state on restart',t=>{
 assert.equal(typeof adoption.controlPolicyAdoption,'function');
 const f=releaseFixture(t);
 assert.throws(()=>operation(f,'prepare',{}),/harness/);
 assert.throws(()=>operation(f,'gate'),/missing/);
 assert.equal(operation(f,'prepare').phase,'prepared');
 assert.throws(()=>operation(f,'review',controller(f,'security','appsec')),/Staff/);
 assert.throws(()=>operation(f,'review',controller(f,'developer','code_reviewer')),/independent/);
 assert.equal(operation(f,'review',controller(f,'staff','code_reviewer')).phase,'prepared');
 assert.equal(operation(f,'review',controller(f,'security','appsec')).phase,'locally-reviewed');
 assert.equal(operation(f,'gate').phase,'locally-reviewed');
 assert.equal(readWorkflowState(f.root).epics['EPIC-006'].policyAdoption.phase,'locally-reviewed');
 assert.throws(()=>check(path.join(f.root,'epics/EPIC-006/epic-plan.md'),'policy-adoption-pr',{root:f.root}),/harness/);
 assert.match(check(path.join(f.root,'epics/EPIC-006/epic-plan.md'),'policy-adoption-pr',{root:f.root,adoptionController:controller(f)}),/permitted/);
});
test('changed H1 invalidates both local reviews and corrupt release state fails closed',t=>{
 assert.equal(typeof adoption.controlPolicyAdoption,'function');
 const f=releaseFixture(t);operation(f,'prepare');operation(f,'review',controller(f,'staff','code_reviewer'));operation(f,'review',controller(f,'security','appsec'));
 git(f.root,'commit','--quiet','--allow-empty','-m','new submitted head');f.h1=git(f.root,'rev-parse','HEAD');
 assert.throws(()=>operation(f,'gate'),/head|changed/);
 assert.equal(operation(f,'prepare').phase,'prepared');
 assert.deepEqual(readWorkflowState(f.root).epics['EPIC-006'].policyAdoption.reviews,[]);
 assert.throws(()=>withWorkflowState(f.root,state=>{state.epics['EPIC-006'].policyAdoption.phase='invented';}),/adoption.*schema|phase/i);
});

for(const [label,mutate] of [
 ['candidate bytes',f=>edit(f,policy[0],text=>text+'\n')],
 ['migration role',f=>edit(f,policy[0],text=>text.replace('appsec: true','appsec: false'))],
 ['rewritten ledger',f=>edit(f,policy[1],text=>text.replace('actual fixture owner','other owner'))],
 ['derived fields',f=>edit(f,policy[1],text=>text.replace('"task_tier",',''))],
 ['extra source',f=>edit(f,'README.md',text=>text+'\nforbidden\n')],
 ['assessment',f=>edit(f,'project/task-assessments/governance-activation.yaml',text=>text.replace('developer: Codex','developer: other'))],
 ['executable policy',f=>fs.chmodSync(path.join(f.root,policy[0]),0o755)],
]) test(`adoption rejects ${label}`,t=>{
 const f=label==='rewritten ledger'?releaseFixture(t):fixture(t);mutate(f);f.h1=commit(f);
 if(label==='rewritten ledger') {
  // The pure proof accepts a new actual acceptor; authority mismatch belongs to the local gate.
  assert.throws(()=>operation(f,'prepare'),/owner/);
 } else assert.throws(()=>adoption.provePolicyAdoption(f.options()));
});
test('adoption rejects hidden source edit/revert even with exact final policy snapshots',t=>{
 const f=fixture(t),before=fs.readFileSync(path.join(f.root,'README.md'));
 edit(f,'README.md',text=>text+'\nforbidden\n');commit(f);fs.writeFileSync(path.join(f.root,'README.md'),before);f.h1=commit(f);
 assert.throws(()=>adoption.provePolicyAdoption(f.options()),/intermediate/);
});
test('adoption rejects wrong original PR, missing finalization, old snapshot substitution and main races',t=>{
 const f=fixture(t),original=f.pulls[10];
 f.pulls[10]={...original,merged:false};assert.throws(()=>adoption.provePolicyAdoption(f.options()),/merged/);f.pulls[10]=original;
 assert.throws(()=>adoption.provePolicyAdoption({...f.options(),baseSha:f.m}));
 assert.throws(()=>adoption.provePolicyAdoption({...f.options(),headRef:'epic/EPIC-007'}),/branch/);
 f.main=f.h1;assert.throws(()=>adoption.provePolicyAdoption(f.options()),/main/);
});

function hosted(f) {
 f.pulls[12]={number:12,state:'open',merged:false,head:{sha:f.h1,ref:'epic/EPIC-006'},base:{sha:f.f,ref:'main',repo:{full_name:repository}}};
 f.identities={code_reviewer:{actor:'staff',kind:'human',provenance:{source:'controlled-fixture',id:'staff'}},appsec:{actor:'security',kind:'human',provenance:{source:'controlled-fixture',id:'security'}}};
 f.reviews=['staff','security'].map((actor,index)=>({id:index+1,user:{login:actor,type:'User'},state:'APPROVED',commit_id:f.h1,submitted_at:`2026-09-26T10:00:0${index}Z`}));
 f.checks=[{id:1,name:'gates',head_sha:f.h1,app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success',check_suite:{id:1}}];
 const previous=f.api;
 f.api=endpoint=>{
  if(endpoint.includes('/actions/variables/GOVERNANCE_REVIEW_IDENTITIES')) return {value:JSON.stringify(f.identities)};
  if(endpoint.includes('/actions/variables/GOVERNANCE_REQUIRED_REVIEW_ROLES')) return {value:JSON.stringify(['code_reviewer','appsec'])};
  if(endpoint.includes('/reviews?')) return [f.reviews];
  if(endpoint.includes('/check-runs?')) return [{check_runs:f.checks}];
  if(endpoint.includes('/actions/runs?')) return [{workflow_runs:[{check_suite_id:1,path:'.github/workflows/workflow.yml',repository:{full_name:repository},head_sha:f.h1,event:'pull_request',status:'completed',conclusion:'success'}]}];
  return previous(endpoint);
 };
}
test('trusted host gate separately rechecks candidate, old roles, current head reviews/checks and F',t=>{
 assert.equal(typeof adoption.evaluatePolicyAdoptionHostGate,'function');
 const f=fixture(t);hosted(f);
 assert.equal(adoption.evaluatePolicyAdoptionHostGate({...f.options(),pr:12}).head,f.h1);
 f.checks[0].conclusion=null;assert.throws(()=>adoption.evaluatePolicyAdoptionHostGate({...f.options(),pr:12}),/pending|pass/);f.checks[0].conclusion='success';
 f.reviews[1].state='DISMISSED';assert.throws(()=>adoption.evaluatePolicyAdoptionHostGate({...f.options(),pr:12}),/dismissed/);f.reviews[1].state='APPROVED';
 f.reviews[0].commit_id=f.h0;assert.throws(()=>adoption.evaluatePolicyAdoptionHostGate({...f.options(),pr:12}),/approval/);
});
test('actual runtime lifecycle reaches an independently proven squash I, retaining PR0 and F without claiming completion',t=>{
 assert.equal(typeof adoption.evaluatePolicyAdoptionHostGate,'function');
 const f=releaseFixture(t);operation(f,'prepare');operation(f,'review',controller(f,'staff','code_reviewer'));operation(f,'review',controller(f,'security','appsec'));hosted(f);
 const ctx=controller(f);ctx.observers.pullRequest=()=>({number:12});
 assert.equal(operation(f,'publish',ctx).phase,'published');
 git(f.root,'checkout','--quiet','--detach',f.f);git(f.root,'cherry-pick',f.h1);const i=git(f.root,'rev-parse','HEAD');git(f.root,'checkout','--quiet','epic/EPIC-006');
 f.pulls[12]={...f.pulls[12],state:'closed',merged:true,merge_commit_sha:i};f.main=i;
 const result=adoption.controlPolicyAdoption({...f.options(),operation:'integrate',integration:{pr:12,sha:i},...controller(f)});
 assert.equal(result.phase,'integrated');assert.equal(result.proof.original.mergeCommit,f.m);assert.equal(result.proof.finalization.to,f.f);assert.equal(result.proof.adoption.integrationSha,i);
 assert.equal(readWorkflowState(f.root).epics['EPIC-006'].completed,undefined);
});

test('fresh-checkout real CI entrypoint succeeds without runtime or PR1 reviews while standalone publication gate denies',t=>{
 const f=fixture(t),responses={};
 adoption.provePolicyAdoption({...f.options(),api:(endpoint,options)=>{const value=f.api(endpoint,options);responses[endpoint]=value;return value;}});
 const transport=fs.mkdtempSync(path.join(os.tmpdir(),'adoption-controlled-host-'));t.after(()=>fs.rmSync(transport,{recursive:true,force:true}));
 const quote=value=>`'${value.replaceAll("'","'\\''")}'`;
 const cases=Object.entries(responses).map(([endpoint,value],index)=>{
  const file=path.join(transport,`${index}.json`);fs.writeFileSync(file,JSON.stringify(value));
  return `${quote(endpoint)}) /bin/cat ${quote(file)};;`;
 });
 // A POSIX transport avoids starting a second Node runtime for every API read.
 fs.writeFileSync(path.join(transport,'gh'),`#!/bin/sh\nfor endpoint do :; done\ncase "$endpoint" in\n${cases.join('\n')}\n*) exit 7;;\nesac\n`,{mode:0o755});
 const env={...process.env,PATH:`${transport}:${process.env.PATH}`,BASE_SHA:f.f,HEAD_SHA:f.h1,HEAD_REF:'epic/EPIC-006'};
 const result=spawnSync(process.execPath,[path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/committed provenance verified/);
 const wrongBranch=spawnSync(process.execPath,[path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env:{...env,HEAD_REF:'epic/EPIC-007'}});
 assert.equal(wrongBranch.status,1);assert.match(wrongBranch.stderr,/Policy adoption.*branch/);
 const local=spawnSync(process.execPath,[path.join(source,'scripts/check-gate.mjs'),'epics/EPIC-006/epic-plan.md','policy-adoption-pr'],{cwd:f.root,encoding:'utf8',env});
 assert.equal(local.status,1);assert.match(local.stderr,/harness/);
 for(const name of ['epic-plan.md','epic.md']) edit(f,`epics/EPIC-006/${name}`,text=>text.replace('status: merged','status: in-progress'));
 f.h1=commit(f,'attempt to select ordinary CI using candidate status');
 const tampered=spawnSync(process.execPath,[path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env:{...env,HEAD_SHA:f.h1}});
 assert.equal(tampered.status,1,'candidate status cannot select a weaker CI stage');
 assert.match(tampered.stderr,/Policy adoption.*two policy/);
});
test('local review independence rejects actor relabeling and reused observed sessions',t=>{
 const f=releaseFixture(t);operation(f,'prepare');
 const disguised=controller(f,' Developer ','code_reviewer');assert.throws(()=>operation(f,'review',disguised),/independent/);
 const sameSession=controller(f,'staff','code_reviewer');sameSession.actor.harness.sessionId='fixture-developer';
 sameSession.observers.review=proof=>({role:'code_reviewer',by:'staff',sessionId:'fixture-developer',head:proof.adoption.head,verdict:'approved',evidence:'fixture',observedAt:new Date().toISOString()});
 assert.throws(()=>operation(f,'review',sameSession),/independent/);
 operation(f,'review',controller(f,'staff','code_reviewer'));
 const second=controller(f,'security','appsec');second.actor.harness.sessionId='fixture-staff';
 second.observers.review=proof=>({role:'appsec',by:'security',sessionId:'fixture-staff',head:proof.adoption.head,verdict:'approved',evidence:'fixture',observedAt:new Date().toISOString()});
 assert.throws(()=>operation(f,'review',second),/independent/);
});

for(const [label,mutate] of [
 ['extra source',f=>edit(f,'README.md',text=>text+'\nforbidden source\n')],
 ['candidate plan stage',f=>edit(f,'epics/EPIC-006/epic-plan.md',text=>text.replace('status: merged','status: in-progress'))],
]) test(`trusted publisher cannot fall back to ordinary route with ${label}`,t=>{
 const f=fixture(t);mutate(f);f.h1=commit(f);hosted(f);
 git(f.root,'checkout','--quiet','--detach',f.f);
 assert.throws(()=>adoption.trustedPolicyAdoptionGate({root:f.root,repository,pull:f.pulls[12],api:f.api}),/two policy|unauthorized/);
});
test('trusted publisher positively executes only integrated F code against H1 data',t=>{
 const f=fixture(t);hosted(f);git(f.root,'checkout','--quiet','--detach',f.f);
 const result=adoption.trustedPolicyAdoptionGate({root:f.root,repository,pull:f.pulls[12],api:f.api});
 assert.equal(result.head,f.h1);assert.equal(git(f.root,'rev-parse','HEAD'),f.f);
});
test('trusted pending adoption cannot fall back through a different candidate branch',t=>{
 const f=fixture(t);hosted(f);git(f.root,'checkout','--quiet','--detach',f.f);
 f.pulls[12].head.ref='feature/false-adoption';
 assert.throws(()=>adoption.trustedPolicyAdoptionGate({root:f.root,repository,pull:f.pulls[12],api:f.api}),/branch/);
});

test('local adoption cannot prepare in the primary checkout',t=>{
 const f=fixture(t);assert.throws(()=>operation(f,'prepare'),/isolated/);
});
test('a fresh adverse local verdict durably revokes prior publication readiness',t=>{
 const f=releaseFixture(t);operation(f,'prepare');operation(f,'review',controller(f,'staff','code_reviewer'));operation(f,'review',controller(f,'security','appsec'));
 const context=controller(f,'staff','code_reviewer'),approved=context.observers.review;
 context.observers.review=proof=>({...approved(proof),verdict:'changes-requested',evidence:'controlled observed blocking finding'});
 const result=operation(f,'review',context);
 assert.equal(result.phase,'prepared');assert.deepEqual(result.reviews,[]);
 assert.equal(result.lastReview.verdict,'changes-requested');
 assert.throws(()=>operation(f,'gate'),/Staff then AppSec/);
});
test('fresh non-local clone materializes an unavailable squashed H0 as immutable data before CI proof',t=>{
 assert.equal(typeof adoption.materializePolicyAdoptionHistory,'function');
 const f=fixture(t,{originalSquash:true});
 git(f.root,'config','uploadpack.allowAnySHA1InWant','true');
 const clone=fs.mkdtempSync(path.join(os.tmpdir(),'adoption-fresh-squash-'));t.after(()=>fs.rmSync(clone,{recursive:true,force:true}));
 git(clone,'clone','--quiet','--no-local',f.root,'.');
 git(clone,'remote','set-url','origin','https://github.com/dpitcock/ai-toolkit.git');
 assert.equal(fs.existsSync(path.join(clone,'.git/objects/info/alternates')),false);
 assert.throws(()=>git(clone,'cat-file','-e',`${f.h0}^{commit}`));
 // Fixture-only fetch transport; do not rewrite canonical origin discovery.
 const transport=fs.mkdtempSync(path.join(os.tmpdir(),'adoption-fetch-'));t.after(()=>fs.rmSync(transport,{recursive:true,force:true}));
 const realGit=execFileSync('which',['git'],{encoding:'utf8'}).trim(),quote=value=>`'${value.replaceAll("'","'\\''")}'`;
 fs.writeFileSync(path.join(transport,'git'),`#!/bin/sh\nif [ "$4" = fetch ] && [ "$8" = https://github.com/dpitcock/ai-toolkit.git ]; then\nexec ${quote(realGit)} --no-replace-objects -C "$3" fetch --no-tags --no-recurse-submodules --no-write-fetch-head ${quote(`file://${f.root}`)} "$9"\nfi\nexec ${quote(realGit)} "$@"\n`,{mode:0o755});
 const oldPath=process.env.PATH;
 try {process.env.PATH=`${transport}:${oldPath}`;adoption.materializePolicyAdoptionHistory({...f.options(),root:clone});}
 finally {process.env.PATH=oldPath;}
 assert.equal(git(clone,'rev-parse','HEAD'),f.h1);
 assert.equal(adoption.provePolicyAdoption({...f.options(),root:clone}).original.submittedHead,f.h0);
});
