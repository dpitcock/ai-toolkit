import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {controlledHostArgs} from './helpers/controlled-host.mjs';

const head='a'.repeat(40),base='b'.repeat(40);
const roles=['code_reviewer','principal','qa','appsec','accessibility_reviewer','ui_designer'];
const identities=Object.fromEntries(roles.map(role=>[role,{actor:role,kind:'human',provenance:{source:'owner-mapping',id:role}}]));
function run(t,overrides={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'path-publisher-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const stateFile=path.join(root,'state.json');
  const {approvedRoles=['code_reviewer'],configuredRoles=['code_reviewer','appsec'],...rest}=overrides;
  const state={head,base,pr:99,changedFiles:1,policy:fs.readFileSync('policy/review-paths.json','utf8'),
    files:[[{filename:'tests/ordinary.test.mjs',status:'modified'}]],
    reviews:approvedRoles.map((role,id)=>({id:id+1,user:{login:role,type:'User'},state:'APPROVED',commit_id:head,submitted_at:'2026-09-27T17:00:00Z'})),...rest};
  fs.writeFileSync(stateFile,JSON.stringify(state));
  const preload=controlledHostArgs({stateFile,responderURL:new URL('./helpers/path-publisher-host.mjs',import.meta.url),profile:'publisher'});
  const result=spawnSync(process.execPath,[...preload,'scripts/check-host-reviews.mjs','--publish','--repository','dpitcock/ai-toolkit',
    '--pr',String(state.pr),'--required-roles',JSON.stringify(configuredRoles),'--identities',JSON.stringify(identities)],{encoding:'utf8'});
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
