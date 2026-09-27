import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {validateTier2Assessment} from '../scripts/check-tier2.mjs';
import {recognizeBootstrapPolicy} from '../scripts/lib/bootstrap-policy.mjs';
import {createTaskAssessment} from '../scripts/lib/task-assessment.mjs';

const source=fileURLToPath(new URL('..',import.meta.url));
// Historical evidence stays fixed after real F/I change the current checkout.
// The validators and CLI above still execute the current source implementation.
const historicalImplementation='b2b742b066615a860bc82c74c430778a56b676d8';
const B='553daf9fb49df58e55c3c5a6fbb68df6a0be0a41';
const P='74c7c7f66924f43319e1850ad6728708a5adc96b';
const S='a91beb92f858c4be00e09f23de39de3ccee3c17f';
const A='2a51c8fe0a35ebe224840d702ef5ae30f271407e';
const assessmentPath='project/task-assessments/governance-activation.yaml';
const policyPaths=['config/workspace-config.yaml','project/workspace-config-history.jsonl'];
function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim(); }
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bootstrap-policy-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  git(root,'clone','--quiet','--shared','--no-checkout',source,'.');
  git(root,'checkout','--quiet','--detach',historicalImplementation);
  git(root,'remote','set-url','origin','git@github.com:dpitcock/ai-toolkit.git');
  git(root,'config','user.name','Bootstrap QA');git(root,'config','user.email','bootstrap@example.test');
  return {root,repoRoot:root,baseSha:B,headSha:git(root,'rev-parse','HEAD'),headRef:'epic/EPIC-006',assessmentPath};
}
function commit(f,message='tamper fixture') { git(f.root,'add','-A');git(f.root,'commit','--quiet','-m',message);f.headSha=git(f.root,'rev-parse','HEAD'); }
function edit(f,file,change) { const name=path.join(f.root,file);fs.writeFileSync(name,change(fs.readFileSync(name,'utf8'))); }

test('actual bootstrap assessment is admitted in a fresh single checkout with no base policy',t=>{
  const f=fixture(t);
  assert.equal(git(f.root,'worktree','list','--porcelain').split('\n').filter(line=>line.startsWith('worktree ')).length,1);
  const result=validateTier2Assessment(f);
  assert.equal(result.tier,3);
  assert.equal(result.initialEvidenceCommit,A);
  assert.equal(result.tier3Binding.planRevision,1);
  assert.equal(result.tier3Policy.effectiveDigest,'a9008f1f352e53a0d39bf66a8b1376d09914ff0523da25b6dbbc45f34643cf5a');
});

test('real check-pr entrypoint admits the historical implementation stage',t=>{
  const f=fixture(t);
  const result=spawnSync(process.execPath,[path.join(source,'scripts/check-pr.mjs')],{
    cwd:f.root,encoding:'utf8',env:{...process.env,BASE_SHA:B,HEAD_SHA:f.headSha,HEAD_REF:f.headRef},
  });
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/Tier 3 epic-gate-required/);
});

for(const file of policyPaths) {
  test(`rejects later ${file} edits even when reverted`,t=>{
    const f=fixture(t);
    const before=fs.readFileSync(path.join(f.root,file),'utf8');
    edit(f,file,text=>text+'\n');commit(f);
    fs.writeFileSync(path.join(f.root,file),before);commit(f,'revert policy tampering');
    assert.throws(()=>validateTier2Assessment(f),/bootstrap.*policy.*after starting/i);
  });
  test(`rejects dirty ${file} even when its normalized digest is unchanged`,t=>{
    const f=fixture(t);edit(f,file,text=>text+'\n');
    assert.throws(()=>validateTier2Assessment(f),/bootstrap.*working.*snapshot/i);
  });
  test(`rejects executable ${file}`,t=>{
    const f=fixture(t);fs.chmodSync(path.join(f.root,file),0o755);commit(f);
    assert.throws(()=>validateTier2Assessment(f),/bootstrap.*policy.*after starting/i);
  });
}
for(const [label,mutate] of [
  ['origin',f=>git(f.root,'remote','set-url','origin','git@github.com:other/ai-toolkit.git')],
  ['branch',f=>{f.headRef='epic/EPIC-007';}],
]) test(`rejects a different bootstrap ${label}`,t=>{
  const f=fixture(t);mutate(f);
  assert.throws(()=>validateTier2Assessment(f),/bootstrap.*identity/i);
});

test('strict original snapshot proof rejects a different bootstrap base',t=>{
  const f=fixture(t);assert.throws(()=>recognizeBootstrapPolicy({...f,baseSha:S}),/bootstrap.*identity/i);
});

test('ordinary existing-policy Tier 2 assessment may use the same ID in another repository',t=>{
  const f=fixture(t);git(f.root,'checkout','--quiet','--detach',P);
  git(f.root,'remote','set-url','origin','git@github.com:other/adopter.git');
  const answers={developer:'developer',scope:'one-subsystem',claimedTier:2,userFacingUI:false,
    risks:Object.fromEntries(['auth','secrets','schema','publicApi','financial','userData','criticalInfrastructure','hardToRevert'].map(key=>[key,false])),
    intendedFiles:['src/one.js','src/two.js'],accessibilityEvidence:null};
  createTaskAssessment({id:'governance-activation',answers,coordinationRoot:f.root,worktreeRoot:f.root});
  commit(f,'ordinary initial assessment');
  fs.mkdirSync(path.join(f.root,'src'));
  for(const name of answers.intendedFiles) fs.writeFileSync(path.join(f.root,name),'export const value = 1;\n');
  commit(f,'ordinary implementation');
  const review={by:'developer',date:'2026-09-26',notes:'Actual fixture review',revision:1,commit:f.headSha};
  edit(f,assessmentPath,text=>{
    const record=YAML.parse(text);record.reviewEvidence={...review,mode:'self-check'};
    record.roleEvidence=Object.fromEntries(['principal','qa','appsec'].map(role=>[role,{...review,by:role}]));
    return YAML.stringify(record);
  });commit(f,'ordinary review evidence');
  assert.equal(validateTier2Assessment({...f,baseSha:P,headRef:'feature/ordinary'}).tier,2);
});
for(const [label,mutate] of [
  ['coordination digest',r=>{r.acceptedConfig.coordination.digest='a'.repeat(64);}],
  ['coordination revision',r=>{r.acceptedConfig.coordination.revision=2;}],
  ['effective digest',r=>{r.acceptedConfig.effectiveDigest='a'.repeat(64);}],
  ['effective revision',r=>{r.acceptedConfig.revision=2;}],
  ['worktree digest',r=>{r.acceptedConfig.worktree.digest='a'.repeat(64);}],
  ['worktree revision',r=>{r.acceptedConfig.worktree.revision=3;}],
  ['starting head',r=>{r.startingHead=B;}],
  ['intended paths',r=>{r.intendedFiles=r.intendedFiles.filter(name=>!policyPaths.includes(name));}],
  ['plan revision',r=>{r.tier3Binding.planRevision=2;}],
  ['plan identity',r=>{r.tier3Binding.planId='EPIC-007-PLAN';}],
  ['task identity',r=>{r.tier3Binding.taskId='TASK-001';}],
  ['branch binding',r=>{r.tier3Binding.branch='epic/EPIC-007';}],
  ['role provenance',r=>{r.tier3Binding.policy.roles.principal.required=false;}],
]) test(`rejects altered immutable assessment ${label}`,t=>{
  const f=fixture(t);
  edit(f,assessmentPath,text=>{const record=YAML.parse(text);mutate(record);return YAML.stringify(record);});commit(f);
  assert.throws(()=>validateTier2Assessment(f),/bootstrap.*assessment.*immutable/i);
});

test('rejects an immutable assessment edit followed by a revert',t=>{
  const f=fixture(t),before=fs.readFileSync(path.join(f.root,assessmentPath),'utf8');
  edit(f,assessmentPath,text=>text.replace('developer: Codex','developer: intruder'));commit(f);
  fs.writeFileSync(path.join(f.root,assessmentPath),before);commit(f);
  assert.throws(()=>validateTier2Assessment(f),/bootstrap.*assessment.*immutable/i);
});

test('rejects changed canonical plan binding even though the assessment is unchanged',t=>{
  const f=fixture(t);edit(f,'epics/EPIC-006/epic-plan.md',text=>text.replace('revision: 1','revision: 2'));commit(f);
  assert.throws(()=>validateTier2Assessment(f),/bootstrap.*plan.*binding/i);
});

test('original snapshot helper proves H0 without changing current HEAD or reading later policy',t=>{
  const f=fixture(t),h0=f.headSha;
  edit(f,policyPaths[0],text=>text+'\n');commit(f,'later policy');
  const proof=recognizeBootstrapPolicy({...f,headSha:h0});
  assert.equal(proof.root.accepted.revision,1);
  assert.equal(proof.linked.accepted.revision,2);
  assert.equal(proof.root.accepted.digest,'a9008f1f352e53a0d39bf66a8b1376d09914ff0523da25b6dbbc45f34643cf5a');
  assert.equal(proof.linked.accepted.digest,'d58b8020bf9db0f73ab1ddcbe8867106132d3a713491c906a6711373a6eab7ab');
  assert.deepEqual(proof.allowedPaths,policyPaths);
  assert.equal(git(f.root,'rev-parse','HEAD'),f.headSha);
  assert.throws(()=>recognizeBootstrapPolicy(f),/policy changed after starting/);
});

test('committed bootstrap proof ignores arbitrary registered coordination siblings',t=>{
  const f=fixture(t);
  for(const name of ['sibling-one','sibling-two']) {
    const sibling=path.join(f.root,name);git(f.root,'worktree','add','--quiet','--detach',sibling,P);
  }
  assert.equal(validateTier2Assessment(f).tier,3);
});

test('dirty immutable working assessment cannot replace the proven original facts',t=>{
  const f=fixture(t);edit(f,assessmentPath,text=>text.replace('developer: Codex','developer: intruder'));
  assert.throws(()=>validateTier2Assessment(f),/current developer differs/);
});

test('a symlink cannot stand in for a proven working policy file',t=>{
  const f=fixture(t),name=path.join(f.root,policyPaths[0]),copy=path.join(f.root,'policy-copy.yaml');
  fs.renameSync(name,copy);fs.symlinkSync(copy,name);
  assert.throws(()=>validateTier2Assessment(f),/regular file/);
});

test('unavailable pinned objects fail closed',t=>{
  const f=fixture(t);
  const isolated=path.join(f.root,'unrelated');fs.mkdirSync(isolated);git(isolated,'init','--quiet');
  git(isolated,'remote','add','origin','https://github.com/dpitcock/ai-toolkit.git');
  assert.throws(()=>recognizeBootstrapPolicy({...f,root:isolated}),/committed history unavailable/);
});

// These mutate historical trees but intentionally cannot replace production pins.
// Each must be rejected at pinned ancestry, before inner historical predicates.
function reconstructed(f,{at,mutate=()=>{},extraAssessmentPath=false,indirectAssessment=false}={}) {
  let parent=B;
  for(const [label,original] of [['P',P],['S',S],['A',A]]) {
    git(f.root,'checkout','--quiet','--force','--detach',original);
    if(label===at) mutate(f);
    if(label==='A') {
      edit(f,assessmentPath,text=>text.replace(S,parent));
      if(extraAssessmentPath) fs.writeFileSync(path.join(f.root,'extra-assessment.txt'),'not a sole path\n');
      if(indirectAssessment) parent=git(f.root,'commit-tree',git(f.root,'rev-parse',`${S}^{tree}`),'-p',parent,'-m','intervening commit');
    }
    git(f.root,'add','-A');
    parent=git(f.root,'commit-tree',git(f.root,'write-tree'),'-p',parent,'-m',`reconstructed ${label}`);
  }
  git(f.root,'checkout','--quiet','--detach',parent);f.headSha=parent;
}
const changeHistory=(f,change)=>edit(f,policyPaths[1],text=>change(text.trimEnd().split('\n').map(JSON.parse)).map(JSON.stringify).join('\n')+'\n');
for(const [label,options] of [
  ['otherwise shape-compatible provisioning',{}],
  ['extra provisioning source path',{at:'P',mutate:f=>fs.writeFileSync(path.join(f.root,'extra-source.js'),'export const early = true;\n')}],
  ['executable provisioning config',{at:'P',mutate:f=>fs.chmodSync(path.join(f.root,policyPaths[0]),0o755)}],
  ['symlink provisioning config',{at:'P',mutate:f=>{fs.unlinkSync(path.join(f.root,policyPaths[0]));fs.symlinkSync('../README.md',path.join(f.root,policyPaths[0]));}}],
  ['missing provisioning history',{at:'P',mutate:f=>fs.unlinkSync(path.join(f.root,policyPaths[1]))}],
  ['root override marker',{at:'P',mutate:f=>edit(f,policyPaths[0],text=>text+'\nworktree_overrides: []\n')}],
  ['missing root acceptance',{at:'P',mutate:f=>changeHistory(f,records=>records.slice(0,1))}],
  ['wrong root acceptance digest',{at:'P',mutate:f=>changeHistory(f,records=>{records[1].digest='a'.repeat(64);return records;})}],
  ['nonempty starting marker',{at:'S',mutate:f=>edit(f,policyPaths[0],text=>text.replace('worktree_overrides: []','worktree_overrides: [workspace.provider]'))}],
  ['missing starting marker',{at:'S',mutate:f=>edit(f,policyPaths[0],text=>text.replace('worktree_overrides: []',''))}],
  ['starting config field change',{at:'S',mutate:f=>edit(f,policyPaths[0],text=>text.replace('provider: codex','provider: other'))}],
  ['history prefix replacement',{at:'S',mutate:f=>changeHistory(f,records=>{records[1].reason='replacement';return records;})}],
  ['history truncation',{at:'S',mutate:f=>changeHistory(f,records=>records.slice(0,2))}],
  ['wrong appended revision',{at:'S',mutate:f=>changeHistory(f,records=>{records[2].revision=3;return records;})}],
  ['wrong appended digest',{at:'S',mutate:f=>changeHistory(f,records=>{records[2].digest='b'.repeat(64);return records;})}],
  ['extra history append',{at:'S',mutate:f=>changeHistory(f,records=>[...records,{...records[2],revision:3}])}],
  ['wrong appended changed fields',{at:'S',mutate:f=>changeHistory(f,records=>{records[2].changes=['workspace.provider'];return records;})}],
  ['missing change acceptor',{at:'S',mutate:f=>changeHistory(f,records=>{delete records[2].by;return records;})}],
  ['missing change reason',{at:'S',mutate:f=>changeHistory(f,records=>{delete records[2].reason;return records;})}],
  ['invalid change date',{at:'S',mutate:f=>changeHistory(f,records=>{records[2].date='invalid';return records;})}],
  ['wrong initial assessment blob',{at:'A',mutate:f=>edit(f,assessmentPath,text=>text.replace('developer: Codex','developer: other'))}],
  ['extra initial assessment path',{extraAssessmentPath:true}],
  ['indirect assessment parent',{indirectAssessment:true}],
]) test(`rejects reconstructed history with ${label} at the identity boundary`,t=>{
  const f=fixture(t);reconstructed(f,options);
  assert.throws(()=>recognizeBootstrapPolicy(f),/committed history unavailable/);
});

test('rejects partial policy in a replacement base before treating it as provisioning',t=>{
  const f=fixture(t);git(f.root,'checkout','--quiet','--detach',B);
  fs.mkdirSync(path.join(f.root,'config'),{recursive:true});
  fs.writeFileSync(path.join(f.root,policyPaths[0]),git(f.root,'show',`${P}:${policyPaths[0]}`));commit(f);
  assert.throws(()=>recognizeBootstrapPolicy({...f,baseSha:f.headSha}),/bootstrap.*identity/i);
});
