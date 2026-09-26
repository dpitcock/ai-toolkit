import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const url=new URL('../scripts/lib/activation-report.mjs',import.meta.url);
const module=fs.existsSync(url)?await import(url):{};
const base='a'.repeat(40),digest='b'.repeat(64);
function report() {return {version:1,epic:'EPIC-006',repository:'dpitcock/ai-toolkit',activationBase:base,loadedRevision:base,policyDigest:digest,observations:[
 {kind:'activation',status:'observed',at:'2026-09-26T12:00:00.000Z',head:base,references:[{type:'session',id:'observed-session:1'}]},
 {kind:'host-review',status:'pending',at:null,head:null,references:[]},
 {kind:'reconciliation',status:'not-exercised',at:null,head:null,references:[]},
]};}
test('bounded report explicitly renders observed, pending, and unexercised data inside fixed markers only',()=>{
 assert.equal(typeof module.validateActivationReport,'function','strict report validator is required');
 const value=module.validateActivationReport(report());
 const original=`prefix\r\n${module.ACTIVATION_START}\nold block\n${module.ACTIVATION_END}\r\nsuffix\n`;
 const rendered=module.renderActivationBlock(value),updated=module.replaceActivationBlock(original,value);
 assert.equal(updated,`prefix\r\n${rendered}\r\nsuffix\n`);
 for(const status of ['observed','pending','not-exercised']) assert.ok(rendered.includes(status));
 assert.match(rendered,/EPIC-006-activation-evidence.json/);
 assert.deepEqual(module.validateActivationReport(JSON.stringify(value)),value);
});
test('report schema rejects authority, commands, injection, alternate references and unbounded data',()=>{
 assert.equal(typeof module.validateActivationReport,'function');
 const mutations=[r=>r.command='sh',r=>r.version=2,r=>r.epic='EPIC-007',r=>r.observations[0].kind='execute',
  r=>r.observations[0].status='approved',r=>r.observations[0].at='yesterday',r=>r.observations[0].head=null,
  r=>r.activationBase=[r.activationBase],r=>r.loadedRevision=[r.loadedRevision],r=>r.policyDigest=[r.policyDigest],r=>r.observations[0].head=[r.observations[0].head],
  r=>r.observations[1].references=[{type:'runtime',id:'false-observation'}],r=>r.observations[0].references[0].path='/tmp/data',
  r=>r.observations[0].references[0].id='[click](https://evil.test)',r=>r.observations[0].references[0].id='<!-- EPIC-006 -->',
  r=>r.observations[0].references[0].id='$(touch owned)',r=>r.observations[0].references[0].id='../elsewhere',
  r=>r.observations=Array.from({length:129},()=>r.observations[0]),r=>r.observations[0].references[0].id='a'.repeat(201)];
 for(const mutate of mutations) {const r=report();mutate(r);assert.throws(()=>module.validateActivationReport(r));}
 assert.throws(()=>module.validateActivationReport(' '.repeat(32769)),/bound/);
});
test('marker parser rejects missing, duplicate, reversed and injected blocks',()=>{
 assert.equal(typeof module.replaceActivationBlock,'function');
 const {ACTIVATION_START:a,ACTIVATION_END:b}=module;
 for(const text of ['',`${b}\n${a}`,`${a}\n${a}\n${b}`,`${a}\n${b}\n${b}`,`prefix${a}\n${b}`]) assert.throws(()=>module.replaceActivationBlock(text,report()),/marker/);
});
