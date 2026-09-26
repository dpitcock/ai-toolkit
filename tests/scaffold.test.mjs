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
  cwd:root,encoding:'utf8',env:{...process.env,BASE_SHA:tier2Base,HEAD_REF:'feature/tier2-fixture'},
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
