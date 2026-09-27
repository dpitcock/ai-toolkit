import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readWorkflowState,workflowStatePath,withWorkflowState} from '../scripts/lib/workflow-state.mjs';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(root,args) { return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(); }
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-state-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 run(root,['init','--initial-branch=main']);run(root,['config','user.email','tests@example.test']);run(root,['config','user.name','Tests']);
 fs.writeFileSync(path.join(root,'README.md'),'fixture\n');run(root,['add','README.md']);run(root,['commit','-m','fixture']);
 return root;
}
function linkedWorktree(t,root) {
 const linked=path.join(path.dirname(root),`${path.basename(root)}-linked`);
 t.after(()=>fs.rmSync(linked,{recursive:true,force:true}));
 run(root,['worktree','add','-b','epic/EPIC-999',linked]);
 return linked;
}
function stateWith(root,record) {
 withWorkflowState(root,state=>{Object.assign(state,record);});
 return readWorkflowState(root);
}

test('initializes versioned, separate workflow record collections',t=>{
 const root=fixture(t);
 assert.deepEqual(readWorkflowState(root),{
  version:1,authorizations:{},dispatches:{},reviews:{},epics:{},
 });
 const state=stateWith(root,{authorizations:{permit:{id:'permit'}},dispatches:{claim:{id:'claim'}},reviews:{pr:{id:'pr'}},epics:{EPIC_999:{id:'EPIC-999'}}});
 assert.equal(state.authorizations.permit.id,'permit');
 assert.equal(state.dispatches.claim.id,'claim');
 assert.equal(state.reviews.pr.id,'pr');
 assert.equal(state.epics.EPIC_999.id,'EPIC-999');
});

test('concurrent writers serialize and preserve both updates',async t=>{
 const root=fixture(t),moduleUrl=pathToFileURL(path.join(source,'scripts/lib/workflow-state.mjs')).href;
 const writer=key=>new Promise((resolve,reject)=>{
  const code=`import {withWorkflowState} from ${JSON.stringify(moduleUrl)};withWorkflowState(process.argv[1],state=>{state.authorizations[process.argv[2]]={id:process.argv[2]};});`;
  const child=spawn(process.execPath,['--input-type=module','-e',code,root,key]);
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('close',code=>code===0?resolve():reject(new Error(stderr)));
 });
 await Promise.all([writer('first'),writer('second')]);
 assert.deepEqual(Object.keys(readWorkflowState(root).authorizations).sort(),['first','second']);
});

test('uncommitted interrupted-write debris retains the last valid state',t=>{
 const root=fixture(t);stateWith(root,{epics:{EPIC_999:{phase:'ready'}}});
 const file=workflowStatePath(root);fs.writeFileSync(`${file}.tmp-interrupted`,'{not json');
 assert.deepEqual(readWorkflowState(root).epics,{EPIC_999:{phase:'ready'}});
 assert.equal(fs.existsSync(`${file}.tmp-interrupted`),true);
});

test('malformed, symlinked, and unsupported-version state fails closed',t=>{
 const root=fixture(t),file=workflowStatePath(root);fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,'{bad json');assert.throws(()=>readWorkflowState(root),/malformed/i);
 fs.writeFileSync(file,JSON.stringify({version:2,authorizations:{},dispatches:{},reviews:{},epics:{}}));
 assert.throws(()=>readWorkflowState(root),/version/i);
 fs.rmSync(file);const target=path.join(root,'elsewhere.json');fs.writeFileSync(target,'{}');fs.symlinkSync(target,file);
 assert.throws(()=>readWorkflowState(root),/symbolic link|regular file/i);
});

test('linked worktrees use their shared Git common state',t=>{
 const root=fixture(t),linked=linkedWorktree(t,root);
 withWorkflowState(linked,state=>{state.reviews.shared={head:'abc'};});
 assert.equal(workflowStatePath(root),workflowStatePath(linked));
 assert.deepEqual(readWorkflowState(root).reviews.shared,{head:'abc'});
});

test('mutations must be synchronous and leave state unchanged when they fail',t=>{
 const root=fixture(t);const before=readWorkflowState(root);
 assert.throws(()=>withWorkflowState(root,()=>Promise.resolve()),/synchronous/i);
 assert.throws(()=>withWorkflowState(root,()=>{throw new Error('stop');}),/stop/);
 assert.deepEqual(readWorkflowState(root),before);
});
