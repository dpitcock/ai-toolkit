import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import YAML from 'yaml';
const source=path.resolve(import.meta.dirname,'..');
const noRisks={auth:false,secrets:false,schema:false,publicApi:false,financial:false,userData:false,criticalInfrastructure:false,hardToRevert:false};
const lowRiskAnswers={developer:'fixture-implementer',scope:'single-file',risks:noRisks,userFacingUI:false,claimedTier:1,intendedFiles:['project/src/quick-fix.js'],accessibilityEvidence:null};
const tier2Answers={developer:'fixture-implementer',scope:'one-subsystem',risks:noRisks,userFacingUI:false,claimedTier:2,intendedFiles:['project/src/notify.js','project/src/format.js'],accessibilityEvidence:null};
function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
function commitAll(root,message) { git(root,'add','-A');git(root,'commit','-m',message);return git(root,'rev-parse','HEAD'); }

test('pull-request workflow passes immutable PR context to the unified validator without irreversible operations',()=>{
 const workflow=YAML.parse(fs.readFileSync(path.join(source,'.github/workflows/workflow.yml'),'utf8'));
 const steps=workflow.jobs.gates.steps;
 assert.ok(steps.some(step=>step.run==='npm test'),'workflow keeps template-only test coverage');
 const validator=steps.find(step=>step.run==='node scripts/check-pr.mjs');
 assert.ok(validator,'workflow invokes the single unified PR validator');
 assert.deepEqual(validator.env,{
  BASE_SHA:'${{ github.event.pull_request.base.sha }}',
  HEAD_SHA:'${{ github.event.pull_request.head.sha }}',
  HEAD_REF:'${{ github.head_ref }}',
 });
 assert.equal(steps.filter(step=>step.run==='node scripts/check-pr.mjs').length,1);
 assert.doesNotMatch(fs.readFileSync(path.join(source,'.github/workflows/workflow.yml'),'utf8'),/\b(?:gh\s+pr|git\s+(?:push|merge|branch\s+-d))\b/i);
});

test('Tier 3 guidance preserves the registered-worktree, evidence, and PR-only contract',()=>{
 const tier3Guidance={
  'AGENTS.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/principal[\s\S]*qa[\s\S]*appsec[\s\S]*accessibility_reviewer/i,/PR-only[\s\S]*host/i],
  'docs/workflow.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/plan[\s\S]*task[\s\S]*branch[\s\S]*provenance/i,/accessibility[\s\S]*ui[\s\S]*final review/i,/PR-only[\s\S]*host/i],
  'docs/gates.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/plan[\s\S]*task[\s\S]*branch[\s\S]*provenance/i,/principal[\s\S]*qa[\s\S]*appsec[\s\S]*accessibility_reviewer/i,/cooperative[\s\S]*host/i],
  'docs/verification.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/plan[\s\S]*task[\s\S]*branch[\s\S]*provenance/i,/conditional[\s\S]*accessibility[\s\S]*ui/i,/PR-only[\s\S]*host/i],
  'skills/governed-build/SKILL.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/plan[\s\S]*task[\s\S]*branch[\s\S]*provenance/i,/principal[\s\S]*qa[\s\S]*appsec[\s\S]*accessibility_reviewer/i,/PR-only[\s\S]*host/i],
  'skills/governed-ship/SKILL.md':[/Tier 3[\s\S]*registered[\s\S]*isolated worktree/i,/plan[\s\S]*task[\s\S]*branch[\s\S]*provenance/i,/principal[\s\S]*qa[\s\S]*appsec[\s\S]*accessibility_reviewer/i,/conditional[\s\S]*ui[\s\S]*accessibility[\s\S]*(?:plan approval|final review)/i,/PR-only[\s\S]*host/i,/do not[\s\S]*(?:push|merge)/i],
 };
 for(const [file,patterns] of Object.entries(tier3Guidance)) {
  const text=fs.readFileSync(path.join(source,file),'utf8');
  assert.doesNotMatch(text,/ui_designer/i,`${file} must not make forward ui_designer claims`);
  for(const pattern of patterns) assert.match(text,pattern,`${file} is missing ${pattern}`);
 }
});

test('init is idempotent; real epic worktree is isolated and refuses collisions',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blueprint-scaffold-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const item of ['scripts','project','tests','package.json','package-lock.json','.gitignore']) fs.cpSync(path.join(source,item),path.join(root,item),{recursive:true});
 fs.mkdirSync(path.join(root,'epics'));fs.cpSync(path.join(source,'epics','EPIC-XXX'),path.join(root,'epics','EPIC-XXX'),{recursive:true});
 fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
 const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 run('bash',['scripts/init-project.sh','--offline']);
 const plan=path.join(root,'project/project-plan.md');fs.appendFileSync(plan,'Preserve this user edit\n');
 run('bash',['scripts/init-project.sh','--offline']);assert.match(fs.readFileSync(plan,'utf8'),/Preserve this user edit/);
 const text=fs.readFileSync(plan,'utf8');const match=text.match(/^---\n([\s\S]*?)\n---\n/);const d=YAML.parse(match[1]);
 d.approvals.accessibility=null;d.approvals.accessibility_review=null;
 d.owner='EM';d.status='approved';d.approvals.principal_engineer={by:'Principal',date:'2026-09-07',notes:'Reviewed baseline',revision:d.revision};
 fs.writeFileSync(plan,'---\n'+YAML.stringify(d)+'---\nProject scope\n');
 run('git',['init']);run('git',['config','user.email','test@example.invalid']);run('git',['config','user.name','Test']);run('git',['add','.']);run('git',['commit','-m','Fixture baseline']);
 const skill=path.join(root,'skills/upstream/superpowers/skills/using-git-worktrees');fs.mkdirSync(skill,{recursive:true});fs.writeFileSync(path.join(skill,'SKILL.md'),'Worktree fixture: actual upstream installation tested separately.');
 // Isolate this orchestration test from package registries; verify setup/test calls explicitly.
 const bin=path.join(root,'test-bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'npm'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "'+root+'/npm-calls"\n');fs.chmodSync(path.join(bin,'npm'),0o755);
 fs.appendFileSync(path.join(root,'.git/info/exclude'),'\ntest-bin/\nnpm-calls\n');
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH};
 execFileSync('bash',['scripts/new-epic.sh','EPIC-001'],{cwd:root,env,stdio:'pipe'});
 const worktree=path.join(root,'.worktrees/EPIC-001');assert.ok(fs.existsSync(path.join(worktree,'epics/EPIC-001/tasks/TASK-001.md')));assert.ok(!fs.existsSync(path.join(root,'epics/EPIC-001')));
 assert.ok(fs.existsSync(path.join(worktree,'config','workspace-config.yaml')));
 assert.ok(!fs.existsSync(path.join(worktree,'config','slack-workspace.example.yml')));
 assert.equal(execFileSync('git',['branch','--show-current'],{cwd:worktree,encoding:'utf8'}).trim(),'epic/EPIC-001');
 assert.match(fs.readFileSync(path.join(root,'npm-calls'),'utf8'),/ci --ignore-scripts\nrebuild fs-ext --ignore-scripts=false\ntest/);
 assert.throws(()=>execFileSync('bash',['scripts/new-epic.sh','EPIC-001'],{cwd:root,env,stdio:'pipe'}));
 assert.throws(()=>execFileSync('bash',['scripts/new-epic.sh','../escape'],{cwd:root,env,stdio:'pipe'}));
});

test('generated adopter executes accepted Tier 1 and Tier 2 routes and documents their gates',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blueprint-tier-routes-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const item of ['scripts','project','docs','skills','package.json','package-lock.json','.gitignore','AGENTS.md']) {
  fs.cpSync(path.join(source,item),path.join(root,item),{recursive:true});
 }
 fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
 const run=(cmd,args,options={})=>execFileSync(cmd,args,{
  cwd:root,encoding:'utf8',stdio:options.input===undefined?['ignore','pipe','pipe']:['pipe','pipe','pipe'],...options,
 });
 const initOutput=run('bash',['scripts/init-project.sh','--offline']);
 const proposal=JSON.parse(initOutput.split('\n')[0]);
 assert.equal(proposal.status,'pending');
 const config=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
 assert.equal(config.task_tiers.tier_1_direct_merge,false);
 run('node',['scripts/init-workspace.mjs','accept','--root',root,'--by','Fixture policy reviewer','--reason','Accept generated adopter fixture','--digest',proposal.digest]);
 assert.match(run('node',['scripts/init-workspace.mjs','status','--root',root]),/"status":"accepted"/);
 git(root,'init');git(root,'config','user.email','fixture@example.test');git(root,'config','user.name','Fixture');
 const acceptedBase=commitAll(root,'accepted generated workspace policy');

 const preflight=(id,answers)=>run('node',['scripts/preflight.mjs','--id',id,'--coordination-root',root,'--worktree-root',root],{input:JSON.stringify(answers)});
 const tier1Preflight=preflight('quick-fix',lowRiskAnswers);
 assert.match(tier1Preflight,/Selected tier:\s+1/);
 assert.equal(YAML.parse(fs.readFileSync(path.join(root,'project/task-assessments/quick-fix.yaml'),'utf8')).startingHead,acceptedBase);
 commitAll(root,'record Tier 1 preflight');
 fs.mkdirSync(path.join(root,'project/src'),{recursive:true});fs.writeFileSync(path.join(root,'project/src/quick-fix.js'),'export const fixed = true;\n');
 commitAll(root,'implement Tier 1 change');
 const tier1=run('node',['scripts/check-tier1.mjs','--assessment','project/task-assessments/quick-fix.yaml']);
 assert.match(tier1,/Tier 1 final check: passed/);
 assert.match(tier1,/Direct merge eligible: no/);
 assert.match(tier1,/Pull request/);
 commitAll(root,'record Tier 1 final check');

 const tier2Base=git(root,'rev-parse','HEAD');
 const tier2Preflight=preflight('bounded-change',tier2Answers);
 assert.match(tier2Preflight,/Selected tier:\s+2/);
 commitAll(root,'record Tier 2 preflight');
 fs.writeFileSync(path.join(root,'project/src/notify.js'),'export const notify = true;\n');
 fs.writeFileSync(path.join(root,'project/src/format.js'),'export const format = true;\n');
 commitAll(root,'implement Tier 2 change');
 const reviewedCommit=git(root,'rev-parse','HEAD');
 const assessmentPath=path.join(root,'project/task-assessments/bounded-change.yaml');
 const assessment=YAML.parse(fs.readFileSync(assessmentPath,'utf8'));
 const review=(by)=>({by,date:'2026-09-25',notes:'Fixture evidence for the bounded change.',revision:1,commit:reviewedCommit});
 assessment.reviewEvidence={mode:'independent',...review('Independent code reviewer')};
 assessment.roleEvidence=Object.fromEntries(['principal','qa','appsec'].map(role=>[role,review(`${role} reviewer`)]));
 fs.writeFileSync(assessmentPath,YAML.stringify(assessment,{lineWidth:0}));
 commitAll(root,'record Tier 2 reviews');
 const checked=spawnSync(process.execPath,['scripts/check-pr.mjs'],{
  cwd:root,encoding:'utf8',env:{...process.env,BASE_SHA:tier2Base,HEAD_SHA:git(root,'rev-parse','HEAD'),HEAD_REF:'feature/tier2-fixture'},
 });
 assert.equal(checked.status,0,checked.stderr);
 assert.match(checked.stdout,/bounded-change\.yaml: Tier 2 passed/);

 const routeExpectations=[
  ['AGENTS.md',/scripts\/preflight\.mjs[\s\S]*scripts\/check-tier1\.mjs[\s\S]*scripts\/check-pr\.mjs/i,/Tier 1 excludes UI/i,/never allowed for this template/i],
  ['docs/workflow.md',/scripts\/preflight\.mjs[\s\S]*scripts\/check-tier1\.mjs[\s\S]*scripts\/check-pr\.mjs/i,/final[- ]diff[^\n]*may only raise/i,/accessibility[^\n]*independent/i,/check-tier1\.mjs[^\n]*can report `Direct merge eligible: yes`[\s\S]*does not enforce this template's PR-only rule/i],
  ['docs/verification.md',/Tier 1[^\n]*direct merge[^\n]*disabled/i,/check-pr\.mjs/i,/accepted[^\n]*configuration/i],
  ['skills/governed-build/SKILL.md',/scripts\/preflight\.mjs[\s\S]*scripts\/check-tier1\.mjs[\s\S]*scripts\/check-pr\.mjs/i,/uncertainty[^\n]*(?:Tier 3|escalat)/i],
 ];
 for(const [file,...patterns] of routeExpectations) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  for(const pattern of patterns) assert.ok(pattern.test(text),`${file} is missing ${pattern}`);
 }
});

function tier3Approvals() {
 return {principal_engineer:null,appsec:null,qa_lead:null,code_review:null,appsec_review:null,accessibility:null,accessibility_review:null};
}

function tier3Approval(by,revision,commit=null) {
 return {by,date:'2026-09-26',notes:'Independent generated-adopter review evidence.',revision,...(commit===null?{}:{commit})};
}

function updateGovernanceDocument(root,relative,mutate) {
 const file=path.join(root,relative),raw=fs.readFileSync(file,'utf8'),match=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
 assert.ok(match,`${relative} has frontmatter`);const data=YAML.parse(match[1]);mutate(data);
 fs.writeFileSync(file,`---\n${YAML.stringify(data,{lineWidth:0})}---\n${match[2]}`);
}

function advanceGate(run,root,relative,target) {
 const result=run(root,'node',['scripts/check-gate.mjs',relative,target,'--write']);
 assert.equal(result.status,0,result.stderr);
}

test('generated adopter Tier 3 route',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blueprint-tier3-adopter-'));
 const linked=path.join(root,'.worktrees/EPIC-043');
 t.after(()=>{try { git(root,'worktree','remove','--force',linked); } catch {} fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
 for(const item of ['scripts','project','docs','skills','tests','package.json','package-lock.json','.gitignore','AGENTS.md']) fs.cpSync(path.join(source,item),path.join(root,item),{recursive:true});
 fs.mkdirSync(path.join(root,'epics'));fs.cpSync(path.join(source,'epics','EPIC-XXX'),path.join(root,'epics','EPIC-XXX'),{recursive:true});
 fs.rmSync(path.join(root,'project','project-plan.md'));
 fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
 const run=(cwd,cmd,args,options={})=>spawnSync(cmd,args,{cwd,encoding:'utf8',input:options.input,...options});
 const initialized=run(root,'bash',['scripts/init-project.sh','--offline']);assert.equal(initialized.status,0,initialized.stderr);
 const proposal=JSON.parse(initialized.stdout.split('\n')[0]);
 const accepted=run(root,'node',['scripts/init-workspace.mjs','accept','--root',root,'--by','fixture-policy-reviewer','--reason','Accept Tier 3 generated adopter','--digest',proposal.digest]);
 assert.equal(accepted.status,0,accepted.stderr);
 git(root,'init','-q');git(root,'config','user.email','fixture@example.test');git(root,'config','user.name','Fixture');
 updateGovernanceDocument(root,'project/project-plan.md',project=>{project.owner='fixture-em';project.approvals.principal_engineer=tier3Approval('project-principal',1);});
 advanceGate(run,root,'project/project-plan.md','awaiting-review');advanceGate(run,root,'project/project-plan.md','approved');
 commitAll(root,'accepted policy and approved project plan');
 const bin=path.join(root,'test-bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'npm'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "'+root+'/npm-calls"\n');fs.chmodSync(path.join(bin,'npm'),0o755);
 fs.appendFileSync(path.join(root,'.git/info/exclude'),'\ntest-bin/\nnpm-calls\n');
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH};
 const scaffold=run(root,'bash',['scripts/new-epic.sh','EPIC-043'],{env});assert.equal(scaffold.status,0,scaffold.stderr);
 assert.match(fs.readFileSync(path.join(root,'npm-calls'),'utf8'),/ci --ignore-scripts\nrebuild fs-ext --ignore-scripts=false\ntest/);
 assert.equal(git(linked,'branch','--show-current'),'epic/EPIC-043');
 const linkedCandidate=path.join(linked,'project','linked-worktree-policy.yaml');
 const linkedConfig=YAML.parse(fs.readFileSync(path.join(linked,'config/workspace-config.yaml'),'utf8'));
 linkedConfig.workspace.provider='fixture-linked-provider';linkedConfig.worktree_overrides=['workspace.provider'];
 fs.writeFileSync(linkedCandidate,YAML.stringify(linkedConfig));
 const linkedProposal=run(linked,'node',['scripts/init-workspace.mjs','propose-change','--root',linked,'--candidate',linkedCandidate]);
 assert.equal(linkedProposal.status,0,linkedProposal.stderr);
 const linkedPolicy=JSON.parse(linkedProposal.stdout);
 const linkedAccepted=run(linked,'node',['scripts/init-workspace.mjs','apply-change','--root',linked,'--candidate',linkedCandidate,'--by','fixture-linked-policy-reviewer','--reason','Accept linked Tier 3 policy','--digest',linkedPolicy.digest,'--base-digest',linkedPolicy.base_digest]);
 assert.equal(linkedAccepted.status,0,linkedAccepted.stderr);fs.rmSync(linkedCandidate);
 updateGovernanceDocument(linked,'epics/EPIC-043/epic.md',epic=>{
  epic.owner='fixture-epic-owner';epic.security={auth:false,data:false,external:false,concerns:[],rationale:'Generated adopter fixture.'};epic.accessibility={ui:false,rationale:'No user-facing epic UI.'};epic.qa_requirements=['generated-adopter-route'];epic.approvals.qa_lead=tier3Approval('qa-reviewer',1);epic.approvals.appsec='not-required';
 });
 updateGovernanceDocument(linked,'epics/EPIC-043/epic-plan.md',plan=>{
  plan.owner='fixture-implementer';plan.security={auth:false,data:false,external:false,concerns:[],rationale:'Generated adopter fixture.'};plan.accessibility={ui:false,rationale:'No user-facing plan UI.'};plan.touches_concerns=[];plan.approvals.principal_engineer=tier3Approval('plan-principal',1);plan.approvals.appsec='not-required';
 });
 updateGovernanceDocument(linked,'epics/EPIC-043/tasks/TASK-001.md',task=>{task.owner='fixture-implementer';});
 advanceGate(run,linked,'epics/EPIC-043/epic.md','awaiting-review');advanceGate(run,linked,'epics/EPIC-043/epic.md','approved');advanceGate(run,linked,'epics/EPIC-043/epic.md','in-progress');
 advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','awaiting-principal-signoff');advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','approved');advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','in-progress');
 advanceGate(run,linked,'epics/EPIC-043/tasks/TASK-001.md','approved');
 commitAll(linked,'accept linked policy and start governed epic');
 const baseSha=git(linked,'rev-parse','HEAD');
 const answers={developer:'fixture-implementer',scope:'cross-cutting',risks:{...noRisks,auth:true},userFacingUI:false,claimedTier:3,intendedFiles:['project/src/tier3-change.js'],accessibilityEvidence:null,tier3Binding:{planPath:'epics/EPIC-043/epic-plan.md',taskPath:'epics/EPIC-043/tasks/TASK-001.md'}};
 const preflight=(cwd,id,input=answers)=>run(cwd,'node',['scripts/preflight.mjs','--id',id,'--coordination-root',root,'--worktree-root',cwd],{input:JSON.stringify(input)});

 let reviewedCommit;
 await t.test('generated adopter completes the Tier 3 route',()=>{
  const preflightResult=preflight(linked,'tier3-route');assert.equal(preflightResult.status,0,preflightResult.stderr);assert.match(preflightResult.stdout,/Selected tier:\s+3/);
  commitAll(linked,'initial Tier 3 assessment');
  advanceGate(run,linked,'epics/EPIC-043/tasks/TASK-001.md','in-progress');commitAll(linked,'start governed Tier 3 task');
  fs.mkdirSync(path.join(linked,'project/src'),{recursive:true});fs.writeFileSync(path.join(linked,'project/src/tier3-change.js'),'export const tier3 = true;\n');
  commitAll(linked,'implement Tier 3 change');reviewedCommit=git(linked,'rev-parse','HEAD');
  updateGovernanceDocument(linked,'epics/EPIC-043/tasks/TASK-001.md',task=>{task.evidence={red:'Generated adopter RED evidence.',green:'Generated adopter GREEN evidence.',qa:'Generated adopter QA evidence.',commit:reviewedCommit};});
  advanceGate(run,linked,'epics/EPIC-043/tasks/TASK-001.md','in-review');advanceGate(run,linked,'epics/EPIC-043/tasks/TASK-001.md','done');advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','in-review');
  updateGovernanceDocument(linked,'epics/EPIC-043/epic-plan.md',plan=>{plan.review_commit=reviewedCommit;plan.approvals.code_review=tier3Approval('code-reviewer',1,reviewedCommit);plan.approvals.appsec_review=tier3Approval('appsec-reviewer',1,reviewedCommit);});
  advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','in-appsec-review');advanceGate(run,linked,'epics/EPIC-043/epic-plan.md','ready-for-pr');commitAll(linked,'record governed Tier 3 task and final reviews');
  const check=run(linked,process.execPath,['scripts/check-pr.mjs'],{env:{...process.env,BASE_SHA:baseSha,HEAD_SHA:git(linked,'rev-parse','HEAD'),HEAD_REF:'epic/EPIC-043'}});assert.equal(check.status,0,check.stderr);assert.match(check.stdout,/tier3-route\.yaml: Tier 3 epic-gate-required/);
 });
 await t.test('generated adopter rejects unbound Tier 3 routes',()=>{
  const shared=preflight(root,'shared-tier3');assert.notEqual(shared.status,0);assert.match(shared.stderr,/Tier 3.*(linked|coordination)/i);
  const wrongPlan=preflight(linked,'wrong-plan',{...answers,tier3Binding:{planPath:'epics/EPIC-999/epic-plan.md',taskPath:'epics/EPIC-999/tasks/TASK-001.md'}});assert.notEqual(wrongPlan.status,0);assert.match(wrongPlan.stderr,/Tier 3.*(plan|branch|binding)/i);
  updateGovernanceDocument(linked,'epics/EPIC-043/epic-plan.md',plan=>{plan.accessibility={ui:true,rationale:'Adversarial UI bypass.'};});commitAll(linked,'attempt UI accessibility-floor bypass');
  const uiCheck=run(linked,process.execPath,['scripts/check-pr.mjs'],{env:{...process.env,BASE_SHA:baseSha,HEAD_SHA:git(linked,'rev-parse','HEAD'),HEAD_REF:'epic/EPIC-043'}});assert.notEqual(uiCheck.status,0);assert.match(uiCheck.stderr,/accessibility/i);
  updateGovernanceDocument(linked,'epics/EPIC-043/epic.md',epic=>{epic.approvals.qa_lead=null;});commitAll(linked,'attempt missing QA role evidence');
  const roleCheck=run(linked,process.execPath,['scripts/check-pr.mjs'],{env:{...process.env,BASE_SHA:baseSha,HEAD_SHA:git(linked,'rev-parse','HEAD'),HEAD_REF:'epic/EPIC-043'}});assert.notEqual(roleCheck.status,0);assert.match(roleCheck.stderr,/qa|Missing.*qa/i);
  const staleConfig=YAML.parse(fs.readFileSync(path.join(linked,'config/workspace-config.yaml'),'utf8'));staleConfig.workspace.provider='stale-provider';fs.writeFileSync(path.join(linked,'config/workspace-config.yaml'),YAML.stringify(staleConfig));commitAll(linked,'attempt stale linked policy');
  const stale=preflight(linked,'stale-tier3');assert.notEqual(stale.status,0);assert.match(stale.stderr,/Workspace configuration changed after acceptance|stale/i);
 });
});

test('native lock install is local and does not run an unexpected lifecycle hook',{timeout:120_000},t=>{
 assert.doesNotMatch(fs.readFileSync(path.join(source,'.github/workflows/workflow.yml'),'utf8'),/cache:\s*npm/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blueprint-native-lock-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const item of ['scripts','package.json','package-lock.json','.gitignore']) fs.cpSync(path.join(source,item),path.join(root,item),{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 manifest.scripts={...manifest.scripts,preinstall:"node -e \"require('node:fs').writeFileSync('unexpected-hook-ran','yes')\""};
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(manifest,null,2)+'\n');
 const run=(cmd,args)=>execFileSync(cmd,args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 run('node',['scripts/install-native-lock.mjs']);
 assert.ok(fs.existsSync(path.join(root,'.npm-cache')));
 const devdir=path.join(root,'.node-gyp');assert.ok(fs.existsSync(devdir));
 assert.ok(fs.readdirSync(devdir).some(version=>fs.existsSync(path.join(devdir,version,'include','node','node.h'))));
 assert.ok(!fs.existsSync(path.join(root,'unexpected-hook-ran')));
 run('node',['-e',"const fs=require('node:fs');const ext=require('fs-ext');const fd=fs.openSync('policy.lock','w');ext.flockSync(fd,'ex');ext.flockSync(fd,'un');fs.closeSync(fd);"]);
});
