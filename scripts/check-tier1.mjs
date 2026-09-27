#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import YAML from 'yaml';
import {classifyTask} from './lib/task-tier.mjs';
import {parseWorkspaceConfig,workspaceConfigDigest} from './lib/workspace-config.mjs';
import {assertAcceptedWorkspaceConfig,readWorkspaceHistory} from './lib/workspace-history.mjs';
import {pathToFileURL} from 'node:url';

const READ_ONLY_COMMANDS=new Set(['rev-parse','worktree','status','rev-list','diff','diff-tree','show','log','ls-files','ls-tree','merge-base']);
const INITIAL_FIELDS=['kind','id','startingHead','acceptedConfig','developer','scope','risks','userFacingUI','intendedFiles','claimedTier','selectedTier','reasons','accessibilityEvidence'];
const RISK_KEYS=['auth','secrets','schema','publicApi','financial','userData','criticalInfrastructure','hardToRevert'];
const CONFIG_ROLES=['principal','qa','appsec','accessibility_reviewer','ui_designer'];

function fail(message) { throw new Error(message); }
function isObject(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function nulPaths(value) { return value.split('\0').filter(Boolean); }

export function createReadOnlyGitAdapter(root) {
  const actualRoot=fs.realpathSync(root);
  return Object.freeze({run(args) {
    if(!Array.isArray(args) || !args.length || args.some(arg=>typeof arg!=='string') || !READ_ONLY_COMMANDS.has(args[0])) fail('Tier 1 Git adapter permits read-only Git operations only');
    if(args[0]==='worktree' && args[1]!=='list') fail('Tier 1 Git adapter permits only git worktree list');
    if(args.some(arg=>arg==='--output'||arg.startsWith('--output=')||['--ext-diff','--textconv','--exec','--no-index'].includes(arg))) {
      fail('Tier 1 Git adapter refuses output and external-command options');
    }
    return execFileSync('git',['-C',actualRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  }});
}

function runGit(adapter,args) {
  try {
    const output=adapter.run([...args]);
    return Buffer.isBuffer(output)?output.toString('utf8'):String(output);
  } catch(error) {
    fail(`Read-only Git check failed (${args[0]}): ${error.message}`);
  }
}

function repositoryRoot(pathValue,adapter) {
  const actual=fs.realpathSync(pathValue);
  const gitRoot=fs.realpathSync(runGit(adapter,['rev-parse','--show-toplevel']).trim());
  if(actual!==gitRoot) fail('Run Tier 1 validation from the top-level registered worktree');
  const registered=runGit(adapter,['worktree','list','--porcelain']).split('\n')
    .filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
  if(!registered.includes(actual)) fail('Tier 1 validation requires a registered Git worktree root');
  return actual;
}

function assessmentRelativePath(root,value) {
  if(typeof value!=='string' || !value || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) fail('Assessment path is malformed');
  const absolute=path.resolve(root,value);
  const relative=path.relative(root,absolute);
  const repoPath=relative.split(path.sep).join('/');
  if(!repoPath.startsWith('project/task-assessments/') || !repoPath.endsWith('.yaml') || repoPath.split('/').some(part=>part==='..'||part==='.'||!part)) {
    fail('Assessment path must be a YAML file under project/task-assessments');
  }
  return repoPath;
}

function safeReadFile(root,relative,label) {
  let current=root;
  const parts=relative.split('/');
  for(const part of parts.slice(0,-1)) {
    current=path.join(current,part);
    const stat=fs.lstatSync(current);
    if(stat.isSymbolicLink() || !stat.isDirectory()) fail(`${label} path cannot traverse a symlink or non-directory`);
  }
  const file=path.join(root,...parts),stat=fs.lstatSync(file);
  if(stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular file`);
  const actual=fs.realpathSync(file);
  if(!actual.startsWith(root+path.sep)) fail(`${label} escapes the worktree`);
  return fs.readFileSync(actual,'utf8');
}

function parseYaml(raw,label) {
  const document=YAML.parseDocument(raw,{uniqueKeys:true});
  if(document.errors.length) fail(`${label} has invalid YAML: ${document.errors.map(error=>error.message).join('; ')}`);
  try { return document.toJS({maxAliasCount:0}); }
  catch(error) { fail(`${label} has invalid YAML: ${error.message}`); }
}

function readAssessment(root,relative) {
  const value=parseYaml(safeReadFile(root,relative,'Assessment'),'Assessment');
  if(!isObject(value) || value.kind!=='task-assessment' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value.id)
    || relative!==`project/task-assessments/${value.id}.yaml`) fail('Assessment identity or shape is malformed');
  if(!/^[a-f0-9]{40}$/i.test(value.startingHead) || !isObject(value.acceptedConfig)) fail('Assessment start or accepted config evidence is malformed');
  if(!isObject(value.risks) || RISK_KEYS.some(key=>!Object.hasOwn(value.risks,key))) fail('Assessment risk evidence is malformed');
  if(!Array.isArray(value.intendedFiles) || !Array.isArray(value.reasons) || ![1,2,3].includes(value.selectedTier)) fail('Assessment classification evidence is malformed');
  return value;
}

function readAcceptedConfig(root) {
  const config=parseWorkspaceConfig(safeReadFile(root,'config/workspace-config.yaml','Workspace config'));
  const history=readWorkspaceHistory(root);
  if(!history.length) fail(`No accepted workspace config history in ${root}`);
  const accepted=assertAcceptedWorkspaceConfig(root,config);
  return {config,accepted};
}

function applyWorktreeOverlay(rootConfig,overlay) {
  if(Object.hasOwn(rootConfig,'worktree_overrides')) fail('Coordination config cannot declare worktree_overrides');
  if(Object.hasOwn(overlay,'task_tiers') && JSON.stringify(overlay.task_tiers)!==JSON.stringify(rootConfig.task_tiers)) {
    fail('Accepted Tier 1 policy cannot be overridden by a worktree');
  }
  const markers=overlay.worktree_overrides;
  if(!markers) fail('Linked worktree config has no accepted override markers');
  const effective=structuredClone(rootConfig);
  for(const marker of markers) {
    if(marker==='workspace.provider') effective.workspace.provider=overlay.workspace.provider;
    else if(marker==='approvals_overrides') effective.approvals_overrides=overlay.approvals_overrides;
    else if(CONFIG_ROLES.some(role=>marker===`approvals_required.${role}`)) {
      const role=marker.slice('approvals_required.'.length);
      effective.approvals_required[role]=overlay.approvals_required[role];
    } else fail(`Unknown worktree override marker: ${marker}`);
  }
  return parseWorkspaceConfig(YAML.stringify(effective));
}

function acceptedEffectivePolicy(root,assessment,adapter) {
  const recorded=assessment.acceptedConfig;
  if(!/^[a-f0-9]{64}$/.test(recorded.effectiveDigest) || !Number.isInteger(recorded.revision)
    || !isObject(recorded.coordination) || !/^[a-f0-9]{64}$/.test(recorded.coordination.digest)
    || !Number.isInteger(recorded.coordination.revision)) fail('Accepted config provenance is malformed');
  const currentWorktree=readAcceptedConfig(root);
  const worktreeRecord=recorded.worktree;
  let effective,policy,coordinationRoot=root;
  if(worktreeRecord===null) {
    if(currentWorktree.accepted.digest!==recorded.coordination.digest || currentWorktree.accepted.revision!==recorded.coordination.revision
      || recorded.revision!==recorded.coordination.revision) fail('Accepted workspace config is stale; rerun preflight');
    effective=currentWorktree.config;
    policy=currentWorktree.accepted;
  } else {
    if(!isObject(worktreeRecord) || !/^[a-f0-9]{64}$/.test(worktreeRecord.digest) || !Number.isInteger(worktreeRecord.revision)
      || currentWorktree.accepted.digest!==worktreeRecord.digest || currentWorktree.accepted.revision!==worktreeRecord.revision) {
      fail('Accepted linked-worktree config is stale; rerun preflight');
    }
    const worktrees=runGit(adapter,['worktree','list','--porcelain']).split('\n')
      .filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9))).filter(candidate=>candidate!==root);
    const matches=[];
    for(const candidate of worktrees) {
      try {
        const rootConfig=readAcceptedConfig(candidate);
        if(Object.hasOwn(rootConfig.config,'worktree_overrides') || rootConfig.accepted.digest!==recorded.coordination.digest
          || rootConfig.accepted.revision!==recorded.coordination.revision) continue;
        const combined=applyWorktreeOverlay(rootConfig.config,currentWorktree.config);
        if(workspaceConfigDigest(combined)===recorded.effectiveDigest) matches.push({root:candidate,config:combined,accepted:rootConfig.accepted});
      } catch { /* Other registered roots are not candidates for this assessment. */ }
    }
    if(matches.length!==1) fail(matches.length?'Coordination root is ambiguous; provide one explicit root':'Accepted coordination config is stale or unavailable');
    ({root:coordinationRoot,config:effective,accepted:policy}=matches[0]);
    if(recorded.revision!==policy.revision) fail('Accepted config revision is stale; rerun preflight');
  }
  if(workspaceConfigDigest(effective)!==recorded.effectiveDigest) fail('Effective accepted config digest is stale; rerun preflight');
  return {config:effective,accepted:policy,coordinationRoot,directMergeEnabled:effective.task_tiers?.tier_1_direct_merge??false};
}

function assertInitialClassification(record) {
  const result=classifyTask({
    stage:'preflight',developer:record.developer,scope:record.scope,risks:record.risks,
    userFacingUI:record.userFacingUI,claimedTier:record.claimedTier,intendedFiles:record.intendedFiles,
    accessibilityEvidence:record.accessibilityEvidence,
  });
  if(result.tier!==record.selectedTier || !isDeepStrictEqual(result.reasons,record.reasons)) fail('Initial assessment classification is internally inconsistent');
}

function committedInitialRecord(relative,currentHead,adapter) {
  const additions=runGit(adapter,['log','--full-history','--reverse','--format=%H','--diff-filter=A',currentHead,'--',relative]).trim().split('\n').filter(Boolean);
  const evidenceCommit=additions[0];
  if(!evidenceCommit) fail('Initial assessment evidence commit was not found');
  const parents=runGit(adapter,['show','-s','--format=%P',evidenceCommit]).trim().split(/\s+/).filter(Boolean);
  const evidencePaths=nulPaths(runGit(adapter,['diff-tree','--no-commit-id','--no-renames','--name-only','-z','-r',evidenceCommit]));
  const initial=parseYaml(runGit(adapter,['show',`${evidenceCommit}:${relative}`]),'Committed initial assessment');
  if(!isObject(initial) || !/^[a-f0-9]{40}$/i.test(initial.startingHead)) fail('Committed initial assessment has no valid starting HEAD');
  if(parents.length!==1 || parents[0]!==initial.startingHead) fail('Initial evidence commit must be a direct child of starting HEAD');
  if(evidencePaths.length!==1 || evidencePaths[0]!==relative) fail('Initial evidence commit must change the assessment as its sole path');
  if(nulPaths(runGit(adapter,['ls-tree','-z',initial.startingHead,'--',relative])).length) fail('Assessment already existed at its recorded starting commit');
  runGit(adapter,['merge-base','--is-ancestor',initial.startingHead,currentHead]);
  return {commit:evidenceCommit,record:initial};
}

function assertInitialFieldsMatch(current,initial) {
  for(const field of INITIAL_FIELDS) {
    if(!Object.hasOwn(initial,field) || !Object.hasOwn(current,field) || !isDeepStrictEqual(current[field],initial[field])) {
      fail(`Current ${field} differs from the committed initial assessment evidence`);
    }
  }
  assertInitialClassification(current);
}

function changedFiles(start,head,assessmentPath,adapter) {
  const committed=nulPaths(runGit(adapter,['diff','--name-only','--no-renames','-z',start,head,'--']));
  const staged=nulPaths(runGit(adapter,['diff','--cached','--name-only','--no-renames','-z','--']));
  const unstaged=nulPaths(runGit(adapter,['diff','--name-only','--no-renames','-z','--']));
  const untracked=nulPaths(runGit(adapter,['ls-files','--others','--exclude-standard','-z']));
  return [...new Set([...committed,...staged,...unstaged,...untracked])].filter(file=>file!==assessmentPath).sort();
}

function writeBuffer(descriptor,buffer) {
  let offset=0;
  while(offset<buffer.length) {
    const written=fs.writeSync(descriptor,buffer,offset,buffer.length-offset,offset);
    if(!written) fail('Assessment evidence write made no progress');
    offset+=written;
  }
  fs.ftruncateSync(descriptor,buffer.length);
  fs.fsyncSync(descriptor);
}

function sameFile(left,right) {
  return left.dev===right.dev && left.ino===right.ino && left.isFile() && right.isFile();
}

function assertSingleLink(stat) {
  if(stat.nlink!==1) fail('Assessment file must not have multiple hard links');
}

function appendCheck(root,relative,record,check) {
  if(record.finalChecks!==undefined && !Array.isArray(record.finalChecks)) fail('Assessment finalChecks field is malformed');
  const next={...record,finalChecks:[...(record.finalChecks??[]),check]};
  const file=path.join(root,...relative.split('/'));
  const directory=path.dirname(file),actualDirectory=fs.realpathSync(directory);
  if(actualDirectory!==path.resolve(directory) || !actualDirectory.startsWith(root+path.sep)) {
    fail('Assessment directory changed or escapes the worktree');
  }
  const initialStat=fs.lstatSync(file);
  if(initialStat.isSymbolicLink() || !initialStat.isFile()) fail('Assessment file changed before final evidence could be appended');
  assertSingleLink(initialStat);
  if(fs.constants.O_NOFOLLOW===undefined) fail('Safe assessment writes require no-follow file support');
  const descriptor=fs.openSync(file,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW);
  let changed=false;
  let original;
  try {
    const openedStat=fs.fstatSync(descriptor),latestStat=fs.lstatSync(file);
    assertSingleLink(openedStat);assertSingleLink(latestStat);
    if(!sameFile(initialStat,openedStat) || !sameFile(openedStat,latestStat)
      || fs.realpathSync(directory)!==actualDirectory) fail('Assessment path changed before final evidence was written');
    original=fs.readFileSync(descriptor);
    if(!isDeepStrictEqual(parseYaml(original.toString('utf8'),'Assessment'),record)) {
      fail('Assessment changed before final evidence could be appended');
    }
    const updated=Buffer.from(YAML.stringify(next,{lineWidth:0}),'utf8');
    assertSingleLink(fs.fstatSync(descriptor));
    changed=true;
    writeBuffer(descriptor,updated);
    const finalStat=fs.lstatSync(file);
    assertSingleLink(fs.fstatSync(descriptor));assertSingleLink(finalStat);
    if(fs.realpathSync(directory)!==actualDirectory || !sameFile(openedStat,finalStat)) {
      fail('Assessment path changed while final evidence was written');
    }
    return next;
  } catch(error) {
    if(changed) {
      try { writeBuffer(descriptor,original); }
      catch(restoreError) {
        throw new AggregateError([error,restoreError],'Assessment write failed and the original evidence could not be restored');
      }
    }
    throw error;
  } finally { fs.closeSync(descriptor); }
}

function routeFor(tier,directMergeEnabled) {
  if(tier===1) return directMergeEnabled?'Tier 1 direct merge may be considered':'Pull request (Tier 1 direct merge policy is disabled)';
  if(tier===2) return 'Tier 2 pull request with required review evidence';
  return 'Tier 3 governed epic/task workflow';
}

function formatResult(result) {
  const {check,policy}=result;
  const lines=[
    `Tier 1 final check: ${check.status}`,
    `Selected tier: ${check.tier}`,
    `Reasons: ${check.reasons.length?check.reasons.join(', '):'none'}`,
    `Changed files: ${JSON.stringify(check.actualFiles)}`,
    `Direct merge eligible: ${check.directMergeEligible?'yes':'no'}`,
    `Next route: ${check.route}`,
    `Accepted policy digest: ${policy.accepted.digest}`,
    'Compatible host rules are a separate adopter responsibility; this check does not verify or change them.',
  ];
  if(check.tier===1 && check.directMergeEligible) lines.push('This checker performed no merge, push, branch deletion, or PR bypass operation.');
  return lines.join('\n');
}

export function checkTier1({assessmentPath,repoRoot=process.cwd(),gitAdapter=createReadOnlyGitAdapter(repoRoot)}={}) {
  if(!gitAdapter || typeof gitAdapter.run!=='function') fail('A read-only Git adapter is required');
  const root=repositoryRoot(repoRoot,gitAdapter);
  const relative=assessmentRelativePath(root,assessmentPath);
  const record=readAssessment(root,relative);
  const currentHead=runGit(gitAdapter,['rev-parse','HEAD']).trim();
  if(!/^[a-f0-9]{40}$/i.test(currentHead)) fail('Current HEAD is malformed');
  const baseline=committedInitialRecord(relative,currentHead,gitAdapter);
  assertInitialFieldsMatch(record,baseline.record);
  const policy=acceptedEffectivePolicy(root,record,gitAdapter);
  const actualFiles=changedFiles(record.startingHead,currentHead,relative,gitAdapter);
  if(!actualFiles.length) fail('No implementation diff exists after the initial assessment; Tier 1 check requires a non-empty diff');
  const classified=classifyTask({
    stage:'final',developer:record.developer,scope:record.scope,risks:record.risks,userFacingUI:record.userFacingUI,
    claimedTier:record.claimedTier,intendedFiles:record.intendedFiles,actualFiles,
    accessibilityEvidence:record.accessibilityEvidence,reviewedCommit:currentHead,
  });
  const route=routeFor(classified.tier,policy.directMergeEnabled);
  const directMergeEligible=record.selectedTier===1 && classified.tier===1 && policy.directMergeEnabled;
  const check={
    status:record.selectedTier===1&&classified.tier===1?'passed':'escalated',
    checkedHead:currentHead,initialEvidenceCommit:baseline.commit,actualFiles,
    tier:classified.tier,reasons:classified.reasons,directMergeEligible,route,
  };
  const updated=appendCheck(root,relative,record,check);
  return {record:updated,check,policy,tier:check.tier,directMergeEligible:check.directMergeEligible,route:check.route,output:formatResult({check,policy})};
}

function parseArguments(args) {
  if(args.length!==2 || args[0]!=='--assessment' || !args[1]) fail('Usage: node scripts/check-tier1.mjs --assessment project/task-assessments/ID.yaml');
  return {assessmentPath:args[1]};
}

export function runTier1Check(args=process.argv.slice(2)) {
  const result=checkTier1(parseArguments(args));
  process.stdout.write(`${result.output}\n`);
  if(result.check.status==='escalated') process.exitCode=1;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { runTier1Check(); }
  catch(error) { process.stderr.write(`check-tier1: ${error.message}\n`);process.exitCode=1; }
}
