import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import YAML from 'yaml';

const approvalRoles=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
const workspaceFields=['repository','environment','provider','slack_channel_name','timezone'];
const worktreeOverridePaths=['workspace.provider','approvals_overrides',...approvalRoles.map(role=>`approvals_required.${role}`)];

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
  const data=fields(value,['workspace','approvals_required','approvals_overrides','daily_summary','worktree_overrides'],partial?[]:['workspace','approvals_required','daily_summary'],'config');
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
  const sources={};
  for(const [section,entries] of Object.entries(config)) {
    for(const key of Object.keys(entries)) sources[`${section}.${key}`]='root';
  }
  if(worktree===root) return {config,sources};
  const registered=execFileSync('git',['-C',worktree,'worktree','list','--porcelain'],{encoding:'utf8'})
    .split('\n').filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
  if(!registered.includes(root) || !registered.includes(worktree)) {
    throw new Error('Worktree and coordination root must be linked Git worktrees');
  }
  const overlay=readConfig(worktree);
  const markers=overlay.worktree_overrides;
  if(!markers) throw new Error('Linked worktree config requires worktree_overrides markers');
  const effective=structuredClone(config);
  for(const marker of markers) {
    if(marker==='workspace.provider') {
      effective.workspace.provider=overlay.workspace.provider;
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
  return {config:parseWorkspaceConfig(YAML.stringify(effective)),sources};
}
