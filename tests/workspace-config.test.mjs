import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {
  parseWorkspaceConfig,
  resolveWorkspaceConfig,
  workspaceConfigDigest,
} from '../scripts/lib/workspace-config.mjs';
import {resolveTier3Policy,tier3PolicyContract,validateTier3RoleEvidence} from '../scripts/lib/tier3-policy.mjs';
import {assertAcceptedWorkspaceConfig} from '../scripts/lib/workspace-history.mjs';

const sample=`workspace:
  repository: example-repository
  environment: production
  provider: codex
  slack_channel_name: ws-example-repository-codex
  timezone: America/New_York
approvals_required:
  principal: true
  qa: true
  appsec: true
  accessibility_reviewer: false
  ui_designer: false
approvals_overrides:
  reason: No user interface in this project
  exempt: [accessibility_reviewer, ui_designer]
daily_summary:
  local_time: "09:00"
`;

function linkedWorktrees(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-git-root-'));
  const linked=path.join(os.tmpdir(),`workspace-config-linked-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['config','user.email','qa@example.test'],{cwd:root});
  execFileSync('git',['config','user.name','QA'],{cwd:root});
  fs.writeFileSync(path.join(root,'README.md'),'fixture\n');
  execFileSync('git',['add','README.md'],{cwd:root});
  execFileSync('git',['commit','-qm','fixture'],{cwd:root});
  execFileSync('git',['worktree','add','-q','-b','linked-policy',linked],{cwd:root});
  return {root,linked};
}

function writeConfig(root,value) {
  fs.mkdirSync(path.join(root,'config'),{recursive:true});
  fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(value));
}

test('parses non-secret config and hashes equivalent YAML identically',()=>{
  const parsed=parseWorkspaceConfig(sample,{partial:false});
  assert.equal(parsed.workspace.slack_channel_name,'ws-example-repository-codex');
  assert.deepEqual(parsed.approvals_overrides.exempt,['accessibility_reviewer','ui_designer']);
  assert.deepEqual(Object.keys(parsed),['workspace','approvals_required','approvals_overrides','daily_summary']);
  assert.equal(parsed.task_tiers?.tier_1_direct_merge ?? false,false);
  assert.equal(workspaceConfigDigest(parsed),'7028655b353fa52ed3b9a400f46cddc504958b269c55707c348c82483c853530');
  assert.match(workspaceConfigDigest(parsed),/^[a-f0-9]{64}$/);
  const commented=parseWorkspaceConfig(sample.replace('provider: codex','provider: codex # adapter'));
  assert.equal(workspaceConfigDigest(parsed),workspaceConfigDigest(commented));
});

test('accepts only an explicit boolean Tier 1 policy and includes it in the accepted digest',()=>{
  const enabled=parseWorkspaceConfig(`${sample}task_tiers:\n  tier_1_direct_merge: true\n`);
  const disabled=parseWorkspaceConfig(`${sample}task_tiers:\n  tier_1_direct_merge: false\n`);

  assert.deepEqual(enabled.task_tiers,{tier_1_direct_merge:true});
  assert.deepEqual(disabled.task_tiers,{tier_1_direct_merge:false});
  assert.notEqual(workspaceConfigDigest(enabled),workspaceConfigDigest(disabled));
  assert.notEqual(workspaceConfigDigest(enabled),workspaceConfigDigest(parseWorkspaceConfig(sample)));
  assert.throws(()=>parseWorkspaceConfig(`${sample}task_tiers: {}\n`),/tier_1_direct_merge.*required/i);
  assert.throws(()=>parseWorkspaceConfig(`${sample}task_tiers:\n  tier_1_direct_merge: "true"\n`),/must be boolean/i);
  assert.throws(()=>parseWorkspaceConfig(`${sample}task_tiers:\n  tier_1_direct_merge: false\n  allow_all: true\n`),/not allowed/i);
});

test('an empty exemption list remains valid after normalization and hashing',()=>{
  const uiConfig=sample.replace('  reason: No user interface in this project\n  exempt: [accessibility_reviewer, ui_designer]',
    '  exempt: []').replace('  accessibility_reviewer: false','  accessibility_reviewer: true').replace('  ui_designer: false','  ui_designer: true');
  const parsed=parseWorkspaceConfig(uiConfig);
  assert.deepEqual(parsed.approvals_overrides,{reason:'',exempt:[]});
  assert.match(workspaceConfigDigest(parsed),/^[a-f0-9]{64}$/);
});

test('rejects malformed YAML, roles, exemptions, and secret-shaped fields',()=>{
  assert.throws(()=>parseWorkspaceConfig(`${sample}workspace: {}\n`));
  const aliased=sample.replace('repository: example-repository','repository: &repo example-repository').replace('reason: No user interface in this project','reason: *repo');
  assert.throws(()=>parseWorkspaceConfig(aliased),/Alias resolution is disabled/);
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  qa: true','  qa: "true"')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  qa: true','  qa: true\n  reviewer: true')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  reason: No user interface in this project\n','')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  ui_designer: false','  ui_designer: true')));
  assert.throws(()=>parseWorkspaceConfig(sample.replace('  timezone: America/New_York','  timezone: America/New_York\n  channel_id: C123')));
  assert.throws(()=>parseWorkspaceConfig(`${sample}token: secret\n`));
});

test('root resolver reports provenance and refuses missing or escaping config',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-root-'));
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-outside-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'config'));
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root}));
  const file=path.join(root,'config/workspace-config.yaml');
  fs.writeFileSync(file,sample);
  const result=resolveWorkspaceConfig({coordinationRoot:root});
  assert.equal(result.config.workspace.provider,'codex');
  assert.equal(result.sources['workspace.provider'],'root');
  assert.equal(result.sources['approvals_required.qa'],'root');
  fs.unlinkSync(file);
  fs.writeFileSync(file,`${sample}task_tiers:\n  tier_1_direct_merge: false\n`);
  const withTierPolicy=resolveWorkspaceConfig({coordinationRoot:root});
  assert.deepEqual(withTierPolicy.config.task_tiers,{tier_1_direct_merge:false});
  assert.equal(withTierPolicy.sources['task_tiers.tier_1_direct_merge'],'root');
  fs.unlinkSync(file);
  const escaped=path.join(outside,'workspace-config.yaml');
  fs.writeFileSync(escaped,sample);
  fs.symlinkSync(escaped,file);
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root}));
});

test('linked worktree applies only explicit provider, role, and exemption overrides',t=>{
  const {root,linked}=linkedWorktrees(t);
  const rootConfig=parseWorkspaceConfig(sample);
  const worktreeConfig={
    ...rootConfig,
    workspace:{...rootConfig.workspace,provider:'claude'},
    approvals_required:{...rootConfig.approvals_required,qa:false},
    approvals_overrides:{reason:'Linked worktree has no UI',exempt:['accessibility_reviewer','ui_designer']},
    worktree_overrides:['workspace.provider','approvals_required.qa','approvals_overrides'],
  };
  writeConfig(root,rootConfig);
  writeConfig(linked,worktreeConfig);
  const result=resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked});
  assert.equal(result.config.workspace.provider,'claude');
  assert.equal(result.config.workspace.repository,'example-repository');
  assert.equal(result.config.approvals_required.qa,false);
  assert.equal(result.config.approvals_required.appsec,true);
  assert.deepEqual(result.config.approvals_overrides,worktreeConfig.approvals_overrides);
  assert.equal(result.sources['workspace.provider'],'worktree');
  assert.equal(result.sources['workspace.repository'],'root');
  assert.equal(result.sources['approvals_required.qa'],'worktree');
  assert.equal(result.sources['approvals_required.appsec'],'root');
  assert.equal(result.sources['approvals_overrides.exempt'],'worktree');
  assert.equal(result.sources['approvals_overrides.reason'],'worktree');
});

test('linked worktree cannot override Tier 1 direct-merge policy',t=>{
  const {root,linked}=linkedWorktrees(t);
  const rootConfig=parseWorkspaceConfig(sample);
  rootConfig.task_tiers={tier_1_direct_merge:false};
  writeConfig(root,rootConfig);
  writeConfig(linked,{
    ...rootConfig,
    task_tiers:{tier_1_direct_merge:true},
    worktree_overrides:['workspace.provider'],
  });

  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/worktrees cannot override|Tier 1 policy is defined/i);
});

test('linked worktree rejects missing, duplicate, unknown, and incomplete override markers',t=>{
  const {root,linked}=linkedWorktrees(t);
  const rootConfig=parseWorkspaceConfig(sample);
  writeConfig(root,rootConfig);
  const changed={...rootConfig,workspace:{...rootConfig.workspace,provider:'claude'}};
  writeConfig(linked,changed);
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/worktree_overrides/);
  writeConfig(linked,{...changed,worktree_overrides:['workspace.provider','workspace.provider']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/duplicate/);
  writeConfig(linked,{...changed,worktree_overrides:['workspace.unknown']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/known override/);
  writeConfig(linked,{...changed,worktree_overrides:['approvals_overrides.reason']});
  assert.throws(()=>resolveWorkspaceConfig({coordinationRoot:root,worktreeRoot:linked}),/known override/);
});

test('history rejects orphaned, gapped, and tampered acceptance evidence',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-history-chain-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const config=parseWorkspaceConfig(sample);
  writeConfig(root,config);
  fs.mkdirSync(path.join(root,'project'));
  const history=path.join(root,'project/workspace-config-history.jsonl');
  const digest=workspaceConfigDigest(config);
  const record={kind:'change',digest,revision:99,date:'2026-09-25',by:'Reviewer',reason:'forged',changes:[]};
  fs.writeFileSync(history,`${JSON.stringify(record)}\n`);
  assert.throws(()=>assertAcceptedWorkspaceConfig(root,config),/initial proposal|orphaned/i);
  const proposal={kind:'proposal',digest:'0'.repeat(64),revision:1,date:'2026-09-25',config,reasons:{principal:'review'}};
  const acceptance={kind:'acceptance',digest,revision:1,date:'2026-09-25',by:'Reviewer',reason:'reviewed',changes:[]};
  fs.writeFileSync(history,`${JSON.stringify(proposal)}\n${JSON.stringify(acceptance)}\n`);
  assert.throws(()=>assertAcceptedWorkspaceConfig(root,config),/proposal.*digest/i);
});

function tier3Documents({ui=true}={}) {
  const reviewedCommit='a'.repeat(40);
  const approval=(by,revision,commit)=>({by,date:'2026-09-26',notes:`${by} reviewed the evidence.`,revision,...(commit?{commit}: {})});
  return {
    reviewedCommit,
    developer:'implementer-session',
    plan:{owner:'plan-owner',revision:4,accessibility:{ui,rationale:'Explicit assessment.'},security:{auth:false,data:false,external:true,concerns:[],rationale:'Policy boundary.'},touches_concerns:[],approvals:{
      principal_engineer:approval('principal-reviewer',4),appsec:approval('appsec-planner',4),code_review:approval('code-reviewer',4,reviewedCommit),appsec_review:approval('appsec-final-reviewer',4,reviewedCommit),accessibility:ui?approval('accessibility-planner',4):null,accessibility_review:ui?approval('accessibility-final-reviewer',4,reviewedCommit):null,
    }},
    epic:{owner:'epic-owner',revision:2,approvals:{qa_lead:approval('qa-reviewer',2)}},
  };
}

test('Tier 3 rejects missing configured-role evidence',()=>{
  const policy=resolveTier3Policy({config:parseWorkspaceConfig(sample),sources:{}});
  assert.deepEqual(Object.keys(policy.roles),['principal','qa','appsec','accessibility_reviewer']);
  assert.equal(Object.hasOwn(policy.roles,'ui_designer'),false);
  const valid=tier3Documents();
  assert.doesNotThrow(()=>validateTier3RoleEvidence({...valid,policy}));

  const missing=tier3Documents(); missing.plan.approvals.principal_engineer=null;
  assert.throws(()=>validateTier3RoleEvidence({...missing,policy}),/principal/i);
  const malformed=tier3Documents(); malformed.epic.approvals.qa_lead={by:'qa-reviewer'};
  assert.throws(()=>validateTier3RoleEvidence({...malformed,policy}),/qa/i);
  const selfIssued=tier3Documents(); selfIssued.plan.approvals.appsec_review.by=selfIssued.developer;
  assert.throws(()=>validateTier3RoleEvidence({...selfIssued,policy}),/appsec/i);
  const planOwner=tier3Documents(); planOwner.plan.approvals.principal_engineer.by=' PLAN-OWNER ';
  assert.throws(()=>validateTier3RoleEvidence({...planOwner,policy}),/principal/i);
  const epicOwner=tier3Documents(); epicOwner.epic.approvals.qa_lead.by=' EPIC-OWNER ';
  assert.throws(()=>validateTier3RoleEvidence({...epicOwner,policy}),/qa/i);
  const stale=tier3Documents(); stale.plan.approvals.appsec.revision=3;
  assert.throws(()=>validateTier3RoleEvidence({...stale,policy}),/appsec/i);
  const wrongCommit=tier3Documents(); wrongCommit.plan.approvals.code_review.commit='b'.repeat(40);
  assert.throws(()=>validateTier3RoleEvidence({...wrongCommit,policy}),/code review/i);
  const appsecWrongCommit=tier3Documents(); appsecWrongCommit.plan.approvals.appsec_review.commit='b'.repeat(40);
  assert.throws(()=>validateTier3RoleEvidence({...appsecWrongCommit,policy}),/appsec/i);
});

test('Tier 3 preserves UI accessibility when policy is false',()=>{
  const config=parseWorkspaceConfig(sample);
  config.approvals_required.principal=false;
  config.approvals_required.qa=false;
  config.approvals_required.appsec=false;
  config.approvals_required.accessibility_reviewer=false;
  config.approvals_overrides={reason:'Policy claims no UI',exempt:['principal','qa','appsec','accessibility_reviewer','ui_designer']};
  const policy=resolveTier3Policy({config,sources:{'approvals_required.accessibility_reviewer':'worktree'}});
  assert.equal(policy.roles.accessibility_reviewer.required,false);
  assert.ok(Object.values(policy.roles).every(role=>role.required===false));
  assert.match(tier3PolicyContract.resolvedRoles,/immutable provenance/i);
  assert.match(tier3PolicyContract.evidenceFloors,/check-gate/i);
  const baseline=tier3Documents();
  assert.doesNotThrow(()=>validateTier3RoleEvidence({...baseline,policy}));
  baseline.plan.approvals.principal_engineer=null;
  assert.throws(()=>validateTier3RoleEvidence({...baseline,policy}),/principal/i);
  const missingQa=tier3Documents(); missingQa.epic.approvals.qa_lead=null;
  assert.throws(()=>validateTier3RoleEvidence({...missingQa,policy}),/qa/i);
  const missingPlanAppsec=tier3Documents(); missingPlanAppsec.plan.approvals.appsec=null;
  assert.throws(()=>validateTier3RoleEvidence({...missingPlanAppsec,policy}),/appsec/i);
  const missingCodeReview=tier3Documents(); missingCodeReview.plan.approvals.code_review=null;
  assert.throws(()=>validateTier3RoleEvidence({...missingCodeReview,policy}),/code review/i);
  const missingFinalAppsec=tier3Documents(); missingFinalAppsec.plan.approvals.appsec_review=null;
  assert.throws(()=>validateTier3RoleEvidence({...missingFinalAppsec,policy}),/appsec/i);
  const missing=tier3Documents(); missing.plan.approvals.accessibility=null;
  assert.throws(()=>validateTier3RoleEvidence({...missing,policy}),/accessibility/i);
  const wrongCommit=tier3Documents(); wrongCommit.plan.approvals.accessibility_review.commit='b'.repeat(40);
  assert.throws(()=>validateTier3RoleEvidence({...wrongCommit,policy}),/accessibility/i);
  const nonUi=tier3Documents({ui:false}); nonUi.plan.approvals.accessibility=null; nonUi.plan.approvals.accessibility_review=null;
  assert.doesNotThrow(()=>validateTier3RoleEvidence({...nonUi,policy}));
});
