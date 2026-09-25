import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import YAML from 'yaml';

const approvalRoles=['principal','qa','appsec','accessibility_reviewer','ui_designer'];
const workspaceFields=['repository','environment','provider','slack_channel_name','timezone'];

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
  const data=fields(value,['workspace','approvals_required','approvals_overrides','daily_summary'],partial?[]:['workspace','approvals_required','daily_summary'],'config');
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
    const reason=overrides.exempt.length ? nonempty(overrides.reason,'approvals_overrides.reason') : (overrides.reason===undefined ? '' : nonempty(overrides.reason,'approvals_overrides.reason'));
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
  const file=path.join(root,'config','workspace-config.yaml');
  const actual=fs.realpathSync(file);
  if(!actual.startsWith(root+path.sep) || !fs.statSync(actual).isFile()) {
    throw new Error('Workspace config must be a regular file inside the repository');
  }
  if(fs.realpathSync(worktreeRoot)!==root) {
    throw new Error('Linked worktree overrides are implemented in TASK-005');
  }
  const config=parseWorkspaceConfig(fs.readFileSync(actual,'utf8'));
  const sources={};
  for(const [section,entries] of Object.entries(config)) {
    for(const key of Object.keys(entries)) sources[`${section}.${key}`]='root';
  }
  return {config,sources};
}
