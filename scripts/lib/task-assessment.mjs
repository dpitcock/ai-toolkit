import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import YAML from 'yaml';
import {classifyTask} from './task-tier.mjs';
import {parseWorkspaceConfig,resolveWorkspaceConfig,workspaceConfigDigest} from './workspace-config.mjs';
import {readWorkspaceHistory,assertAcceptedWorkspaceConfig} from './workspace-history.mjs';
import {resolveTier3Policy} from './tier3-policy.mjs';

const answerKeys=['developer','scope','risks','userFacingUI','claimedTier','intendedFiles','accessibilityEvidence','tier3Binding'];
const requiredAnswerKeys=['developer','scope','risks','userFacingUI','claimedTier','intendedFiles','accessibilityEvidence'];
const riskKeys=['auth','secrets','schema','publicApi','financial','userData','criticalInfrastructure','hardToRevert'];
const approvalRoles=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
const scopeValues=['single-file','one-subsystem','cross-cutting','unknown'];
const directoryFlags=fs.constants.O_RDONLY|(fs.constants.O_DIRECTORY??0)|(fs.constants.O_NOFOLLOW??0);

function isObject(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function reject(message) { throw new Error(message); }

export function safeAssessmentId(value) {
  return typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
}

function safeRepoPath(value) {
  return typeof value==='string' && value.length>0 && !/[\u0000-\u001f\u007f]/.test(value)
    && !value.startsWith('/') && !value.includes('\\') && !/^[A-Za-z]:/.test(value)
    && !value.split('/').some(part=>!part || part==='.' || part==='..');
}

function tier3BindingInput(value) {
  if(!isObject(value) || Object.keys(value).some(key=>!['planPath','taskPath'].includes(key))
    || !safeRepoPath(value.planPath) || !safeRepoPath(value.taskPath)) {
    reject('tier3Binding must name safe planPath and taskPath values');
  }
  return {planPath:value.planPath,taskPath:value.taskPath};
}

function validateReviewEntry(value,withCommit=false) {
  if(value===null) return true;
  const fields=withCommit?['by','date','notes','revision','commit']:['by','date','notes','revision'];
  if(!isObject(value) || Object.keys(value).some(key=>!fields.includes(key)) || fields.some(key=>!Object.hasOwn(value,key))) return false;
  if(typeof value.by!=='string' || !value.by.trim() || typeof value.notes!=='string' || !value.notes.trim()) return false;
  if(!Number.isInteger(value.revision) || value.revision<1 || typeof value.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false;
  if(Number.isNaN(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0,10)!==value.date) return false;
  return !withCommit || (typeof value.commit==='string' && /^[a-f0-9]{40}$/i.test(value.commit));
}

function validateAccessibilityEvidence(value) {
  if(value===null) return true;
  if(!isObject(value) || Object.keys(value).some(key=>!['triage','plan','finalReview'].includes(key))) return false;
  if(!Object.hasOwn(value,'triage') || !Object.hasOwn(value,'plan')) return false;
  return validateReviewEntry(value.triage) && validateReviewEntry(value.plan)
    && (!Object.hasOwn(value,'finalReview') || validateReviewEntry(value.finalReview,true));
}

export function validateAssessmentAnswers(value) {
  if(!isObject(value)) reject('Assessment input must be a JSON object');
  if(Object.keys(value).some(key=>!answerKeys.includes(key))) reject('Assessment input contains unknown or derived fields');
  if(requiredAnswerKeys.some(key=>!Object.hasOwn(value,key))) reject('Assessment input is missing a required answer field');
  if(typeof value.developer!=='string' || !value.developer.trim()) reject('developer must be a non-empty attested identity');
  if(!scopeValues.includes(value.scope)) reject('scope must be a known classification value');
  if(!isObject(value.risks) || Object.keys(value.risks).length!==riskKeys.length || riskKeys.some(key=>!Object.hasOwn(value.risks,key))) {
    reject('risks must contain exactly the eight declared risk answers');
  }
  if(riskKeys.some(key=>value.risks[key]!==true && value.risks[key]!==false && value.risks[key]!==null)) {
    reject('each risk answer must be true, false, or null');
  }
  if(value.userFacingUI!==true && value.userFacingUI!==false && value.userFacingUI!==null) reject('userFacingUI must be true, false, or null');
  if(![1,2,3,null].includes(value.claimedTier)) reject('claimedTier must be 1, 2, 3, or null');
  if(!Array.isArray(value.intendedFiles) || !value.intendedFiles.length || value.intendedFiles.some(file=>!safeRepoPath(file))
    || new Set(value.intendedFiles).size!==value.intendedFiles.length) reject('intendedFiles must contain unique safe repository-relative paths');
  if(!validateAccessibilityEvidence(value.accessibilityEvidence)) reject('accessibilityEvidence must use the exact staged evidence shapes');
  return {
    developer:value.developer.trim(),scope:value.scope,risks:Object.fromEntries(riskKeys.map(key=>[key,value.risks[key]])),
    userFacingUI:value.userFacingUI,claimedTier:value.claimedTier,intendedFiles:[...value.intendedFiles],
    accessibilityEvidence:structuredClone(value.accessibilityEvidence),
    ...(Object.hasOwn(value,'tier3Binding') ? {tier3Binding:tier3BindingInput(value.tier3Binding)} : {}),
  };
}

function repositoryRoot(value,label) {
  if(typeof value!=='string' || !value) reject(`${label} is required`);
  const root=fs.realpathSync(value);
  if(!fs.statSync(root).isDirectory()) reject(`${label} must be a directory`);
  return root;
}

function safeConfigFile(root) {
  const directory=path.join(root,'config');
  const file=path.join(directory,'workspace-config.yaml');
  const directoryStat=fs.lstatSync(directory);
  const fileStat=fs.lstatSync(file);
  if(directoryStat.isSymbolicLink() || !directoryStat.isDirectory() || fileStat.isSymbolicLink() || !fileStat.isFile()) {
    reject('Accepted workspace config must be a regular root-local file');
  }
  const actualDirectory=fs.realpathSync(directory),actualFile=fs.realpathSync(file);
  if(!actualDirectory.startsWith(root+path.sep) || !actualFile.startsWith(root+path.sep)) reject('Accepted workspace config escapes its repository root');
  return parseWorkspaceConfig(fs.readFileSync(actualFile,'utf8'));
}

function acceptedConfig(root,label) {
  const config=safeConfigFile(root);
  const history=readWorkspaceHistory(root);
  if(!history.length) reject(`${label} has no accepted workspace config history`);
  const accepted=assertAcceptedWorkspaceConfig(root,config);
  return {config,accepted};
}

function git(root,args) {
  try { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }
  catch(error) { reject(`Unable to inspect Git state for ${root}: ${error.message}`); }
}

function assertRegisteredWorktreeRoot(root,label) {
  const topLevel=fs.realpathSync(git(root,['rev-parse','--show-toplevel']));
  if(topLevel!==root) reject(`${label} must be the top-level path of a registered Git worktree`);
  const registered=git(root,['worktree','list','--porcelain']).split('\n')
    .filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice('worktree '.length)));
  if(!registered.includes(root)) reject(`${label} is not a registered Git worktree root`);
}

function assertCleanWorktree(root) {
  const changes=git(root,['status','--porcelain=v1','--untracked-files=all']);
  if(changes) reject('The linked worktree must be clean before preflight; commit or remove tracked and untracked changes first');
}

function assertContained(root,directory) {
  const actual=fs.realpathSync(directory);
  if(actual===root || !actual.startsWith(root+path.sep)) reject('Assessment path must stay inside the worktree');
  return actual;
}

function readYamlInsideWorktree(root,relativePath,label) {
  if(!safeRepoPath(relativePath)) reject(`${label} path is unsafe`);
  const candidate=path.join(root,relativePath);
  let stat;
  try { stat=fs.lstatSync(candidate); }
  catch { reject(`${label} does not exist`); }
  if(stat.isSymbolicLink() || !stat.isFile()) reject(`${label} must be a regular file`);
  const actual=fs.realpathSync(candidate);
  if(!actual.startsWith(root+path.sep)) reject(`${label} escapes the registered worktree`);
  const document=YAML.parseDocument(fs.readFileSync(actual,'utf8'),{uniqueKeys:true});
  if(document.errors.length) reject(`${label} is invalid YAML`);
  const value=document.toJS({maxAliasCount:0});
  if(!isObject(value)) reject(`${label} must be a mapping`);
  return value;
}

function currentBranch(root) {
  const branch=git(root,['symbolic-ref','--quiet','--short','HEAD']);
  if(!/^epic\/EPIC-\d+$/.test(branch)) reject('Tier 3 linked worktree must use an epic/EPIC-NNN branch');
  return branch;
}

function buildTier3Binding({answers,coordination,worktree,rootPolicy,worktreePolicy,resolved}) {
  if(worktree===coordination) reject('Tier 3 rejects the coordination checkout; use a distinct registered linked worktree');
  const branch=currentBranch(worktree);
  if(!answers.tier3Binding) reject('Tier 3 requires a named current epic plan and listed task binding');
  const {planPath,taskPath}=answers.tier3Binding;
  const plan=readYamlInsideWorktree(worktree,planPath,'Tier 3 plan');
  const task=readYamlInsideWorktree(worktree,taskPath,'Tier 3 task');
  const epicId=branch.slice('epic/'.length);
  const expectedPlanPath=`epics/${epicId}/epic-plan.md`;
  if(planPath!==expectedPlanPath || plan.kind!=='epic-plan' || plan.id!==`${epicId}-PLAN` || !Number.isInteger(plan.revision) || plan.revision<1) {
    reject('Tier 3 plan must be the current named epic plan for the worktree branch');
  }
  if(!['approved','in-progress'].includes(plan.status)) reject('Tier 3 plan must be approved or in-progress');
  if(!Array.isArray(plan.tasks) || !plan.tasks.every(entry=>typeof entry==='string')) reject('Tier 3 plan task list is malformed');
  const listedTaskPath=path.posix.normalize(path.posix.join(path.posix.dirname(planPath),plan.tasks.find(entry=>path.posix.normalize(path.posix.join(path.posix.dirname(planPath),entry))===taskPath)??''));
  if(listedTaskPath!==taskPath || task.kind!=='task' || typeof task.id!=='string' || !task.id || task.parent!=='../epic-plan.md' || task.parent_revision!==plan.revision) {
    reject('Tier 3 task must be listed by the current named plan and bound to its revision');
  }
  if(task.status!=='approved') reject('Tier 3 task must be approved before preflight');
  const policy=resolveTier3Policy({config:resolved.config,sources:resolved.sources});
  return {
    planPath,planId:plan.id,planRevision:plan.revision,taskPath,taskId:task.id,branch,
    worktreePath:path.relative(coordination,worktree),
    policy:{
      coordination:{digest:rootPolicy.accepted.digest,revision:rootPolicy.accepted.revision},
      worktree:{digest:worktreePolicy.accepted.digest,revision:worktreePolicy.accepted.revision},
      effectiveDigest:policy.effectiveDigest,roles:policy.roles,
    },
  };
}

function ensureAssessmentDirectory(root) {
  let current=root;
  for(const component of ['project','task-assessments']) {
    current=path.join(current,component);
    try { fs.mkdirSync(current,{mode:0o700}); }
    catch(error) { if(error.code!=='EEXIST') throw error; }
    const stat=fs.lstatSync(current);
    if(stat.isSymbolicLink() || !stat.isDirectory()) reject('Assessment directories cannot be symlinks or non-directories');
    assertContained(root,current);
  }
  return current;
}

function serializeTaskAssessment(record) {
  return YAML.stringify(record,{lineWidth:0});
}

export function writeTaskAssessment(worktreeRoot,id,record) {
  if(!safeAssessmentId(id)) reject('Assessment id is unsafe');
  if(!isObject(record) || record.id!==id) reject('Assessment record id does not match its safe path');
  const root=repositoryRoot(worktreeRoot,'worktree root');
  const directory=ensureAssessmentDirectory(root);
  const target=path.join(directory,`${id}.yaml`);
  try { fs.lstatSync(target); reject(`Assessment ${id} already exists; refusing to overwrite it`); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  const temporary=path.join(directory,`.${id}.${process.pid}.${randomBytes(12).toString('hex')}.tmp`);
  const content=serializeTaskAssessment(record);
  let descriptor;
  try {
    descriptor=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW??0),0o600);
    fs.writeFileSync(descriptor,content,'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);descriptor=undefined;
    const directoryStat=fs.lstatSync(directory);
    if(directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) reject('Assessment directory changed during creation');
    assertContained(root,directory);
    try { fs.linkSync(temporary,target); }
    catch(error) {
      if(error.code==='EEXIST') reject(`Assessment ${id} already exists; refusing to overwrite it`);
      throw error;
    }
    const created=fs.lstatSync(target);
    if(created.isSymbolicLink() || !created.isFile() || !assertContained(root,target)) reject('Assessment file escaped the worktree');
    const directoryDescriptor=fs.openSync(directory,directoryFlags);
    try { fs.fsyncSync(directoryDescriptor); }
    finally { fs.closeSync(directoryDescriptor); }
    fs.unlinkSync(temporary);
    return target;
  } finally {
    if(descriptor!==undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch(error) { if(error.code!=='ENOENT') throw error; }
  }
}

export function buildTaskAssessment({id,answers,coordinationRoot,worktreeRoot,enforceTier3Binding=false}) {
  if(!safeAssessmentId(id)) reject('Assessment id is unsafe; use 1-64 letters, digits, dots, underscores, or hyphens and start with a letter or digit');
  const normalizedAnswers=validateAssessmentAnswers(answers);
  const coordination=repositoryRoot(coordinationRoot,'coordination root');
  const worktree=repositoryRoot(worktreeRoot??coordinationRoot,'worktree root');
  assertRegisteredWorktreeRoot(coordination,'Coordination root');
  if(worktree!==coordination) assertRegisteredWorktreeRoot(worktree,'Worktree root');
  const rootPolicy=acceptedConfig(coordination,'Coordination root');
  const worktreePolicy=worktree===coordination?rootPolicy:acceptedConfig(worktree,'Linked worktree');
  const resolved=resolveWorkspaceConfig({coordinationRoot:coordination,worktreeRoot:worktree});
  assertCleanWorktree(worktree);
  const startingHead=git(worktree,['rev-parse','HEAD']);
  if(!/^[a-f0-9]{40}$/i.test(startingHead)) reject('Unable to determine a full starting HEAD commit');
  const classification=classifyTask({...normalizedAnswers,stage:'preflight'});
  const tier3Binding=classification.tier===3 && enforceTier3Binding
    ? buildTier3Binding({answers:normalizedAnswers,coordination,worktree,rootPolicy,worktreePolicy,resolved})
    : null;
  if(enforceTier3Binding && classification.tier!==3 && Object.hasOwn(normalizedAnswers,'tier3Binding')) {
    reject('tier3Binding is allowed only when Tier 3 is selected');
  }
  const record={
    kind:'task-assessment',id,startingHead,
    acceptedConfig:{
      effectiveDigest:workspaceConfigDigest(resolved.config),revision:rootPolicy.accepted.revision,
      coordination:{digest:rootPolicy.accepted.digest,revision:rootPolicy.accepted.revision},
      worktree:worktree===coordination?null:{digest:worktreePolicy.accepted.digest,revision:worktreePolicy.accepted.revision},
    },
    developer:normalizedAnswers.developer,scope:normalizedAnswers.scope,risks:normalizedAnswers.risks,
    userFacingUI:normalizedAnswers.userFacingUI,intendedFiles:normalizedAnswers.intendedFiles,
    claimedTier:normalizedAnswers.claimedTier,selectedTier:classification.tier,reasons:classification.reasons,
    accessibilityEvidence:normalizedAnswers.accessibilityEvidence,reviewEvidence:null,roleEvidence:null,
    ...(tier3Binding===null ? {} : {tier3Binding}),
  };
  return {record,config:resolved.config,sources:resolved.sources,policyDigest:rootPolicy.accepted.digest,worktreeRoot:worktree};
}

export function createTaskAssessment(options) {
  const result=buildTaskAssessment(options);
  const file=writeTaskAssessment(result.worktreeRoot,options.id,result.record);
  return {...result,file,serialized:serializeTaskAssessment(result.record)};
}

export function formatTaskAssessment(result) {
  const config=result.config;
  const lines=[
    `Assessment: ${result.record.id}`,
    `Starting HEAD: ${result.record.startingHead}`,
    `Selected tier: ${result.record.selectedTier}`,
    `Reasons: ${result.record.reasons.length?result.record.reasons.join(', '):'none'}`,
    `Effective provider: ${config.workspace.provider} (source: ${result.sources['workspace.provider']??'root'})`,
    'Required approvals:',
  ];
  for(const role of approvalRoles) lines.push(`  ${role}: ${config.approvals_required[role]} (source: ${result.sources[`approvals_required.${role}`]??'root'})`);
  if(result.record.tier3Binding) {
    const binding=result.record.tier3Binding;
    lines.push(
      `Tier 3 plan: ${binding.planId} revision ${binding.planRevision}`,
      `Tier 3 task: ${binding.taskId} (branch: ${binding.branch})`,
    );
  }
  lines.push(
    `Exemptions: ${config.approvals_overrides.exempt.length?config.approvals_overrides.exempt.join(', '):'none'}`,
    `Exemption reason: ${config.approvals_overrides.reason||'none'}`,
    `Accepted policy digest: ${result.policyDigest}`,
    `Effective config digest: ${result.record.acceptedConfig.effectiveDigest}`,
    `Accepted config revision: ${result.record.acceptedConfig.revision}`,
    'Commit the initial assessment as the sole changed path in a metadata-only evidence commit directly on top of starting HEAD, before any implementation changes.',
  );
  return lines.join('\n');
}
