import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import test from 'node:test';
import {controlledHostArgs} from './helpers/controlled-host.mjs';
import {policyAdoptionStage} from '../scripts/lib/epic-policy-adoption.mjs';

const head='a'.repeat(40),base='b'.repeat(40);
const roles=['code_reviewer','principal','qa','appsec','accessibility_reviewer','ui_designer'];
const identities=Object.fromEntries(roles.map(role=>[role,{actor:role,kind:'human',provenance:{source:'owner-mapping',id:role}}]));
function run(t,overrides={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'path-publisher-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const stateFile=path.join(root,'state.json');
  const {approvedRoles=['code_reviewer'],configuredRoles=['code_reviewer','appsec'],pendingLegacyRelease=false,...rest}=overrides;
  const state={head,base,pr:99,changedFiles:1,policy:fs.readFileSync('policy/review-paths.json','utf8'),
    files:[[{filename:'tests/ordinary.test.mjs',status:'modified'}]],
    reviews:approvedRoles.map((role,id)=>({id:id+1,user:{login:role,type:'User'},state:'APPROVED',commit_id:head,submitted_at:'2026-09-27T17:00:00Z'})),...rest};
  fs.writeFileSync(stateFile,JSON.stringify(state));
  if(pendingLegacyRelease) {
    for(const name of ['config/workspace-config.yaml','project/workspace-config-history.jsonl']) {
      fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.copyFileSync(name,path.join(root,name));
    }
    fs.mkdirSync(path.join(root,'epics/EPIC-006'),{recursive:true});
    fs.writeFileSync(path.join(root,'epics/EPIC-006/epic-plan.md'),'---\nid: EPIC-006-PLAN\nrevision: 1\nstatus: merged\n---\n');
    const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'pipe'});
    git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
    git('remote','add','origin','https://github.com/dpitcock/ai-toolkit.git');
    git('add','.');git('commit','-qm','pending legacy release');
    const revision=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
    assert.equal(policyAdoptionStage({root,baseSha:revision}),'pending');
  }
  const preload=controlledHostArgs({stateFile,responderURL:new URL('./helpers/path-publisher-host.mjs',import.meta.url),profile:'publisher'});
  const result=spawnSync(process.execPath,[...preload,path.resolve('scripts/check-host-reviews.mjs'),'--publish','--repository','dpitcock/ai-toolkit',
    '--pr',String(state.pr),'--required-roles',JSON.stringify(configuredRoles),'--identities',JSON.stringify(identities)],{encoding:'utf8',cwd:pendingLegacyRelease?root:process.cwd()});
  const calls=JSON.parse(fs.readFileSync(`${stateFile}.calls`,'utf8'));
  return {...result,calls,posts:calls.filter(call=>call.includes('POST'))};
}

test('trusted publisher accepts Code Reviewer alone on new authoring PRs',t=>{
  const result=run(t);
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.posts.at(-1).includes('state=success'));
  assert.ok(result.calls.some(call=>call.at(-1)===`repos/dpitcock/ai-toolkit/contents/policy/review-paths.json?ref=${base}`));
  assert.ok(!result.calls.some(call=>call.at(-1).includes(`policy/review-paths.json?ref=${head}`)));
});

test('pending legacy adoption gates cannot block a new authoring PR',t=>{
  const result=run(t,{pendingLegacyRelease:true});
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.posts.at(-1).includes('state=success'));
});

test('shipped-path PRs require QA and AppSec, plus configured production roles',t=>{
  const production={files:[[{filename:'scripts/check-gate.mjs',status:'modified'}]]};
  const missing=run(t,production);
  assert.notEqual(missing.status,0);assert.match(missing.stderr,/qa.*approval/);
  assert.ok(missing.posts.at(-1).includes('state=failure'));
  const all=run(t,{...production,approvedRoles:roles,configuredRoles:roles});
  assert.equal(all.status,0,all.stderr);
  const noSecurity=run(t,{...production,approvedRoles:['code_reviewer','qa']});
  assert.notEqual(noSecurity.status,0);assert.match(noSecurity.stderr,/appsec.*approval/);
});

test('publisher reads all diff pages and retains the old path of a moved policy file',t=>{
  const result=run(t,{changedFiles:2,files:[[{filename:'tests/ordinary.test.mjs',status:'modified'}],
    [{filename:'tests/renamed.mjs',previous_filename:'scripts/check-gate.mjs',status:'renamed'}]]});
  assert.notEqual(result.status,0);assert.match(result.stderr,/qa.*approval/);
  assert.ok(result.calls.some(call=>call.includes('--paginate') && call.at(-1).endsWith('/files?per_page=100')));
});

for(const [name,patch,reason] of [
  ['missing file page',{changedFiles:2},/incomplete/],
  ['duplicate file',{changedFiles:2,files:[[{filename:'tests/a',status:'modified'},{filename:'tests/a',status:'modified'}]]},/duplicate/],
  ['missing rename source',{files:[[{filename:'tests/a',status:'renamed'}]]},/rename/],
  ['malformed base policy',{policy:'{}'},/manifest/],
  ['missing policy',{policyResource:{}},/missing or malformed/],
  ['symlink policy',{policyResource:{type:'symlink',path:'policy/review-paths.json'}},/missing or malformed/],
  ['head race',{headRace:true},/head changed/],
  ['base race',{baseRace:true},/base changed/],
]) test(`publisher refuses ${name}`,t=>{
  const result=run(t,patch);assert.notEqual(result.status,0);assert.match(result.stderr,reason);
  assert.ok(result.posts.at(-1).includes('state=failure'));
});

test('already-open PR requirements are preserved',t=>{
  const result=run(t,{pr:13});
  assert.notEqual(result.status,0);assert.match(result.stderr,/appsec.*approval/);
});

for(const field of ['baseRace','headRace']) test(`late ${field} revokes a published success`,t=>{
  const result=run(t,{[field]:7});
  assert.notEqual(result.status,0);
  assert.ok(result.posts.some(post=>post.includes('state=success')));
  assert.ok(result.posts.at(-1).includes('state=failure'));
});
