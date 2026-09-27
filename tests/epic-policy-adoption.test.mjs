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
import {replaceActivationBlock} from '../scripts/lib/activation-report.mjs';
import {handleWorkflowEvent} from '../scripts/workflow-event.mjs';
import {controlledHostArgs,withFixtureFetch} from './helpers/controlled-host.mjs';
const releaseURL=new URL('../scripts/lib/release-verification-proof.mjs',import.meta.url);
const release=fs.existsSync(releaseURL)?await import(releaseURL):{};
const runtimeURL=new URL('../scripts/lib/release-verification-runtime.mjs',import.meta.url);
const releaseRuntime=fs.existsSync(runtimeURL)?await import(runtimeURL):{};

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
 fs.copyFileSync(path.join(source,'docs/verification.md'),path.join(root,'docs/verification.md'));
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

test('historical adoption proof remains data-only after I while live adoption still rejects advanced main',t=>{
 assert.equal(typeof adoption.proveHistoricalPolicyAdoption,'function','historical chain proof must be separate from live adoption');
 const f=fixture(t);hosted(f);
 const i=git(f.root,'commit-tree',`${f.h1}^{tree}`,'-p',f.f,'-m','adoption squash');
 f.pulls[12]={...f.pulls[12],state:'closed',merged:true,merge_commit_sha:i};f.main=i;
 const proof=adoption.provePolicyAdoption({...f.options(),integration:{pr:12,sha:i}});
 f.main='f'.repeat(40);
 assert.throws(()=>adoption.provePolicyAdoption({...f.options(),integration:{pr:12,sha:i}}),/main/);
 assert.deepEqual(adoption.proveHistoricalPolicyAdoption({root:f.root,proof,api:f.api}),proof);
 assert.equal(typeof adoption.observeHistoricalPolicyAdoption,'function');
 assert.deepEqual(adoption.observeHistoricalPolicyAdoption({root:f.root,integrationSha:i,api:f.api}),proof);
 const forged=structuredClone(proof);forged.adoption.head=f.h0;
 assert.throws(()=>adoption.proveHistoricalPolicyAdoption({root:f.root,proof:forged,api:f.api}));
});

function verificationFixture(t) {
 const f=fixture(t);hosted(f);
 f.i=git(f.root,'commit-tree',`${f.h1}^{tree}`,'-p',f.f,'-m','adoption squash');
 f.pulls[12]={...f.pulls[12],state:'closed',merged:true,merge_commit_sha:f.i};f.main=f.i;
 f.adoption=adoption.provePolicyAdoption({...f.options(),integration:{pr:12,sha:f.i}});
 git(f.root,'reset','--hard',f.i);
 f.report={version:1,epic:'EPIC-006',repository,activationBase:f.i,loadedRevision:f.i,policyDigest:digest,observations:[{kind:'activation',status:'observed',at:'2026-09-26T12:00:00.000Z',head:f.i,references:[{type:'session',id:'controlled-fixture'}]},{kind:'host-review',status:'pending',at:null,head:null,references:[]}]};
 f.document=fs.readFileSync(path.join(f.root,'docs/verification.md'),'utf8');
 f.write=()=>{fs.writeFileSync(path.join(f.root,'project/EPIC-006-activation-evidence.json'),JSON.stringify(f.report)+'\n');fs.writeFileSync(path.join(f.root,'docs/verification.md'),replaceActivationBlock(f.document,f.report));};
 f.write();f.h2=commit(f,'activation evidence');
 f.releaseOptions=()=>({root:f.root,baseSha:f.i,headSha:f.h2,headRef:'epic/EPIC-006',api:f.api});
 return f;
}
test('release provenance proves PR0/M/F/PR1/I and two-path PR2/J separately without runtime authority',t=>{
 assert.equal(typeof release.proveReleaseVerification,'function','finite release proof must exist');
 const f=verificationFixture(t),proof=release.proveReleaseVerification(f.releaseOptions());
 assert.equal(proof.adoption.original.pr,10);assert.equal(proof.adoption.adoption.pr,12);assert.equal(proof.release.pr,null);
 f.j=git(f.root,'commit-tree',`${f.h2}^{tree}`,'-p',f.i,'-m','release squash');
 f.pulls[13]={number:13,state:'closed',merged:true,merge_commit_sha:f.j,head:{sha:f.h2,ref:'epic/EPIC-006'},base:{sha:f.i,ref:'main',repo:{full_name:repository}}};f.main=f.j;
 const integrated=release.proveReleaseVerification({...f.releaseOptions(),integration:{pr:13,sha:f.j}});
 assert.equal(integrated.release.integrationSha,f.j);assert.equal(integrated.adoption.adoption.integrationSha,f.i);
 assert.throws(()=>adoption.provePolicyAdoption({...f.options(),integration:{pr:12,sha:f.i}}),/main/);
 f.main='f'.repeat(40);assert.throws(()=>release.proveReleaseVerification({...f.releaseOptions(),integration:{pr:13,sha:f.j}}),/main/);
});
test('trusted release stage rejects malformed candidate paths and cannot fall back through candidate status or branch',t=>{
 assert.equal(typeof release.releaseVerificationStage,'function');const f=verificationFixture(t);
 assert.equal(release.releaseVerificationStage({root:f.root,baseSha:f.i}),'pending');
 edit(f,'epics/EPIC-006/epic-plan.md',text=>text.replace('status: merged','status: in-progress'));f.h2=commit(f,'forbidden plan reset');
 assert.throws(()=>release.proveReleaseVerification(f.releaseOptions()),/two deliverable|unauthorized/);
 assert.throws(()=>release.proveReleaseVerification({...f.releaseOptions(),headRef:'other'}),/branch/);
});
test('release trusted host gate uses current PR2 reviews/checks and cannot trust report approvals',t=>{
 assert.equal(typeof release.evaluateReleaseHostGate,'function');
 const f=verificationFixture(t);
 f.pulls[13]={number:13,state:'open',merged:false,head:{sha:f.h2,ref:'epic/EPIC-006'},base:{sha:f.i,ref:'main',repo:{full_name:repository}}};
 for(const review of f.reviews) review.commit_id=f.h2;f.checks[0].head_sha=f.h2;
 const api=f.api;f.api=endpoint=>endpoint.includes('/actions/runs?')?[{workflow_runs:[{check_suite_id:1,path:'.github/workflows/workflow.yml',repository:{full_name:repository},head_sha:f.h2,event:'pull_request',status:'completed',conclusion:'success'}]}]:api(endpoint);
 assert.equal(release.evaluateReleaseHostGate({...f.releaseOptions(),pr:13}).head,f.h2);
 f.j=git(f.root,'commit-tree',`${f.h2}^{tree}`,'-p',f.i,'-m','release integration');
 f.pulls[13]={...f.pulls[13],state:'closed',merged:true,merge_commit_sha:f.j};
 f.pulls[14]={...f.pulls[13],number:14};f.main=f.j;
 assert.throws(()=>release.evaluateReleaseHostGate({...f.releaseOptions(),pr:14,integration:{pr:13,sha:f.j}}),/integration PR|PR2/);
 git(f.root,'checkout','--quiet','--detach',f.i);
 assert.equal(release.trustedReleaseVerificationGate({root:f.root,repository,pull:f.pulls[13],api:f.api}).head,f.h2);
 assert.equal(git(f.root,'rev-parse','HEAD'),f.i,'trusted publisher never checks out candidate code');
 assert.throws(()=>release.trustedReleaseVerificationGate({root:f.root,repository,pull:{...f.pulls[13],head:{...f.pulls[13].head,ref:'other'}},api:f.api}),/branch/);
 f.reviews[1].commit_id=f.h1;
 assert.throws(()=>release.evaluateReleaseHostGate({...f.releaseOptions(),pr:13}),/approval/);
});
test('real CI release route is selected from trusted I and never needs local runtime or its own green result',t=>{
 const f=verificationFixture(t),responses={};
 release.proveReleaseVerification({...f.releaseOptions(),api:(endpoint,options)=>{const value=f.api(endpoint,options);responses[endpoint]=value;return value;}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-host-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const stateFile=path.join(dir,'responses.json');fs.writeFileSync(stateFile,JSON.stringify(responses));
 const env={...process.env,BASE_SHA:f.i,HEAD_SHA:f.h2,HEAD_REF:'epic/EPIC-006'};
 const run=extra=>spawnSync(process.execPath,[...controlledHostArgs({stateFile}),path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env:{...env,...extra}});
 const result=run();assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/release-verification.*committed provenance/);
 const branch=run({HEAD_REF:'other'});assert.equal(branch.status,1);assert.match(branch.stderr,/branch/);
 edit(f,'epics/EPIC-006/epic-plan.md',text=>text.replace('status: merged','status: in-progress'));f.h2=commit(f,'forbidden route fallback');
 const tampered=run({HEAD_SHA:f.h2});assert.equal(tampered.status,1);assert.match(tampered.stderr,/two deliverable|unauthorized/);
});

function liveVerificationFixture(t) {
 const f=releaseFixture(t);operation(f,'prepare');operation(f,'review',controller(f,'staff','code_reviewer'));operation(f,'review',controller(f,'security','appsec'));hosted(f);
 const context=controller(f);context.observers.pullRequest=()=>({number:12});operation(f,'publish',context);
 f.i=git(f.root,'commit-tree',`${f.h1}^{tree}`,'-p',f.f,'-m','adoption integration');
 f.pulls[12]={...f.pulls[12],state:'closed',merged:true,merge_commit_sha:f.i};f.main=f.i;
 const adopted=adoption.controlPolicyAdoption({...f.options(),operation:'integrate',integration:{pr:12,sha:f.i},...controller(f)});
 git(f.root,'reset','--hard',f.i);
 f.actor=controller(f).actor;
 f.observers={api:f.api,activation:()=>({source:'session-harness',sessionId:f.actor.harness.sessionId,loadedRevision:f.i,policyDigest:digest,observedAt:new Date().toISOString()})};
 const provenance={digest,definition:adopted.proof.policy.definition,rootAcceptance:`workspace:3:${digest}`,worktreeAcceptance:`workspace:3:${digest}`};
 withWorkflowState(f.root,state=>{state.authorizations.release={repository,branch:'epic/EPIC-006',scope:['epics/EPIC-006'],allowedActions:['release.verify','review.ready','merge.eligible','epic.complete'],completionCriteria:['verified J'],authorizedBy:'fixture-owner',status:'active',policy:provenance};});
 f.event=(id,type='release.verify',operation='prepare')=>({id,type,epic:'EPIC-006',authorizationId:'release',completionCriterion:'verified J',...(type==='release.verify'?{operation}:{})});
 f.run=event=>handleWorkflowEvent({root:f.root,event,actor:f.actor,observers:f.observers});
 f.report={version:1,epic:'EPIC-006',repository,activationBase:f.i,loadedRevision:f.i,policyDigest:digest,observations:[{kind:'activation',status:'observed',at:'2026-09-26T12:00:00.000Z',head:f.i,references:[{type:'session',id:'controlled-fixture'}]}]};
 f.document=fs.readFileSync(path.join(f.root,'docs/verification.md'),'utf8');
 f.write=()=>{fs.writeFileSync(path.join(f.root,'project/EPIC-006-activation-evidence.json'),JSON.stringify(f.report)+'\n');fs.writeFileSync(path.join(f.root,'docs/verification.md'),replaceActivationBlock(f.document,f.report));};
 return f;
}
test('active release preparation and commit/push effects use current permits, durable dispatch and actual reconciliation',t=>{
 assert.equal(typeof releaseRuntime.controlReleaseVerification,'function','trusted finite runtime controller is required');
 const f=liveVerificationFixture(t),prepared=f.run(f.event('prepare'));
 assert.equal(prepared.decision,'continue');assert.equal(prepared.reason,'authorized-routine');assert.equal(prepared.release.phase,'prepared');
 assert.throws(()=>f.run({...f.event('premature-completion','epic.complete'),completionId:'not-yet'}),/verified J/);
 f.write();const event=f.event('commit-one','release.verify','commit'),decision=f.run(event);
 assert.equal(decision.release.operation,'commit');
 const control=operation=>releaseRuntime.controlReleaseVerification({root:f.root,operation,deliveryId:event.id,actor:f.actor,observers:f.observers});
 assert.equal(control('dispatch').effect.status,'dispatched');
 assert.throws(()=>control('dispatch'),/dispatched|replay/);
 const head=commit(f,'actual evidence commit');
 f.observers.effect=()=>({operationId:'git-commit-one',head,result:'succeeded',observedAt:new Date().toISOString()});
 assert.equal(control('ack').effect.status,'acknowledged');
 assert.equal(f.run(event).release.actionable,false);
 const push=f.event('push-one','release.verify','push');f.run(push);
 const pushControl=operation=>releaseRuntime.controlReleaseVerification({root:f.root,operation,deliveryId:push.id,actor:f.actor,observers:f.observers});
 pushControl('dispatch');pushControl('uncertain');assert.throws(()=>pushControl('dispatch'),/uncertain|replay/);
 f.observers.effect=()=>({operationId:'git-push-one',head,remoteHead:head,result:'succeeded',observedAt:new Date().toISOString()});
 assert.equal(pushControl('reconcile').effect.status,'reconciled');
 assert.equal(f.run(push).release.actionable,false);
 assert.equal(Object.keys(readWorkflowState(f.root).reviews).length,0,'commits and pushes never dispatch reviewers');
 withWorkflowState(f.root,state=>{state.authorizations.release.status='revoked';});
 assert.equal(f.run(f.event('stale')).reason,'authorization-stale');
});
test('release effects reject missing identity, arbitrary operations, stale decisions, policy drift and false acknowledgements',t=>{
 const f=liveVerificationFixture(t);
 assert.throws(()=>handleWorkflowEvent({root:f.root,event:f.event('actor-missing'),observers:f.observers}),/harness/);
 assert.throws(()=>f.run({...f.event('command'),command:'echo forged'}),/malformed/);
 assert.throws(()=>f.run(f.event('arbitrary','release.verify','execute')),/operation/);
 const loaded=f.observers.activation;f.observers.activation=()=>({...loaded(),loadedRevision:f.h0});
 assert.throws(()=>f.run(f.event('wrong-loaded')),/loaded/);f.observers.activation=loaded;
 f.run(f.event('prepare'));f.write();
 const first=f.event('first','release.verify','commit');f.run(first);
 const control=operation=>releaseRuntime.controlReleaseVerification({root:f.root,operation,deliveryId:first.id,actor:f.actor,observers:f.observers});
 f.report.observations.push({kind:'smoke',status:'pending',at:null,head:null,references:[]});f.write();
 assert.throws(()=>control('dispatch'),/changed/);
 f.report.observations.pop();f.write();
 withWorkflowState(f.root,state=>{state.authorizations.release.expiresAt='2000-01-01T00:00:00.000Z';});
 assert.throws(()=>control('dispatch'),/authorization-stale/);
 withWorkflowState(f.root,state=>{delete state.authorizations.release.expiresAt;});
 const originalClock=Date.now,activation=f.observers.activation,future=originalClock()+3600000;
 withWorkflowState(f.root,state=>{state.authorizations.release.expiresAt=new Date(future).toISOString();});
 f.observers.activation=()=>{Date.now=()=>future+1;return activation();};
 try {assert.throws(()=>control('dispatch'),/authorization-stale/,'authorization must still be current after observations');}
 finally {Date.now=originalClock;f.observers.activation=activation;withWorkflowState(f.root,state=>{delete state.authorizations.release.expiresAt;});}
 control('dispatch');const head=commit(f,'authorized evidence');
 f.observers.effect=()=>({operationId:'false',head:f.i,result:'succeeded',observedAt:new Date().toISOString()});
 assert.throws(()=>control('ack'),/incomplete/);
 assert.equal(readWorkflowState(f.root).epics['EPIC-006'].releaseVerification.actions.first.status,'dispatched');
 f.observers.effect=()=>{fs.appendFileSync(path.join(f.root,'docs/verification.md'),'raced document');return {operationId:'actual-commit',head,result:'succeeded',observedAt:new Date().toISOString()};};
 assert.throws(()=>control('ack'),/clean|changed/,'observation cannot race the final checked snapshot');f.write();
 f.observers.effect=()=>({operationId:'actual-commit',head,result:'succeeded',observedAt:new Date().toISOString()});control('ack');
 const rootPolicy=path.join(path.dirname(f.root),'config/workspace-config.yaml'),original=fs.readFileSync(rootPolicy,'utf8');
 fs.writeFileSync(rootPolicy,original+'\n');
 assert.throws(()=>f.run(f.event('root-drift','release.verify','push')),/mirror/);
 fs.writeFileSync(rootPolicy,original);
 assert.throws(()=>withWorkflowState(f.root,state=>{state.epics['EPIC-006'].releaseVerification.actions.first.snapshot=['f'.repeat(64)];}),/malformed/);
});

test('release commit authorization rejects hidden index source and mismatched staged evidence',t=>{
 const f=liveVerificationFixture(t);f.run(f.event('prepare'));f.write();
 fs.mkdirSync(path.join(f.root,' docs'));fs.writeFileSync(path.join(f.root,' docs/verification.md'),'forbidden');
 assert.throws(()=>f.run(f.event('whitespace-path','release.verify','commit')),/unauthorized/);
 fs.rmSync(path.join(f.root,' docs'),{recursive:true});
 edit(f,'README.md',text=>text+'\nhidden source\n');git(f.root,'add','README.md');git(f.root,'restore','--worktree','--source=HEAD','README.md');
 assert.throws(()=>f.run(f.event('hidden-index','release.verify','commit')),/index|staged/);
 git(f.root,'reset','--','README.md');git(f.root,'add','docs/verification.md','project/EPIC-006-activation-evidence.json');
 f.report.observations.push({kind:'smoke',status:'pending',at:null,head:null,references:[]});f.write();
 assert.throws(()=>f.run(f.event('partial-index','release.verify','commit')),/index|staged/);
 git(f.root,'add','docs/verification.md','project/EPIC-006-activation-evidence.json');
 assert.equal(f.run(f.event('valid-index','release.verify','commit')).reason,'authorized-routine');
 const activation=f.observers.activation;f.observers.activation=()=>{git(f.root,'switch','--quiet','-c','epic/EPIC-999');return activation();};
 assert.throws(()=>releaseRuntime.controlReleaseVerification({root:f.root,operation:'dispatch',deliveryId:'valid-index',actor:f.actor,observers:f.observers}),/branch|changed/);
});

function readyVerificationFixture(t,{numeric=false}={}) {
 const f=liveVerificationFixture(t);f.run(f.event('prepare'));
 f.control=(operation,extra={})=>releaseRuntime.controlReleaseVerification({root:f.root,operation,actor:f.actor,observers:f.observers,...extra});
 f.increment=id=>{
  const commitId=numeric?(id==='activation'?'4':'2'):`commit-${id}`,pushId=numeric?(id==='activation'?'3':'1'):`push-${id}`;
  f.write();f.run(f.event(commitId,'release.verify','commit'));f.control('dispatch',{deliveryId:commitId});const head=commit(f,`useful evidence ${id}`);
  f.observers.effect=()=>({operationId:`git-commit-${id}`,head,result:'succeeded',observedAt:new Date().toISOString()});f.control('ack',{deliveryId:commitId});
  f.run(f.event(pushId,'release.verify','push'));f.control('dispatch',{deliveryId:pushId});
  f.observers.effect=()=>({operationId:`git-push-${id}`,head,remoteHead:head,result:'succeeded',observedAt:new Date().toISOString()});f.control('ack',{deliveryId:pushId});return head;
 };
 f.first=f.increment('activation');
 assert.throws(()=>f.run(f.event('too-early','review.ready')),/two|increments/);
 f.report.observations.push({kind:'smoke',status:'observed',at:'2026-09-26T12:10:00.000Z',head:f.i,references:[{type:'runtime',id:'fixture-smoke'}]});
 f.report.observations.push({kind:'host-review',status:'pending',at:null,head:null,references:[]});
 f.head=f.increment('smoke');f.second=f.head;
 f.observers.qa=()=>({head:f.head,by:'independent-qa',sessionId:'qa-session',verdict:'accepted',observedAt:new Date().toISOString(),evidence:'Independent useful activation and smoke observations',increments:[{commitId:numeric?'4':'commit-activation',pushId:numeric?'3':'push-activation',head:f.first,evidence:'Actual activation record'},{commitId:numeric?'2':'commit-smoke',pushId:numeric?'1':'push-smoke',head:f.second,evidence:'Independent smoke record'}],preReadinessDispatches:0,routineConfirmations:0,routineStaffAuthorizations:0});
 f.review=(role,{uncertain=false}={})=>{
  const record=readWorkflowState(f.root).epics['EPIC-006'].releaseVerification;
  const claim=Object.values(readWorkflowState(f.root).reviews).find(item=>item.release==='activation-evidence' && item.role===role && item.head===record.head).claim;
  const by=role==='code_reviewer'?'staff-reviewer':'security-reviewer',sessionId=`${by}-${record.head}`;
  f.observers.assignment=()=>({role,by,sessionId,head:record.head,operationId:`review-${role}-${record.head}`});
  const dispatched=f.control('review-claim',{claimId:claim.id});assert.equal(dispatched.purpose,'independent-review');
  assert.throws(()=>f.control('review-claim',{claimId:claim.id}),/queued|replay/);
  assert.throws(()=>f.control('review',{claimId:claim.id}),/acknowledged/,'claim and dispatch are not verdict authority');
  f.observers.delivery=()=>({role,by,sessionId,head:record.head,operationId:`review-${role}-${record.head}`,result:'succeeded'});
  if(uncertain) {f.control('review-uncertain',{claimId:claim.id});assert.throws(()=>f.control('review-ack',{claimId:claim.id}),/claimed|uncertain/);f.control('review-reconcile',{claimId:claim.id});}
  else f.control('review-ack',{claimId:claim.id});
  const actor={harness:{authenticated:true,identity:by,sessionId}};
  f.observers.review=()=>({role,by,sessionId,head:record.head,claimId:claim.id,verdict:'approved',evidence:'Actual independent fixture review',observedAt:new Date().toISOString()});
  assert.throws(()=>f.control('review',{claimId:claim.id}),/independently/,'developer cannot submit an assigned reviewer verdict');
  f.observers.activation=()=>({source:'session-harness',sessionId,loadedRevision:f.i,policyDigest:digest,observedAt:new Date().toISOString()});
  f.control('review',{actor,claimId:claim.id});
  f.observers.activation=()=>({source:'session-harness',sessionId:f.actor.harness.sessionId,loadedRevision:f.i,policyDigest:digest,observedAt:new Date().toISOString()});
 };
 return f;
}
test('finite release readiness persists local claims before ordered independent reviews and separates PR2 publication',t=>{
 const f=readyVerificationFixture(t,{numeric:true});
 assert.equal(Object.keys(readWorkflowState(f.root).reviews).length,0);
 assert.throws(()=>f.control('review-claim',{claimId:'absent'}),/readiness|claim/);
 const qa=f.observers.qa;delete f.observers.qa;
 assert.throws(()=>f.run(f.event('missing-qa','review.ready')),/qa|observation/);f.observers.qa=qa;
 f.observers.qa=()=>({...qa(),by:f.actor.harness.identity});assert.throws(()=>f.run(f.event('self-qa','review.ready')),/independent/);
 f.observers.qa=()=>{const value=qa();value.increments[0].head=f.i;return value;};assert.throws(()=>f.run(f.event('false-increment','review.ready')),/actual/);f.observers.qa=qa;
 const ready=f.run(f.event('local-ready','review.ready')).review;
 assert.equal(ready.stage,'local');assert.equal(ready.pr,undefined);assert.equal(ready.claims.length,2);
 assert.equal(readWorkflowState(f.root).epics['EPIC-006'].releaseVerification.localReady.head,f.head);
 const appsec=Object.values(readWorkflowState(f.root).reviews).find(item=>item.role==='appsec').claim;
 f.observers.assignment=()=>({role:'appsec',by:'security-reviewer',sessionId:'security-session',head:f.head,operationId:'early-appsec'});
 assert.throws(()=>f.control('review-claim',{claimId:appsec.id}),/Staff|order/);
 assert.throws(()=>f.control('gate'),/Staff|review/);
 withWorkflowState(f.root,state=>{state.authorizations.release.allowedActions=['release.verify'];});
 assert.throws(()=>f.control('gate'),/authorization-scope/,'routine commit permission cannot authorize review operations');
 withWorkflowState(f.root,state=>{state.authorizations.release.allowedActions=['release.verify','review.ready','merge.eligible','epic.complete'];});
 const staff=Object.values(readWorkflowState(f.root).reviews).find(item=>item.role==='code_reviewer').claim;
 const clock=Date.now,deadline=clock()+3600000;
 withWorkflowState(f.root,state=>{state.authorizations.release.expiresAt=new Date(deadline).toISOString();});
 f.observers.assignment=()=>{Date.now=()=>deadline+1;return {role:'code_reviewer',by:'staff-reviewer',sessionId:'staff-session',head:f.head,operationId:'expired-dispatch'};};
 try {assert.throws(()=>f.control('review-claim',{claimId:staff.id}),/authorization-stale/);}
 finally {Date.now=clock;withWorkflowState(f.root,state=>{delete state.authorizations.release.expiresAt;});}
 assert.equal(Object.values(readWorkflowState(f.root).reviews).find(item=>item.claim.id===staff.id).claim.status,'queued');
 f.review('code_reviewer',{uncertain:true});f.review('appsec');
 const plan=path.join(f.root,'epics/EPIC-006/epic-plan.md');
 assert.throws(()=>check(plan,'release-verification-pr',{root:f.root}),/harness/);
 assert.match(check(plan,'release-verification-pr',{root:f.root,releaseController:{actor:f.actor,observers:f.observers}}),/permitted/);
 f.pulls[13]={number:13,state:'open',merged:false,head:{sha:f.head,ref:'epic/EPIC-006'},base:{sha:f.i,ref:'main',repo:{full_name:repository}}};
 f.observers.pullRequest=()=>({repository,pr:13,head:f.head,state:'open',base:'main',headBranch:'epic/EPIC-006'});
 assert.equal(f.control('publish').publishedPr,13);
 const localClaims=Object.values(readWorkflowState(f.root).reviews).filter(item=>item.release);
 const hostedReady=f.run(f.event('host-ready','review.ready')).review;
 assert.equal(hostedReady.stage,'host');assert.equal(hostedReady.purpose,'publish-completed-verdicts');assert.equal(hostedReady.pr,13);
 assert.deepEqual(Object.values(readWorkflowState(f.root).reviews).filter(item=>item.release),localClaims,'publication never redispatches local reviews');
 for(const item of Object.values(readWorkflowState(f.root).reviews).filter(item=>item.pr===13)) {
  f.observers.assignment=()=>({role:item.role,by:'host-publisher',sessionId:'publisher-session',head:f.head,operationId:`publish-${item.role}`});
  assert.equal(f.control('review-claim',{claimId:item.claim.id}).purpose,'publish-completed-verdicts');
  f.observers.delivery=()=>({role:item.role,by:'host-publisher',sessionId:'publisher-session',head:f.head,pr:13,operationId:`publish-${item.role}`,result:'succeeded'});
  f.control('review-ack',{claimId:item.claim.id});assert.throws(()=>f.control('review-claim',{claimId:item.claim.id}),/queued|replay/);
 }
 assert.equal(f.run(f.event('host-ready','review.ready')).review.claims.length,2);
 withWorkflowState(f.root,state=>{const key=Object.keys(state.reviews).find(key=>state.reviews[key].claim.id===localClaims[0].claim.id);delete state.reviews[key];});
 assert.throws(()=>f.run(f.event('lost-claim','review.ready')),/missing|corrupt/,'lost runtime claims cannot be recreated as a new dispatch');
});

test('same open PR2 correction invalidates both readiness boundaries and requires fresh independent review',t=>{
 const f=readyVerificationFixture(t);f.run(f.event('ready','review.ready'));f.review('code_reviewer');f.review('appsec');
 f.pulls[13]={number:13,state:'open',merged:false,head:{sha:f.head,ref:'epic/EPIC-006'},base:{sha:f.i,ref:'main',repo:{full_name:repository}}};
 f.observers.pullRequest=()=>({repository,pr:13,head:f.head,state:'open',base:'main',headBranch:'epic/EPIC-006'});f.control('publish');f.run(f.event('host','review.ready'));
 f.report.observations[2]={kind:'host-review',status:'observed',at:'2026-09-26T12:20:00.000Z',head:f.head,references:[{type:'host',id:'real-earlier-review'}]};f.write();
 assert.throws(()=>f.run(f.event('unauthorized-correction','release.verify','commit')),/independent request/);
 git(f.root,'restore','.');
 const by='staff-reviewer',sessionId=`staff-reviewer-${f.head}`,actor={harness:{authenticated:true,identity:by,sessionId}};
 f.observers.activation=()=>({source:'session-harness',sessionId,loadedRevision:f.i,policyDigest:digest,observedAt:new Date().toISOString()});
 const staffClaim=Object.values(readWorkflowState(f.root).reviews).find(item=>item.release==='activation-evidence' && item.role==='code_reviewer' && item.head===f.head).claim.id;
 f.observers.review=()=>({head:f.head,role:'code_reviewer',claimId:staffClaim,by,sessionId,verdict:'changes-requested',evidence:'Actual newly available host facts are still pending in report',observedAt:new Date().toISOString()});
 f.control('review',{actor,claimId:staffClaim});
 assert.deepEqual(readWorkflowState(f.root).epics['EPIC-006'].releaseVerification.localReviews,[]);
 assert.equal(readWorkflowState(f.root).epics['EPIC-006'].releaseVerification.lastReview.verdict,'changes-requested');
 f.observers.correction=()=>({head:f.head,pr:13,by,sessionId,evidence:'New hosted review facts replace honest pending evidence',observedAt:new Date().toISOString(),indices:[2]});
 f.control('correction',{actor});
 f.observers.activation=()=>({source:'session-harness',sessionId:f.actor.harness.sessionId,loadedRevision:f.i,policyDigest:digest,observedAt:new Date().toISOString()});
 const oldHead=f.head,oldClaims=Object.values(readWorkflowState(f.root).reviews).filter(item=>item.head===oldHead);
 f.write();f.run(f.event('commit-correction','release.verify','commit'));f.control('dispatch',{deliveryId:'commit-correction'});f.head=commit(f,'honest newly available evidence');
 f.observers.effect=()=>({operationId:'git-commit-correction',head:f.head,result:'succeeded',observedAt:new Date().toISOString()});f.control('ack',{deliveryId:'commit-correction'});
 const state=readWorkflowState(f.root),record=state.epics['EPIC-006'].releaseVerification;
 assert.equal(record.phase,'active');assert.equal(record.publishedPr,13);assert.equal(record.localReady,false);assert.equal(record.hostReady,false);assert.deepEqual(record.localReviews,[]);
 assert.equal(f.pulls[13].head.sha,oldHead,'local commit acknowledgement precedes actual push');
 assert.throws(()=>f.run(f.event('unpublished-local-head','review.ready')),/current published/);
 for(const item of oldClaims) assert.equal(Object.values(state.reviews).find(current=>current.claim.id===item.claim.id).invalidated,true);
 assert.throws(()=>f.control('review-claim',{claimId:oldClaims[0].claim.id}),/stale|readiness/);
 assert.throws(()=>f.control('publish'),/Staff|review|current published/);
 f.pulls[13].head.sha=f.i;assert.throws(()=>f.run(f.event('raced-remote','release.verify','push')),/remote head/);f.pulls[13].head.sha=oldHead;
 f.run(f.event('push-correction','release.verify','push'));f.control('dispatch',{deliveryId:'push-correction'});
 f.observers.effect=()=>({operationId:'git-push-correction',head:f.head,remoteHead:f.head,result:'succeeded',observedAt:new Date().toISOString()});
 assert.throws(()=>f.control('ack',{deliveryId:'push-correction'}),/current published/,'a successful receipt cannot override the actual stale PR2 head');
 f.pulls[13].head.sha=f.head;f.control('ack',{deliveryId:'push-correction'});
 f.run(f.event('new-local','review.ready'));f.review('code_reviewer');f.review('appsec');
 const hosted=f.run(f.event('new-host','review.ready')).review;assert.equal(hosted.pr,13);assert.equal(hosted.head,f.head);
 assert.throws(()=>f.run(f.event('unpublished-verdicts','merge.eligible')),/acknowledgements/);
 for(const item of Object.values(readWorkflowState(f.root).reviews).filter(item=>item.pr===13 && item.head===f.head)) {
  f.observers.assignment=()=>({role:item.role,by:'host-publisher',sessionId:'publisher-session',head:f.head,operationId:`final-${item.role}`});f.control('review-claim',{claimId:item.claim.id});
  f.observers.delivery=()=>({role:item.role,by:'host-publisher',sessionId:'publisher-session',head:f.head,pr:13,operationId:`final-${item.role}`,result:'succeeded'});f.control('review-ack',{claimId:item.claim.id});
 }
 assert.throws(()=>f.run(f.event('missing-final-qa','merge.eligible')),/mergeQA/);
 f.observers.mergeQA=()=>({head:f.head,pr:13,accepted:true,evidence:'Independent full pre-merge trace acceptance',by:'independent-qa',sessionId:'qa-session',observedAt:new Date().toISOString()});
 for(const review of f.reviews) review.commit_id=f.head;f.checks[0].head_sha=f.head;
 const api=f.api;f.observers.api=endpoint=>endpoint.includes('/actions/runs?')?[{workflow_runs:[{check_suite_id:1,path:'.github/workflows/workflow.yml',repository:{full_name:repository},head_sha:f.head,event:'pull_request',status:'completed',conclusion:'success'}]}]:api(endpoint);
 const eligible=f.run(f.event('actual-current-merge','merge.eligible'));assert.equal(eligible.publicationPr,13);assert.equal(eligible.originalPr,10);assert.equal(eligible.hostEvidence.head,f.head);
 f.reviews[1].commit_id=oldHead;assert.throws(()=>f.run(f.event('stale-native-review','merge.eligible')),/approval/);f.reviews[1].commit_id=f.head;
 f.j=git(f.root,'commit-tree',`${f.head}^{tree}`,'-p',f.i,'-m','actual release integration');
 f.pulls[13]={...f.pulls[13],state:'closed',merged:true,merge_commit_sha:f.j};f.main=f.j;
 assert.throws(()=>f.control('integrate',{integration:{pr:14,sha:f.j}}),/current published PR2/);
 assert.throws(()=>f.control('integrate',{integration:{pr:13,sha:'f'.repeat(40)}}),/main changed/);
 assert.throws(()=>f.control('integrate',{integration:{pr:13,sha:f.j,extra:true}}),/schema/);
 const integrated=f.control('integrate',{integration:{pr:13,sha:f.j}});
 assert.equal(integrated.phase,'integrated');assert.equal(integrated.proof.release.head,f.head);assert.equal(integrated.proof.release.integrationSha,f.j);
   const integratedRecord=readWorkflowState(f.root).epics['EPIC-006'].releaseVerification;
   assert.equal(integratedRecord.loaded.loadedRevision,f.i,'J adapter adoption belongs to the later completion stage');
   assert.throws(()=>f.run({...f.event('still-incomplete','epic.complete'),completionId:'not-yet'}),/fresh|completion|verified J/);
   const observedAt=new Date().toISOString();
   f.observers.activation=()=>({source:'session-harness',sessionId:f.actor.harness.sessionId,loadedRevision:f.j,policyDigest:digest,observedAt});
   const completion={repository,epic:'EPIC-006',pullRequest:10,submittedHead:f.h0,integrationSha:f.j,
    host:{source:'authenticated-github-api',observedAt,merged:true,mergeCommit:f.m,checks:[{id:'j-gates',name:'gates',status:'completed',conclusion:'success',head:f.j}],smoke:{revision:f.j,result:'passed'}},
    policy:{digest,loadedRevision:3},findings:{unresolved:[]},documentation:{revision:f.j,current:true},
    activation:{source:'session-harness',observedAt,active:true,agentPath:'controlled-fixture',resourceIds:['j-session']},
    cleanup:{source:'session-harness',observedAt,revalidated:true,worktrees:[],branches:[],processes:[]},correctivePullRequests:[]};
   f.observers.completion=()=>completion;
   f.observers.integration=receipt=>({source:'authenticated-github-api',observedAt,repository,pullRequest:receipt.pullRequest,integrationSha:f.j,mergeCommit:f.m,checks:completion.host.checks,smoke:completion.host.smoke});
   const completed=f.run({...f.event('complete-at-j','epic.complete'),completionId:'J-completion'});
   assert.equal(completed.completion.integrationSha,f.j);assert.equal(completed.completion.releaseVerification.release.head,f.head);
   assert.equal(readWorkflowState(f.root).epics['EPIC-006'].completed,true);
   assert.throws(()=>f.control('integrate',{integration:{pr:13,sha:f.j}}),/identity|integrated/);
 assert.throws(()=>withWorkflowState(f.root,state=>{state.epics['EPIC-006'].releaseVerification.localReady=true;}),/malformed/);
 withWorkflowState(f.root,state=>{delete state.epics['EPIC-006'].releaseVerification;});
 assert.throws(()=>f.control('gate'),/missing/);
 assert.throws(()=>f.run(f.event('fresh-clone','review.ready')),/runtime|release/);
});

test('fresh-checkout real CI entrypoint succeeds without runtime or PR1 reviews while standalone publication gate denies',t=>{
 const f=fixture(t),responses={};
 adoption.provePolicyAdoption({...f.options(),api:(endpoint,options)=>{const value=f.api(endpoint,options);responses[endpoint]=value;return value;}});
 const transport=fs.mkdtempSync(path.join(os.tmpdir(),'adoption-controlled-host-'));t.after(()=>fs.rmSync(transport,{recursive:true,force:true}));
 const stateFile=path.join(transport,'responses.json');fs.writeFileSync(stateFile,JSON.stringify(responses));
 const preload=controlledHostArgs({stateFile});
 const env={...process.env,BASE_SHA:f.f,HEAD_SHA:f.h1,HEAD_REF:'epic/EPIC-006'};
 const result=spawnSync(process.execPath,[...preload,path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/committed provenance verified/);
 const wrongBranch=spawnSync(process.execPath,[...preload,path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env:{...env,HEAD_REF:'epic/EPIC-007'}});
 assert.equal(wrongBranch.status,1);assert.match(wrongBranch.stderr,/Policy adoption.*branch/);
 const local=spawnSync(process.execPath,[...preload,path.join(source,'scripts/check-gate.mjs'),'epics/EPIC-006/epic-plan.md','policy-adoption-pr'],{cwd:f.root,encoding:'utf8',env});
 assert.equal(local.status,1);assert.match(local.stderr,/harness/);
 for(const name of ['epic-plan.md','epic.md']) edit(f,`epics/EPIC-006/${name}`,text=>text.replace('status: merged','status: in-progress'));
 f.h1=commit(f,'attempt to select ordinary CI using candidate status');
 const tampered=spawnSync(process.execPath,[...preload,path.join(source,'scripts/check-pr.mjs')],{cwd:f.root,encoding:'utf8',env:{...env,HEAD_SHA:f.h1}});
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
 withFixtureFetch({root:clone,canonicalURL:'https://github.com/dpitcock/ai-toolkit.git',fixtureURL:`file://${f.root}`,revision:f.h0},()=>adoption.materializePolicyAdoptionHistory({...f.options(),root:clone}));
 assert.equal(git(clone,'rev-parse','HEAD'),f.h1);
 assert.equal(adoption.provePolicyAdoption({...f.options(),root:clone}).original.submittedHead,f.h0);
});
