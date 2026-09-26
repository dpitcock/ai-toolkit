import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import YAML from 'yaml';
import {resolveTierDefaults} from './tier-defaults.mjs';
import {workspaceHistoryValidation} from './workspace-history-validation.mjs';

const approvalRoles=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
const workspaceFields=['repository','environment','provider','slack_channel_name','timezone'];
const worktreeOverridePaths=['workspace.provider','workflow.autopilot','approvals_overrides',...approvalRoles.map(role=>`approvals_required.${role}`)];

function object(value,label) {
  if(value===null || typeof value!=='object' || Array.isArray(value)) {
    throw new Error(`${label} must be a mapping`);
  }
  return value;
}

function fields(value,allowed,required,label) {
  const source=object(value,label);
  for(const key of Object.keys(source)) {
    if(!allowed.includes(key)) throw new Error(`${label}.${key} is not allowed`);
  }
  for(const key of required) {
    if(!Object.hasOwn(source,key)) throw new Error(`${label}.${key} is required`);
  }
  return source;
}

function nonempty(value,label) {
  if(typeof value!=='string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalize(value,{partial=false}={}) {
  const data=fields(value,['workspace','approvals_required','approvals_overrides','daily_summary','task_tiers','task_tier','tier_overrides','workflow','worktree_overrides'],partial?[]:['workspace','approvals_required','daily_summary'],'config');
  if(Object.hasOwn(data,'task_tiers') && (Object.hasOwn(data,'task_tier') || Object.hasOwn(data,'tier_overrides'))) {
    throw new Error('task_tiers cannot be used with task_tier or tier_overrides');
  }
  if(Object.hasOwn(data,'task_tier')!==Object.hasOwn(data,'tier_overrides')) {
    throw new Error('task_tier and tier_overrides must be declared together');
  }
  const result={};
  if(Object.hasOwn(data,'workspace')) {
    const workspace=fields(data.workspace,workspaceFields,partial?[]:workspaceFields,'workspace');
    const normalized={};
    for(const key of workspaceFields) {
      if(Object.hasOwn(workspace,key)) normalized[key]=nonempty(workspace[key],`workspace.${key}`);
    }
    for(const key of ['repository','environment','provider']) {
      if(Object.hasOwn(normalized,key) && !/^[a-z0-9][a-z0-9._-]*$/i.test(normalized[key])) {
        throw new Error(`workspace.${key} must be a repository-safe name`);
      }
    }
    if(Object.hasOwn(normalized,'slack_channel_name') && !/^ws-[a-z0-9][a-z0-9._-]*$/i.test(normalized.slack_channel_name)) {
      throw new Error('workspace.slack_channel_name must be a workspace channel name');
    }
    if(Object.hasOwn(normalized,'timezone')) {
      try { new Intl.DateTimeFormat('en-US',{timeZone:normalized.timezone}); }
      catch { throw new Error('workspace.timezone must be an IANA timezone'); }
    }
    result.workspace=normalized;
  }
  if(Object.hasOwn(data,'approvals_required')) {
    const approvals=fields(data.approvals_required,approvalRoles,partial?[]:approvalRoles,'approvals_required');
    const normalized={};
    for(const role of approvalRoles) {
      if(Object.hasOwn(approvals,role)) {
        if(typeof approvals[role]!=='boolean') throw new Error(`approvals_required.${role} must be boolean`);
        normalized[role]=approvals[role];
      }
    }
    result.approvals_required=normalized;
  }
  if(Object.hasOwn(data,'approvals_overrides')) {
    const overrides=fields(data.approvals_overrides,['reason','exempt'],['exempt'],'approvals_overrides');
    if(!Array.isArray(overrides.exempt) || overrides.exempt.some(role=>!approvalRoles.includes(role)) || new Set(overrides.exempt).size!==overrides.exempt.length) {
      throw new Error('approvals_overrides.exempt must contain unique known roles');
    }
    const reason=overrides.exempt.length ? nonempty(overrides.reason,'approvals_overrides.reason')
      : (overrides.reason===undefined || overrides.reason==='' ? '' : nonempty(overrides.reason,'approvals_overrides.reason'));
    result.approvals_overrides={reason,exempt:[...overrides.exempt].sort()};
  } else if(!partial) {
    result.approvals_overrides={reason:'',exempt:[]};
  }
  if(Object.hasOwn(data,'daily_summary')) {
    const summary=fields(data.daily_summary,['local_time'],partial?[]:['local_time'],'daily_summary');
    const normalized={};
    if(Object.hasOwn(summary,'local_time')) {
      if(typeof summary.local_time!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(summary.local_time)) {
        throw new Error('daily_summary.local_time must be HH:MM');
      }
      normalized.local_time=summary.local_time;
    }
    result.daily_summary=normalized;
  }
  if(Object.hasOwn(data,'workflow')) {
    const workflow=fields(data.workflow,['autopilot'],partial?[]:['autopilot'],'workflow');
    if(Object.hasOwn(workflow,'autopilot') && typeof workflow.autopilot!=='boolean') {
      throw new Error('workflow.autopilot must be boolean');
    }
    result.workflow=Object.hasOwn(workflow,'autopilot') ? {autopilot:workflow.autopilot} : {};
  }
  if(Object.hasOwn(data,'task_tiers')) {
    const taskTiers=fields(data.task_tiers,['tier_1_direct_merge'],['tier_1_direct_merge'],'task_tiers');
    if(typeof taskTiers.tier_1_direct_merge!=='boolean') throw new Error('task_tiers.tier_1_direct_merge must be boolean');
    result.task_tiers={tier_1_direct_merge:taskTiers.tier_1_direct_merge};
  }
  if(Object.hasOwn(data,'task_tier')) {
    if(!['tier_1','tier_2','tier_3'].includes(data.task_tier)) {
      throw new Error('task_tier must be tier_1, tier_2, or tier_3');
    }
    const overrides=fields(data.tier_overrides,['direct_merge'],[], 'tier_overrides');
    if(Object.hasOwn(overrides,'direct_merge') && typeof overrides.direct_merge!=='boolean') {
      throw new Error('tier_overrides.direct_merge must be boolean');
    }
    result.task_tier=data.task_tier;
    result.tier_overrides=Object.hasOwn(overrides,'direct_merge') ? {direct_merge:overrides.direct_merge} : {};
  }
  if(Object.hasOwn(data,'worktree_overrides')) {
    if(!Array.isArray(data.worktree_overrides) || data.worktree_overrides.some(marker=>typeof marker!=='string' || !worktreeOverridePaths.includes(marker))) {
      throw new Error('worktree_overrides must contain only known override paths');
    }
    if(new Set(data.worktree_overrides).size!==data.worktree_overrides.length) {
      throw new Error('worktree_overrides must not contain duplicate paths');
    }
    result.worktree_overrides=[...data.worktree_overrides].sort();
  }
  if(result.approvals_required && result.approvals_overrides) {
    for(const role of result.approvals_overrides.exempt) {
      if(result.approvals_required[role]===true) throw new Error(`${role} cannot be required and exempt`);
    }
  }
  return result;
}

export function parseWorkspaceConfig(raw,{partial=false}={}) {
  if(typeof raw!=='string') throw new Error('Workspace config must be YAML text');
  const document=YAML.parseDocument(raw,{uniqueKeys:true});
  if(document.errors.length) {
    throw new Error(`Invalid workspace YAML: ${document.errors.map(error=>error.message).join('; ')}`);
  }
  let value;
  try { value=document.toJS({maxAliasCount:0}); }
  catch(error) { throw new Error(`Invalid workspace YAML: ${error.message}`); }
  return normalize(value,{partial});
}

export function workspaceConfigDigest(config) {
  const normalized=normalize(config);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function workspaceTierDefinition(config) {
  const normalized=normalize(config);
  if(!Object.hasOwn(normalized,'task_tier')) return null;
  const tier=Number(normalized.task_tier.slice(-1));
  return resolveTierDefaults({tier,overrides:normalized.tier_overrides,templateRepository:false}).definition;
}

function rootSources(config) {
  const sources={};
  for(const [section,entries] of Object.entries(config)) {
    if(entries && typeof entries==='object' && !Array.isArray(entries)) {
      for(const key of Object.keys(entries)) sources[`${section}.${key}`]='root';
    } else {
      sources[section]='root';
    }
  }
  return sources;
}

/** Pure overlay semantics shared by preflight and committed-policy final checks. */
export function applyWorktreeOverlay(rootConfig,worktreeConfig) {
  const config=normalize(rootConfig),overlay=normalize(worktreeConfig);
  if(Object.hasOwn(config,'worktree_overrides')) throw new Error('Coordination config cannot declare worktree_overrides');
  const sources=rootSources(config);
  for(const field of ['task_tiers','task_tier','tier_overrides']) {
    if(JSON.stringify(overlay[field])!==JSON.stringify(config[field])) {
      throw new Error('Tier policy is defined by the accepted coordination root; worktrees cannot override it');
    }
  }
  const markers=overlay.worktree_overrides;
  if(!markers) throw new Error('Linked worktree config requires worktree_overrides markers');
  const effective=structuredClone(config);
  for(const marker of markers) {
    if(marker==='workspace.provider') {
      effective.workspace.provider=overlay.workspace.provider;
      sources[marker]='worktree';
    } else if(marker==='workflow.autopilot') {
      if(!Object.hasOwn(overlay.workflow ?? {},'autopilot')) {
        throw new Error('workflow.autopilot override marker requires an autopilot value');
      }
      effective.workflow={autopilot:overlay.workflow.autopilot};
      sources[marker]='worktree';
    } else if(marker==='approvals_overrides') {
      effective.approvals_overrides=overlay.approvals_overrides;
      sources['approvals_overrides.reason']='worktree';
      sources['approvals_overrides.exempt']='worktree';
    } else {
      const role=marker.slice('approvals_required.'.length);
      effective.approvals_required[role]=overlay.approvals_required[role];
      sources[marker]='worktree';
    }
  }
  if(JSON.stringify(overlay.workflow) !== JSON.stringify(config.workflow) && !markers.includes('workflow.autopilot')) {
    throw new Error('workflow.autopilot changes require a worktree_overrides marker');
  }
  return {config:parseWorkspaceConfig(YAML.stringify(effective)),sources};
}

/** Identity comes from the Git-common directory, never matching sibling policy. */
export function canonicalCoordinationRoot(worktreeRoot) {
  const worktree=fs.realpathSync(worktreeRoot);
  const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const common=fs.realpathSync(git(worktree,['rev-parse','--path-format=absolute','--git-common-dir']));
  const registered=git(worktree,['worktree','list','--porcelain','-z']).split('\0')
    .filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
  if(!registered.includes(worktree) || fs.realpathSync(git(worktree,['rev-parse','--show-toplevel']))!==worktree) {
    throw new Error('Canonical mirror requires a registered top-level Git worktree');
  }
  const roots=registered.filter(candidate=>{
    try {
      return fs.realpathSync(git(candidate,['rev-parse','--absolute-git-dir']))===common
        && fs.realpathSync(git(candidate,['rev-parse','--show-toplevel']))===candidate;
    } catch { return false; }
  });
  if(roots.length!==1) throw new Error('Canonical Git-common coordination root is unavailable or ambiguous');
  return roots[0];
}

export function readWorkspacePolicySnapshot(root) {
  const base=fs.realpathSync(root);
  const read=relative=>{
    const [directory,name]=relative.split('/');
    const parent=path.join(base,directory),file=path.join(parent,name);
    if(fs.lstatSync(parent).isSymbolicLink() || !fs.lstatSync(parent).isDirectory()
      || fs.lstatSync(file).isSymbolicLink() || !fs.lstatSync(file).isFile()
      || !fs.realpathSync(file).startsWith(base+path.sep)) {
      throw new Error('Canonical mirror policy must use regular root-local files without symlinks');
    }
    return fs.readFileSync(file);
  };
  return {configText:read('config/workspace-config.yaml'),historyText:read('project/workspace-config-history.jsonl')};
}

/** Exact snapshot semantics shared with committed-base reconstruction in CI. */
export function resolveCanonicalPolicyMirror(rootSnapshot,linkedSnapshot) {
  const {parseWorkspaceHistory,assertAcceptedHistory}=workspaceHistoryValidation({workspaceConfigDigest,workspaceTierDefinition});
  const rootBytes=Buffer.from(rootSnapshot.configText),linkedBytes=Buffer.from(linkedSnapshot.configText);
  const rootHistory=Buffer.from(rootSnapshot.historyText),linkedHistory=Buffer.from(linkedSnapshot.historyText);
  if(!rootBytes.equals(linkedBytes) || !rootHistory.equals(linkedHistory)) {
    throw new Error('Canonical mirror requires exact config and complete accepted-history bytes; nonidentical policy requires worktree_overrides markers');
  }
  const config=parseWorkspaceConfig(rootBytes.toString('utf8'));
  const linkedConfig=parseWorkspaceConfig(linkedBytes.toString('utf8'));
  if(Object.hasOwn(config,'worktree_overrides') || Object.hasOwn(linkedConfig,'worktree_overrides')) {
    throw new Error('Canonical mirror root and linked policy cannot declare worktree_overrides');
  }
  assertAcceptedHistory(parseWorkspaceHistory(rootHistory.toString('utf8')),config);
  assertAcceptedHistory(parseWorkspaceHistory(linkedHistory.toString('utf8')),linkedConfig);
  return {config,sources:rootSources(config)};
}

export function resolveWorkspaceConfig({coordinationRoot,worktreeRoot=coordinationRoot}) {
  if(!coordinationRoot || !worktreeRoot) throw new Error('A repository root is required');
  const root=fs.realpathSync(coordinationRoot);
  const readConfig=base=>{
    const file=path.join(base,'config','workspace-config.yaml');
    const actual=fs.realpathSync(file);
    if(!actual.startsWith(base+path.sep) || fs.lstatSync(file).isSymbolicLink() || !fs.statSync(actual).isFile()) {
      throw new Error('Workspace config must be a regular file inside the repository');
    }
    return parseWorkspaceConfig(fs.readFileSync(actual,'utf8'));
  };
  const config=readConfig(root);
  if(Object.hasOwn(config,'worktree_overrides')) throw new Error('Coordination config cannot declare worktree_overrides');
  const worktree=fs.realpathSync(worktreeRoot);
  if(worktree===root) return {config,sources:rootSources(config)};
  const registered=execFileSync('git',['-C',worktree,'worktree','list','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
    .split('\n').filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
  if(!registered.includes(root) || !registered.includes(worktree)) {
    throw new Error('Worktree and coordination root must be linked Git worktrees');
  }
  const linkedConfig=readConfig(worktree);
  if(!Object.hasOwn(linkedConfig,'worktree_overrides')) {
    if(canonicalCoordinationRoot(worktree)!==root) {
      throw new Error('Canonical mirror must inherit from the actual Git-common coordination root');
    }
    try {
      return resolveCanonicalPolicyMirror(readWorkspacePolicySnapshot(root),readWorkspacePolicySnapshot(worktree));
    } catch(error) {
      throw new Error(`Linked config without worktree_overrides requires an accepted canonical mirror: ${error.message}`,{cause:error});
    }
  }
  return applyWorktreeOverlay(config,linkedConfig);
}
