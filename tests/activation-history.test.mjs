import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ACTIVATION_START,ACTIVATION_END,replaceActivationBlock} from '../scripts/lib/activation-report.mjs';
const url=new URL('../scripts/lib/activation-history.mjs',import.meta.url),module=fs.existsSync(url)?await import(url):{};
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'activation-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 git(root,'init','-q');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.test');
 for(const dir of ['docs','project']) fs.mkdirSync(path.join(root,dir));
 const document=`before\r\n${ACTIVATION_START}\npending\n${ACTIVATION_END}\r\nafter\n`;
 fs.writeFileSync(path.join(root,'docs/verification.md'),document);fs.writeFileSync(path.join(root,'source.mjs'),'original\n');
 const commit=()=>{git(root,'add','-A');git(root,'commit','-qm','fixture');return git(root,'rev-parse','HEAD');};
 const base=commit(),digest='b'.repeat(64),report={version:1,epic:'EPIC-006',repository:'dpitcock/ai-toolkit',activationBase:base,loadedRevision:base,policyDigest:digest,observations:[{kind:'activation',status:'observed',at:'2026-09-26T12:00:00.000Z',head:base,references:[{type:'session',id:'fixture'}]}]};
 function write() {fs.writeFileSync(path.join(root,'project/EPIC-006-activation-evidence.json'),JSON.stringify(report)+'\n');fs.writeFileSync(path.join(root,'docs/verification.md'),replaceActivationBlock(document,report));}
 write();const head=commit();return {root,base,head,digest,report,write,commit,document};
}
test('each submitted and squash snapshot restricts evidence changes and preserves document bytes',t=>{
 assert.equal(typeof module.assertActivationHistory,'function','history proof is required');
 const f=fixture(t),result=module.assertActivationHistory(f);
 assert.deepEqual(result.paths,['docs/verification.md','project/EPIC-006-activation-evidence.json']);
 const integrated=git(f.root,'commit-tree',`${f.head}^{tree}`,'-p',f.base,'-m','squash');
 assert.deepEqual(module.assertActivationHistory({...f,head:integrated}).report,f.report);
});
test('rebased evidence commits are checked individually and unrelated merges are rejected',t=>{
 const f=fixture(t);f.report.observations.push({kind:'smoke',status:'pending',at:null,head:null,references:[]});f.write();const second=f.commit();
 const firstRebased=git(f.root,'commit-tree',`${f.head}^{tree}`,'-p',f.base,'-m','rebased first');
 const secondRebased=git(f.root,'commit-tree',`${second}^{tree}`,'-p',firstRebased,'-m','rebased second');
 assert.equal(module.assertActivationHistory({...f,head:secondRebased}).nonempty.length,2);
 const unrelated=git(f.root,'commit-tree',`${second}^{tree}`,'-p',f.head,'-p',firstRebased,'-m','unrelated merge');
 assert.throws(()=>module.assertActivationHistory({...f,head:unrelated,integratedHead:second}),/unrelated merge/);
});
for(const [label,change] of [
 ['source edit',f=>fs.appendFileSync(path.join(f.root,'source.mjs'),'hidden')],
 ['outside marker',f=>fs.appendFileSync(path.join(f.root,'docs/verification.md'),'hidden')],
 ['non-rendered block',f=>fs.writeFileSync(path.join(f.root,'docs/verification.md'),f.document)],
 ['wrong base',f=>{f.report.activationBase='c'.repeat(40);f.write();}],
 ['wrong policy',f=>{f.report.policyDigest='c'.repeat(64);f.write();}],
 ['mode',f=>fs.chmodSync(path.join(f.root,'project/EPIC-006-activation-evidence.json'),0o755)],
 ['symlink',f=>{const p=path.join(f.root,'project/EPIC-006-activation-evidence.json');fs.unlinkSync(p);fs.symlinkSync('../source.mjs',p);}],
]) test(`evidence history rejects ${label}`,t=>{
 assert.equal(typeof module.assertActivationHistory,'function');const f=fixture(t);change(f);f.head=f.commit();assert.throws(()=>module.assertActivationHistory(f));
});
test('hidden source edit/revert is rejected even when the final source snapshot is unchanged',t=>{
 assert.equal(typeof module.assertActivationHistory,'function');const f=fixture(t);
 fs.writeFileSync(path.join(f.root,'source.mjs'),'changed');f.commit();fs.writeFileSync(path.join(f.root,'source.mjs'),'original\n');f.head=f.commit();
 assert.throws(()=>module.assertActivationHistory(f),/unauthorized/);
});
test('empty commits and integration merge commits are excluded from nonempty action receipts',t=>{
 const f=fixture(t);git(f.root,'commit','--allow-empty','-qm','empty');f.head=git(f.root,'rev-parse','HEAD');
 assert.equal(module.assertActivationHistory(f).nonempty.length,1);
 const merged=git(f.root,'commit-tree',`${f.head}^{tree}`,'-p',f.base,'-p',f.head,'-m','integration');
 assert.equal(module.assertActivationHistory({...f,head:merged,integratedHead:f.head}).nonempty.length,1);
});
test('local replacement refs cannot hide actual outside-marker bytes from immutable snapshots',t=>{
 const f=fixture(t),good=git(f.root,'rev-parse',`${f.head}:docs/verification.md`);
 fs.appendFileSync(path.join(f.root,'docs/verification.md'),'unauthorized outside bytes\n');f.head=f.commit();
 const bad=git(f.root,'rev-parse',`${f.head}:docs/verification.md`);
 assert.throws(()=>module.assertActivationHistory(f),/outside bytes/);
 git(f.root,'replace',bad,good);
 assert.throws(()=>module.assertActivationHistory(f),/outside bytes/,'replace refs must not conceal committed bytes');
});
