#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import YAML from 'yaml';
import {classifyTask} from './lib/task-tier.mjs';
import {parseWorkspaceConfig,workspaceConfigDigest} from './lib/workspace-config.mjs';
import {parseWorkspaceHistory,readWorkspaceHistory,assertAcceptedWorkspaceConfig} from './lib/workspace-history.mjs';

const INITIAL_FIELDS=['kind','id','startingHead','acceptedConfig','developer','scope','risks','userFacingUI','intendedFiles','claimedTier','selectedTier','reasons'];
const RISK_KEYS=['auth','secrets','schema','publicApi','financial','userData','criticalInfrastructure','hardToRevert'];
const ROLES=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
const REVIEW_FIELDS=['by','date','notes','revision','commit'];

function fail(message) { throw new Error(`Tier 2 validation failed: ${message}`); }
function isObject(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function sameIdentity(left,right) { return typeof left==='string' && typeof right==='string' && left.trim().toLowerCase()===right.trim().toLowerCase(); }
function nulPaths(value) { return value.split('\0').filter(Boolean); }

function git(root,args) {
  try { return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
  catch(error) { fail(`read-only Git inspection failed (${args[0]}): ${error.message}`); }
}

function repoRoot(value) {
  if(typeof value!=='string' || !value) fail('repository root is required');
  const root=fs.realpathSync(value);
  if(fs.realpathSync(git(root,['rev-parse','--show-toplevel']).trim())!==root) fail('run validation from the top-level registered worktree');
  return root;
}

function assessmentRelativePath(root,value) {
  if(typeof value!=='string' || !value || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) fail('assessment path is malformed');
  const absolute=path.resolve(root,value),relative=path.relative(root,absolute).split(path.sep).join('/');
  const parts=relative.split('/');
  if(!relative.startsWith('project/task-assessments/') || !relative.endsWith('.yaml') || parts.some(part=>!part||part==='.'||part==='..')) {
    fail('assessment path must be a YAML file under project/task-assessments');
  }
  const id=path.basename(relative,'.yaml');
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id) || relative!==`project/task-assessments/${id}.yaml`) fail('assessment identity is malformed');
  return relative;
}

function safeReadText(root,relative,label) {
  let current=root;
  const parts=relative.split('/');
  for(const part of parts.slice(0,-1)) {
    current=path.join(current,part);
    const stat=fs.lstatSync(current);
    if(stat.isSymbolicLink() || !stat.isDirectory()) fail(`${label} cannot traverse a symlink or non-directory`);
  }
  const file=path.join(root,...parts),stat=fs.lstatSync(file);
  if(stat.isSymbolicLink() || !stat.isFile() || !fs.realpathSync(file).startsWith(root+path.sep)) fail(`${label} must be a regular file inside the repository`);
  return fs.readFileSync(file,'utf8');
}

function parseYaml(raw,label) {
  const document=YAML.parseDocument(raw,{uniqueKeys:true});
  if(document.errors.length) fail(`${label} has invalid YAML: ${document.errors.map(error=>error.message).join('; ')}`);
  try { return document.toJS({maxAliasCount:0}); }
  catch(error) { fail(`${label} has invalid YAML: ${error.message}`); }
}

function readAssessment(root,relative) {
  const record=parseYaml(safeReadText(root,relative,'Assessment'),'Assessment');
  if(!isObject(record) || record.kind!=='task-assessment' || relative!==`project/task-assessments/${record.id}.yaml`) fail('assessment identity or shape is malformed');
  if(!/^[a-f0-9]{40}$/i.test(record.startingHead) || !isObject(record.acceptedConfig)) fail('assessment start or accepted config is malformed');
  if(!isObject(record.risks) || RISK_KEYS.some(key=>!Object.hasOwn(record.risks,key))) fail('assessment risk evidence is malformed');
  if(!Array.isArray(record.intendedFiles) || !Array.isArray(record.reasons) || ![1,2,3].includes(record.selectedTier)) fail('assessment classification evidence is malformed');
  return record;
}

function firstAssessmentCommit(relative,head,adapterRoot) {
  const additions=git(adapterRoot,['log','--full-history','--reverse','--format=%H','--diff-filter=A',head,'--',relative]).trim().split('\n').filter(Boolean);
  const commit=additions[0];
  if(!commit) fail('first committed assessment evidence was not found');
  const parents=git(adapterRoot,['show','-s','--format=%P',commit]).trim().split(/\s+/).filter(Boolean);
  const paths=nulPaths(git(adapterRoot,['diff-tree','--no-commit-id','--no-renames','--name-only','-z','-r',commit]));
  const initial=parseYaml(git(adapterRoot,['show',`${commit}:${relative}`]),'Initial assessment evidence');
  if(!isObject(initial) || !/^[a-f0-9]{40}$/i.test(initial.startingHead)) fail('initial assessment evidence is malformed');
  if(initial.reviewEvidence!==null || initial.roleEvidence!==null) fail('initial assessment must not contain review evidence');
  if(parents.length!==1 || parents[0]!==initial.startingHead) fail('initial assessment commit must be a direct child of starting HEAD');
  if(paths.length!==1 || paths[0]!==relative) fail('initial assessment commit must change its assessment as the sole path');
  if(nulPaths(git(adapterRoot,['ls-tree','-z',initial.startingHead,'--',relative])).length) fail('assessment already existed at its starting commit');
  git(adapterRoot,['merge-base','--is-ancestor',initial.startingHead,head]);
  return {commit,record:initial};
}

function initialFacts(record) {
  const facts=Object.fromEntries(INITIAL_FIELDS.map(field=>[field,record[field]]));
  const accessibility=record.accessibilityEvidence;
  facts.accessibilityEvidence=accessibility===null?null:isObject(accessibility)?{
    triage:accessibility.triage,plan:accessibility.plan,
  }:accessibility;
  return facts;
}

function assertInitialFactsUnchanged(current,initial) {
  const original=initialFacts(initial),latest=initialFacts(current);
  for(const [key,value] of Object.entries(original)) {
    if(!Object.hasOwn(initial,key) || !Object.hasOwn(current,key) || !isDeepStrictEqual(value,latest[key])) {
      fail(`current ${key} differs from the first committed assessment evidence`);
    }
  }
}

function acceptedConfigAt(root,sha) {
  const config=parseWorkspaceConfig(git(root,['show',`${sha}:config/workspace-config.yaml`]));
  const history=parseWorkspaceHistory(git(root,['show',`${sha}:project/workspace-config-history.jsonl`]));
  const accepted=history.at(-1);
  if(!accepted || !['acceptance','change'].includes(accepted.kind) || accepted.digest!==workspaceConfigDigest(config)) {
    fail('PR base does not contain an accepted coordination policy');
  }
  return {config,accepted};
}

function applyWorktreeOverlay(rootConfig,overlay) {
  if(Object.hasOwn(rootConfig,'worktree_overrides')) fail('coordination config cannot declare worktree_overrides');
  if(Object.hasOwn(overlay,'task_tiers') && JSON.stringify(overlay.task_tiers)!==JSON.stringify(rootConfig.task_tiers)) {
    fail('linked worktree cannot override Tier 1 policy');
  }
  const effective=structuredClone(rootConfig),markers=overlay.worktree_overrides;
  if(!Array.isArray(markers)) fail('linked worktree has no accepted override markers');
  const roles=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
  for(const marker of markers) {
    if(marker==='workspace.provider') effective.workspace.provider=overlay.workspace.provider;
    else if(marker==='approvals_overrides') effective.approvals_overrides=overlay.approvals_overrides;
    else if(roles.some(role=>marker===`approvals_required.${role}`)) {
      const role=marker.slice('approvals_required.'.length);
      effective.approvals_required[role]=overlay.approvals_required[role];
    } else fail(`unknown linked worktree override: ${marker}`);
  }
  return parseWorkspaceConfig(YAML.stringify(effective));
}

function acceptedPolicy(root,record,baseSha) {
  const provenance=record.acceptedConfig;
  if(!isObject(provenance) || !/^[a-f0-9]{64}$/.test(provenance.effectiveDigest??'')
    || !Number.isInteger(provenance.revision) || !isObject(provenance.coordination)
    || !/^[a-f0-9]{64}$/.test(provenance.coordination.digest??'') || !Number.isInteger(provenance.coordination.revision)) {
    fail('accepted config provenance is malformed');
  }
  const currentConfig=parseWorkspaceConfig(safeReadText(root,'config/workspace-config.yaml','Workspace config'));
  const currentPolicy=assertAcceptedWorkspaceConfig(root,currentConfig);
  let effective,coordinationPolicy;
  if(provenance.worktree===null) {
    coordinationPolicy=currentPolicy;effective=currentConfig;
    if(currentPolicy.digest!==provenance.coordination.digest || currentPolicy.revision!==provenance.coordination.revision) {
      fail('accepted workspace policy is stale; rerun preflight');
    }
  } else {
    const worktree=provenance.worktree;
    if(!isObject(worktree) || !/^[a-f0-9]{64}$/.test(worktree.digest??'') || !Number.isInteger(worktree.revision)
      || currentPolicy.digest!==worktree.digest || currentPolicy.revision!==worktree.revision) {
      fail('accepted linked-worktree policy is stale; rerun preflight');
    }
    const candidates=git(root,['worktree','list','--porcelain']).split('\n')
      .filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice('worktree '.length))).filter(candidate=>candidate!==root);
    const matches=[];
    for(const candidate of candidates) {
      try {
        const config=parseWorkspaceConfig(safeReadText(candidate,'config/workspace-config.yaml','Coordination config'));
        const accepted=assertAcceptedWorkspaceConfig(candidate,config);
        if(!Object.hasOwn(config,'worktree_overrides') && accepted.digest===provenance.coordination.digest
          && accepted.revision===provenance.coordination.revision
          && workspaceConfigDigest(applyWorktreeOverlay(config,currentConfig))===provenance.effectiveDigest) {
          matches.push({config,accepted,effective:applyWorktreeOverlay(config,currentConfig)});
        }
      } catch { /* Other registered worktrees are not coordination candidates. */ }
    }
    if(matches.length===1) {
      ({effective,accepted:coordinationPolicy}=matches[0]);
    } else if(matches.length>1) fail('coordination policy is ambiguous across registered worktrees');
    else {
      const basePolicy=acceptedConfigAt(root,baseSha);
      if(basePolicy.accepted.digest!==provenance.coordination.digest || basePolicy.accepted.revision!==provenance.coordination.revision) {
        fail('accepted coordination policy is stale or unavailable in PR context');
      }
      coordinationPolicy=basePolicy.accepted;
      effective=applyWorktreeOverlay(basePolicy.config,currentConfig);
    }
  }
  if(provenance.revision!==coordinationPolicy.revision || workspaceConfigDigest(effective)!==provenance.effectiveDigest) {
    fail('effective accepted policy digest is stale; rerun preflight');
  }
  return effective;
}

function validReview(value,{withMode=false,requiresCommit=true,developer,expectedCommit,expectedRevision,independent=false}={}) {
  const baseFields=requiresCommit?REVIEW_FIELDS:REVIEW_FIELDS.filter(field=>field!=='commit');
  const fields=withMode?[...baseFields,'mode']:baseFields;
  if(!isObject(value) || Object.keys(value).some(key=>!fields.includes(key)) || fields.some(key=>!Object.hasOwn(value,key))) return false;
  if(typeof value.by!=='string' || !value.by.trim() || typeof value.notes!=='string' || !value.notes.trim()
    || !Number.isInteger(value.revision) || value.revision<1
    || typeof value.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    || Number.isNaN(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0,10)!==value.date
    || (requiresCommit && (typeof value.commit!=='string' || !/^[a-f0-9]{40}$/i.test(value.commit)))) return false;
  if(withMode && !['self-check','independent'].includes(value.mode)) return false;
  if(independent && sameIdentity(value.by,developer)) return false;
  if(expectedCommit && value.commit.toLowerCase()!==expectedCommit.toLowerCase()) return false;
  if(expectedRevision!==undefined && value.revision!==expectedRevision) return false;
  if(withMode && value.mode==='self-check' && !sameIdentity(value.by,developer)) return false;
  if(withMode && value.mode==='independent' && sameIdentity(value.by,developer)) return false;
  return true;
}

function validateTier2Evidence(record,config,reviewedCommit) {
  const review=record.reviewEvidence;
  if(!validReview(review,{withMode:true,developer:record.developer,expectedCommit:reviewedCommit})) {
    fail('reviewEvidence must be a valid self-check or independent review on the reviewed commit');
  }
  const revision=review.revision,roles=record.roleEvidence;
  if(roles!==null && !isObject(roles)) fail('roleEvidence must be an object or null');
  if(isObject(roles) && Object.keys(roles).some(role=>!ROLES.includes(role))) fail('roleEvidence contains an unknown approval role');
  const evidence=roles??{};
  for(const role of ROLES) {
    const required=config.approvals_required[role]===true && !config.approvals_overrides.exempt.includes(role);
    const approval=evidence[role];
    if(required && !approval) fail(`required ${role} approval is missing; use the Tier 3 governed review route`);
    if(approval && !validReview(approval,{developer:record.developer,expectedCommit:reviewedCommit,expectedRevision:revision,independent:true})) {
      fail(`${role} approval must be independent of the developer and match reviewed revision and commit`);
    }
  }
  if(record.userFacingUI===true) {
    const access=record.accessibilityEvidence;
    if(!isObject(access) || Object.keys(access).some(key=>!['triage','plan','finalReview'].includes(key))) {
      fail('accessibilityEvidence has an unknown or malformed field; use the Tier 3 route');
    }
    for(const stage of ['triage','plan']) {
      if(!isObject(access) || !validReview(access[stage],{requiresCommit:false,developer:record.developer,expectedRevision:revision,independent:true})) {
        fail(`independent accessibility ${stage} evidence is missing or stale; use the Tier 3 route`);
      }
    }
    if(!validReview(access.finalReview,{developer:record.developer,expectedCommit:reviewedCommit,expectedRevision:revision,independent:true})) {
      fail('independent accessibility final review on reviewedCommit is missing; use the Tier 3 route');
    }
  }
}

function assertInitialClassification(record) {
  const result=classifyTask({
    stage:'preflight',developer:record.developer,scope:record.scope,risks:record.risks,
    userFacingUI:record.userFacingUI,claimedTier:record.claimedTier,intendedFiles:record.intendedFiles,
    accessibilityEvidence:record.accessibilityEvidence,
  });
  if(result.tier!==record.selectedTier || !isDeepStrictEqual(result.reasons,record.reasons)) {
    fail('first committed assessment classification is internally inconsistent; use the Tier 3 route');
  }
}

function assertPreflightBeforeIntendedChanges(root,baseSha,baseline) {
  const priorChanges=nulPaths(git(root,['diff','--name-only','--no-renames','-z',
    `${baseSha}...${baseline.record.startingHead}`,'--',...baseline.record.intendedFiles]));
  if(priorChanges.length) {
    fail(`intended source path ${priorChanges[0]} changed before initial assessment evidence relative to PR base history`);
  }
}

function assertReviewWindow(root,reviewedCommit,headSha) {
  try { git(root,['merge-base','--is-ancestor',reviewedCommit,headSha]); }
  catch { fail('reviewedCommit must be an ancestor of PR HEAD'); }
  const commits=git(root,['rev-list','--reverse',`${reviewedCommit}..${headSha}`]).trim().split('\n').filter(Boolean);
  const changed=[];
  for(const commit of commits) {
    changed.push(...nulPaths(git(root,['diff-tree','--root','--no-commit-id','--no-renames','--name-only','-z','-r','-m',commit])));
  }
  const forbidden=changed.find(file=>!/^project\/task-assessments\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.yaml$/.test(file));
  if(forbidden) fail(`non-assessment change ${forbidden} occurred after reviewedCommit; only task-assessment metadata may change after review`);
}

function assertImplementationFollowsPreflight(root,baseSha,baseline,reviewedCommit) {
  try { git(root,['merge-base','--is-ancestor',baseline.commit,reviewedCommit]); }
  catch { fail('reviewed implementation must follow the committed preflight assessment'); }
  const commits=git(root,['rev-list','--reverse',`${baseSha}..${reviewedCommit}`]).trim().split('\n').filter(Boolean);
  for(const commit of commits) {
    const changed=nulPaths(git(root,['diff-tree','--root','--no-commit-id','--no-renames','--name-only','-z','-r','-m',commit]));
    const intendedPath=changed.find(file=>baseline.record.intendedFiles.includes(file));
    if(intendedPath) {
      try { git(root,['merge-base','--is-ancestor',baseline.commit,commit]); }
      catch { fail(`implementation commit ${commit.slice(0,12)} changing intended source path ${intendedPath} does not descend from initial assessment evidence`); }
    }
  }
  const intendedChanges=nulPaths(git(root,['diff','--name-only','--no-renames','-z',
    baseline.record.startingHead,reviewedCommit,'--',...baseline.record.intendedFiles]));
  if(!intendedChanges.length) fail('reviewed implementation must change an intended source path after preflight assessment');
}

function canonicalCommit(root,value,label) {
  if(typeof value!=='string' || !/^[a-f0-9]{40}$/i.test(value)) fail(`${label} must be a full commit SHA in PR context`);
  let canonical;
  try { canonical=git(root,['rev-parse',`${value}^{commit}`]).trim(); }
  catch { fail(`${label} does not identify a commit available in the PR checkout`); }
  if(canonical.toLowerCase()!==value.toLowerCase()) fail(`${label} does not identify the requested commit`);
  return canonical;
}

export function validateTier2Assessment({assessmentPath,repoRoot:rootValue,baseSha,headSha,headRef}={}) {
  const root=repoRoot(rootValue);
  const relative=assessmentRelativePath(root,assessmentPath);
  const base=canonicalCommit(root,baseSha,'BASE_SHA');
  const head=canonicalCommit(root,headSha,'HEAD_SHA');
  if(typeof headRef!=='string' || !headRef.trim() || /[\u0000-\u001f\u007f]/.test(headRef)) {
    fail('PR context requires a non-empty headRef');
  }
  const checkedOutHead=git(root,['rev-parse','HEAD']).trim();
  if(checkedOutHead.toLowerCase()!==head.toLowerCase()) fail('HEAD_SHA must match the checked-out PR HEAD');
  const changed=nulPaths(git(root,['diff','--name-only','--no-renames','-z',`${base}...${head}`,'--']));
  if(!changed.includes(relative)) fail('assessment is not changed in the base-to-HEAD PR diff');

  const record=readAssessment(root,relative);
  const baseline=firstAssessmentCommit(relative,head,root);
  assertPreflightBeforeIntendedChanges(root,base,baseline);
  assertInitialClassification(baseline.record);
  assertInitialFactsUnchanged(record,baseline.record);
  const config=acceptedPolicy(root,record,base);
  const actualFiles=[...new Set(changed.filter(file=>!/^project\/task-assessments\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.yaml$/.test(file)))].sort();
  const classified=classifyTask({
    stage:'final',developer:record.developer,scope:record.scope,risks:record.risks,
    userFacingUI:record.userFacingUI,claimedTier:record.claimedTier,intendedFiles:record.intendedFiles,
    actualFiles,accessibilityEvidence:record.accessibilityEvidence,
    reviewedCommit:record.reviewEvidence?.commit,
  });
  const tier=Math.max(baseline.record.selectedTier,classified.tier);
  if(tier===3) {
    if(baseline.record.selectedTier!==3) {
      fail(`actual PR diff reclassifies to Tier 3 (${classified.reasons.join(', ')||'higher recorded tier'}); use the governed Tier 3 review route`);
    }
    return {assessmentPath:relative,tier:3,status:'epic-gate-required',actualFiles,initialEvidenceCommit:baseline.commit,
      route:'Tier 3 governed epic/task workflow'};
  }
  if(tier===1) {
    return {assessmentPath:relative,tier:1,status:'passed',actualFiles,initialEvidenceCommit:baseline.commit,
      route:'Tier 1 route; template PR-only rules still apply'};
  }

  const reviewedCommit=record.reviewEvidence?.commit;
  validateTier2Evidence(record,config,reviewedCommit);
  canonicalCommit(root,reviewedCommit,'reviewEvidence.commit');
  assertImplementationFollowsPreflight(root,base,baseline,reviewedCommit);
  assertReviewWindow(root,reviewedCommit,head);
  return {assessmentPath:relative,tier:2,status:'passed',actualFiles,reviewedCommit,initialEvidenceCommit:baseline.commit};
}
