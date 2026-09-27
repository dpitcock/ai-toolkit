import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {githubJSON,hostPages} from '../scripts/lib/epic-finalization.mjs';
import {respond as publisherResponse} from './helpers/publisher-host.mjs';

const helperURL=new URL('./helpers/controlled-host.mjs',import.meta.url);
const transport=fs.existsSync(helperURL)?await import(helperURL):{};
const endpoint='repos/example/repo/pulls/7';
const options={encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:8*1024*1024};

test('controlled host preserves real githubJSON argv, bounds, pagination and failure handling',()=>{
 assert.equal(typeof transport.installControlledHost,'function','test-only bounded host transport is required');
 const calls=[];
 const restore=transport.installControlledHost({respond:(requested,{paginate})=>{
  calls.push({requested,paginate});
  if(requested.endsWith('/missing')) throw new Error('unknown controlled endpoint');
  if(requested.endsWith('/invalid-json')) return '{';
  return JSON.stringify(paginate?[[{id:7}]]:{number:7});
 }});
 try {
  assert.deepEqual(githubJSON(endpoint),{number:7});
  assert.deepEqual(hostPages(githubJSON(endpoint,{paginate:true})),[{id:7}]);
  assert.deepEqual(calls,[{requested:endpoint,paginate:false},{requested:endpoint,paginate:true}]);
  for(const args of [['api','--paginate',endpoint],['api',endpoint,'--slurp'],['auth','status'],['api','https://example.test'],['api',endpoint+'\n']]) {
   assert.throws(()=>execFileSync('gh',args,options),/controlled host.*argv/);
  }
  for(const changed of [{timeout:0},{maxBuffer:16*1024*1024},{encoding:'buffer'},{stdio:'inherit'}]) {
   assert.throws(()=>execFileSync('gh',['api',endpoint],{...options,...changed}),/controlled host.*options/);
  }
  assert.equal(calls.length,2,'invalid commands cannot reach the controlled responder');
  assert.throws(()=>githubJSON('repos/example/repo/missing'),/authenticated GitHub observation unavailable/);
  assert.throws(()=>githubJSON('repos/example/repo/invalid-json'),/authenticated GitHub observation unavailable/);
  assert.equal(execFileSync('/bin/echo',['unrelated-command'],{encoding:'utf8'}),'unrelated-command\n');
 } finally {restore();}
});

test('explicit child preload reads exact endpoint map and fails closed on an unknown endpoint',t=>{
 assert.equal(typeof transport.controlledHostArgs,'function','explicit per-child preload arguments are required');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'controlled-host-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const stateFile=path.join(dir,'responses.json');fs.writeFileSync(stateFile,JSON.stringify({[endpoint]:{number:7}}));
 const moduleURL=new URL('../scripts/lib/epic-finalization.mjs',import.meta.url).href;
 const result=spawnSync(process.execPath,[...transport.controlledHostArgs({stateFile}),'--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {githubJSON} from ${JSON.stringify(moduleURL)};
  assert.deepEqual(githubJSON(${JSON.stringify(endpoint)}),{number:7});
  assert.throws(()=>githubJSON('repos/example/repo/unknown'),/authenticated GitHub observation unavailable/);
 `],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('publisher profile permits only the existing status-write contract and keeps malformed writes closed',()=>{
 const publisherOptions={encoding:'utf8',stdio:['ignore','pipe','pipe']};
 const args=['api','repos/example/repo/statuses/'+'a'.repeat(40),'--method','POST','-f','state=pending','-f','context=host-review-gate','-f','description=Current-head host review gate: pending'];
 const calls=[];
 const restore=transport.installControlledHost({profile:'publisher',respond:(endpoint,context)=>{calls.push({endpoint,...context});return '{}';}});
 try {
  assert.equal(execFileSync('gh',args,publisherOptions),'{}');
  assert.equal(calls.length,1);assert.deepEqual(calls[0].args,args);
  for(const [index,value] of [[2,'--hostname'],[3,'DELETE'],[5,'state=forged'],[7,'context=other'],[9,'description=forged']]) {
   const bad=[...args];bad[index]=value;assert.throws(()=>execFileSync('gh',bad,publisherOptions),/controlled host.*argv/);
  }
  assert.throws(()=>execFileSync('gh',['api',endpoint],options),/controlled host.*options/);
  assert.equal(calls.length,1,'invalid writes never reach controlled host state');
 } finally {restore();}
});

test('scoped fixture fetch refuses unexpected network commands and preserves other Git execution',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'controlled-fetch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 transport.withFixtureFetch({root,canonicalURL:'https://example.invalid/repo',fixtureURL:'file:///fixture',revision:'a'.repeat(40)},()=>{
  assert.throws(()=>execFileSync('git',['-C',root,'fetch','file:///unavailable-test-fixture']),/controlled fixture.*fetch/);
  assert.match(execFileSync('git',['--version'],{encoding:'utf8'}),/^git version /);
 });
});

test('controlled publisher rejects writes to an unknown repository or head',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'controlled-publisher-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const stateFile=path.join(root,'fixture.json');fs.writeFileSync(stateFile,JSON.stringify({keychain:true,head:'a'.repeat(40)}));
 for(const route of ['repos/other/repo/statuses/'+'a'.repeat(40),'repos/owner/repo/statuses/'+'b'.repeat(40)]) {
  assert.throws(()=>publisherResponse(stateFile,route,{args:['api',route,'--method','POST']}),/Unexpected gh endpoint/);
 }
});
