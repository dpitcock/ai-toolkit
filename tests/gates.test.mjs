import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import {check,readDocument} from '../scripts/check-gate.mjs';
function fixture(t,sensitive=false) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blueprint-test-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const approval={by:'reviewer',date:'2026-09-07',notes:'Reviewed evidence',revision:1};
 const base={owner:'developer',revision:1,approvals:{principal_engineer:null,appsec:null,qa_lead:null,code_review:null,appsec_review:null,accessibility:null,accessibility_review:null}};
 const security={auth:sensitive,data:false,external:false,concerns:[],rationale:'Assessed scope'};
 const accessibility={ui:false,rationale:'No user-facing interface changes'};
 const docs={
  'project.md':{...structuredClone(base),kind:'project',id:'PROJECT',status:'approved'},
  'epic.md':{...structuredClone(base),kind:'epic',id:'EPIC-001',status:'approved',parent:'project.md',parent_revision:1,security,accessibility,qa_requirements:['unit and integration']},
  'plan.md':{...structuredClone(base),kind:'epic-plan',id:'PLAN',status:'approved',parent:'epic.md',parent_revision:1,security,accessibility,touches_concerns:[],tasks:['task.md'],review_comments:[]},
  'task.md':{...structuredClone(base),kind:'task',id:'TASK-001',status:'draft',parent:'plan.md',parent_revision:1,depends_on:[]}
 };
 docs['project.md'].approvals.principal_engineer=approval;
 docs['epic.md'].approvals.qa_lead=approval; docs['epic.md'].approvals.appsec=sensitive?approval:'not-required';
 docs['plan.md'].approvals.principal_engineer=approval; docs['plan.md'].approvals.appsec=sensitive?approval:'not-required';
 const save=()=>Object.entries(docs).forEach(([f,d])=>fs.writeFileSync(path.join(root,f),'---\n'+YAML.stringify(d,{aliasDuplicateObjects:false})+'---\nBody\n'));
 save(); return {root,docs,save,approval,run:(f,s,write=false)=>check(path.join(root,f),s,{root,write})};
}
test('low-risk plan can build; principal is still mandatory',t=>{const f=fixture(t);assert.match(f.run('plan.md','in-progress'),/permitted/);f.docs['plan.md'].approvals.principal_engineer=null;f.save();assert.throws(()=>f.run('plan.md','in-progress'),/principal/);});
test('sensitive plan cannot waive AppSec and must sequence approvals',t=>{const f=fixture(t,true);f.docs['plan.md'].approvals.appsec='not-required';f.save();assert.throws(()=>f.run('plan.md','in-progress'),/appsec/);f.docs['plan.md'].approvals.appsec=f.approval;f.docs['plan.md'].status='awaiting-principal-signoff';f.save();assert.throws(()=>f.run('plan.md','approved'),/Principal then/);f.run('plan.md','awaiting-appsec-signoff',true);f.run('plan.md','approved',true);});
test('flagged epic concern only requires plan signoff when touched',t=>{const f=fixture(t);f.docs['epic.md'].security={...f.docs['epic.md'].security,concerns:['SEC-1']};f.docs['epic.md'].approvals.appsec=f.approval;f.save();f.run('plan.md','in-progress');f.docs['plan.md'].touches_concerns=['SEC-1'];f.save();assert.throws(()=>f.run('plan.md','in-progress'),/appsec/);});
test('UI plans require independent accessibility signoff before implementation',t=>{const f=fixture(t);f.docs['plan.md'].accessibility={ui:true,rationale:'Adds a keyboard-operated settings form'};f.save();assert.throws(()=>f.run('plan.md','in-progress'),/accessibility/);f.docs['plan.md'].approvals.accessibility=f.approval;f.docs['plan.md'].status='awaiting-principal-signoff';f.save();assert.throws(()=>f.run('plan.md','approved'),/Accessibility signoff/);f.run('plan.md','awaiting-accessibility-signoff',true);f.run('plan.md','approved',true);});
test('UI plans require final accessibility review of the reviewed commit',t=>{const f=fixture(t);const commit='a'.repeat(40);f.docs['task.md'].status='done';f.docs['task.md'].evidence={red:'Expected test failure',green:'Tests pass',qa:'QA passes',commit:'abcdef1'};f.docs['plan.md'].accessibility={ui:true,rationale:'Updates navigation controls'};f.docs['plan.md'].status='in-appsec-review';f.docs['plan.md'].review_commit=commit;f.docs['plan.md'].approvals.accessibility=f.approval;f.docs['plan.md'].approvals.code_review={...f.approval,commit};f.docs['plan.md'].approvals.appsec_review={...f.approval,commit};f.save();assert.throws(()=>f.run('plan.md','ready-for-pr'),/accessibility_review/);f.docs['plan.md'].approvals.accessibility_review={...f.approval,commit};f.save();f.run('plan.md','in-accessibility-review',true);f.run('plan.md','ready-for-pr',true);});
test('QA, project, revision, and independent reviewer gates fail closed',t=>{for(const mutation of [d=>d['epic.md'].approvals.qa_lead=null,d=>d['project.md'].status='draft',d=>d['plan.md'].revision=2,d=>d['plan.md'].approvals.principal_engineer={by:'developer',date:'2026-09-07',notes:'Self',revision:1},d=>d['epic.md'].revision=2]) {const f=fixture(t);mutation(f.docs);f.save();assert.throws(()=>f.run('plan.md','in-progress'));}});
test('cannot skip statuses, use malformed YAML, or unknown target',t=>{const f=fixture(t);assert.throws(()=>f.run('plan.md','merged'));assert.throws(()=>f.run('plan.md','bogus'));fs.appendFileSync(path.join(f.root,'task.md'),'');fs.writeFileSync(path.join(f.root,'task.md'),'---\nkind: task\nkind: epic\n---\n');assert.throws(()=>f.run('task.md','approved'),/unique|map|key/i);});
test('task needs started plan and evidence; status write preserves body',t=>{const f=fixture(t);f.run('task.md','approved',true);assert.throws(()=>f.run('task.md','in-progress'),/Start/);f.run('plan.md','in-progress',true);f.run('task.md','in-progress',true);assert.throws(()=>f.run('task.md','in-review'),/evidence/);assert.match(fs.readFileSync(path.join(f.root,'task.md'),'utf8'),/Body/);});
test('task completion needs local evidence and a commit, not staff code review',t=>{
 const f=fixture(t);
 f.docs['plan.md'].status='in-progress';
 f.docs['task.md'].evidence={red:'Expected test failure',green:'Focused test passed',qa:'Full QA passed',commit:'abcdef1'};
 f.save();
 f.run('task.md','approved',true);
 f.run('task.md','in-progress',true);
 f.run('task.md','in-review',true);
 f.run('task.md','done',true);
 const task=readDocument(path.join(f.root,'task.md')).data;
 assert.equal(task.status,'done');
 assert.equal(task.approvals.code_review,null);
 f.run('plan.md','in-review',true);
 assert.throws(()=>f.run('plan.md','in-appsec-review'),/code_review/);
});
test('all tasks and both final reviews are required even when low risk',t=>{const f=fixture(t);f.docs['plan.md'].status='in-progress';f.save();assert.throws(()=>f.run('plan.md','in-review'),/done/);f.docs['task.md'].status='done';f.docs['task.md'].evidence={red:'test failed as expected',green:'tests passed',qa:'integration passed',commit:'abcdef1'};f.save();f.run('plan.md','in-review',true);assert.throws(()=>f.run('plan.md','in-appsec-review'),/code_review/);f.docs['plan.md'].status='in-review';f.docs['plan.md'].review_commit='a'.repeat(40);f.docs['plan.md'].approvals.code_review={...f.approval,commit:'a'.repeat(40)};f.save();f.run('plan.md','in-appsec-review',true);assert.throws(()=>f.run('plan.md','ready-for-pr'),/appsec_review/);f.docs['plan.md'].status='in-appsec-review';f.docs['plan.md'].approvals.appsec_review={...f.approval,commit:'b'.repeat(40)};f.save();assert.throws(()=>f.run('plan.md','ready-for-pr'),/same implementation/);f.docs['plan.md'].approvals.appsec_review.commit='a'.repeat(40);f.save();f.run('plan.md','ready-for-pr',true);});
test('code reviewer verifies every finding on the final review commit',t=>{const f=fixture(t);const commit='a'.repeat(40);f.docs['task.md'].status='done';f.docs['task.md'].evidence={red:'Expected failure',green:'Tests pass',qa:'QA passes',commit:'abcdef1'};f.docs['plan.md'].status='in-review';f.docs['plan.md'].review_commit=commit;f.docs['plan.md'].approvals.code_review={...f.approval,commit};f.docs['plan.md'].review_comments=[{id:'CR-001',status:'open'}];f.save();assert.throws(()=>f.run('plan.md','in-appsec-review'),/review comments/);f.docs['plan.md'].review_comments=[{id:'CR-001',status:'resolved',resolution_commit:commit,verified_by:'reviewer',verified_date:'2026-09-07',verified_commit:commit}];f.save();f.run('plan.md','in-appsec-review',true);});
test('rework clears both final approvals',t=>{const f=fixture(t);f.docs['plan.md'].status='in-appsec-review';f.docs['plan.md'].approvals.code_review=f.approval;f.docs['plan.md'].approvals.appsec_review=f.approval;f.save();f.run('plan.md','in-progress',true);const d=readDocument(path.join(f.root,'plan.md')).data;assert.equal(d.approvals.code_review,null);assert.equal(d.approvals.appsec_review,null);});
test('parent traversal outside repository is rejected',t=>{const f=fixture(t);f.docs['plan.md'].parent='../missing.md';f.save();assert.throws(()=>f.run('plan.md','in-progress'));});
test('reset invalidates approvals and increments revision',t=>{const f=fixture(t);f.run('plan.md','draft',true);const d=readDocument(path.join(f.root,'plan.md')).data;assert.equal(d.revision,2);assert.equal(d.status,'draft');assert.ok(Object.values(d.approvals).every(a=>a===null));});
test('unfinished declared dependency blocks a task',t=>{const f=fixture(t);f.docs['plan.md'].tasks.push('second.md');f.docs['second.md']={...structuredClone(f.docs['task.md']),id:'TASK-002',depends_on:['task.md']};f.save();assert.throws(()=>f.run('second.md','approved'),/dependency is not done/);});
test('PR gate rejects implementation changes since approved commit',async t=>{
 const {execFileSync}=await import('node:child_process');const f=fixture(t);
 const git=(args)=>execFileSync('git',args,{cwd:f.root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init']);git(['config','user.email','test@example.invalid']);git(['config','user.name','Test']);
 fs.writeFileSync(path.join(f.root,'app.js'),'export const value = 1;\n');git(['add','.']);git(['commit','-m','Implementation']);
 const sha=git(['rev-parse','HEAD']);
 f.docs['task.md'].status='done';f.docs['task.md'].evidence={red:'Failed expected assertion',green:'Passed',qa:'Integration passed',commit:sha};
 f.docs['plan.md'].status='ready-for-pr';f.docs['plan.md'].review_commit=sha;
 for(const role of ['code_review','appsec_review']) f.docs['plan.md'].approvals[role]={...f.approval,commit:sha};
 f.save();
 // Fixture uses top-level documents, so commit its approved metadata as the reviewed snapshot.
 git(['add','.']);git(['commit','-m','Review metadata']);
 // Move governance fixtures into their reserved directory, then establish reviewed implementation.
 fs.mkdirSync(path.join(f.root,'epics'));for(const name of Object.keys(f.docs)) fs.renameSync(path.join(f.root,name),path.join(f.root,'epics',name));
 git(['add','.']);git(['commit','-m','Governance location']);const reviewed=git(['rev-parse','HEAD']);
 const planPath=path.join(f.root,'epics/plan.md');const d=readDocument(planPath).data;d.review_commit=reviewed;
 for(const role of ['code_review','appsec_review']) d.approvals[role].commit=reviewed;
 fs.writeFileSync(planPath,'---\n'+YAML.stringify(d,{aliasDuplicateObjects:false})+'---\n');
 check(planPath,'pr',{root:f.root});
 fs.writeFileSync(path.join(f.root,'app.js'),'export const value = 2;\n');
 assert.throws(()=>check(planPath,'pr',{root:f.root}),/Implementation changed/);
});
