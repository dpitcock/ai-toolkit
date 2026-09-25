import fs from 'node:fs';
import path from 'node:path';
import {workspaceConfigDigest} from './workspace-config.mjs';

function historyPath(root,{createDirectory=false}={}) {
  const base=fs.realpathSync(root);
  const directory=path.join(base,'project');
  if(createDirectory) fs.mkdirSync(directory,{recursive:true});
  if(!fs.existsSync(directory)) return null;
  const actualDirectory=fs.realpathSync(directory);
  if(!actualDirectory.startsWith(base+path.sep)) {
    throw new Error('Workspace history must stay inside the repository');
  }
  const file=path.join(actualDirectory,'workspace-config-history.jsonl');
  let stat;
  try { stat=fs.lstatSync(file); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  if(stat && (stat.isSymbolicLink() || !stat.isFile())) {
    throw new Error('Workspace history must be a regular file');
  }
  return file;
}

function meaningful(value) {
  return typeof value==='string' && value.trim().length>0;
}

function validRecord(record) {
  if(!record || typeof record!=='object' || Array.isArray(record)) {
    throw new Error('Malformed workspace history record');
  }
  if(!['proposal','acceptance','change'].includes(record.kind)) {
    throw new Error('Unknown workspace history record kind');
  }
  if(!/^[a-f0-9]{64}$/.test(record.digest)) throw new Error('Malformed workspace history digest');
  if(!Number.isInteger(record.revision) || record.revision<1) {
    throw new Error('Malformed workspace history revision');
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || Number.isNaN(Date.parse(record.date))) {
    throw new Error('Malformed workspace history date');
  }
  if(record.kind==='proposal') {
    if(!record.config || !record.reasons || typeof record.reasons!=='object') {
      throw new Error('Malformed workspace proposal');
    }
  } else if(!meaningful(record.by) || !meaningful(record.reason) || !Array.isArray(record.changes)) {
    throw new Error('Malformed workspace acceptance');
  }
  return record;
}

export function readWorkspaceHistory(root) {
  const file=historyPath(root);
  if(!file || !fs.existsSync(file)) return [];
  const text=fs.readFileSync(file,'utf8');
  if(!text) return [];
  if(!text.endsWith('\n')) throw new Error('Workspace history has an incomplete record');
  return text.trimEnd().split('\n').map((line,index)=>{
    try { return validRecord(JSON.parse(line)); }
    catch(error) { throw new Error(`Workspace history line ${index+1}: ${error.message}`); }
  });
}

export function appendWorkspaceHistory(root,record) {
  validRecord(record);
  const file=historyPath(root,{createDirectory:true});
  const lock=`${file}.lock`;
  const descriptor=fs.openSync(lock,'wx',0o600);
  try {
    readWorkspaceHistory(root);
    fs.writeFileSync(file,`${JSON.stringify(record)}\n`,{flag:'a',mode:0o600});
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

export function assertAcceptedWorkspaceConfig(root,config) {
  const latest=readWorkspaceHistory(root).at(-1);
  if(!latest || !['acceptance','change'].includes(latest.kind)) {
    throw new Error('Workspace configuration is pending human acceptance');
  }
  if(latest.digest!==workspaceConfigDigest(config)) {
    throw new Error('Workspace configuration changed after acceptance');
  }
  return latest;
}
