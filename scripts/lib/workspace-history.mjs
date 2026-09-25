import fs from 'node:fs';
import path from 'node:path';
import fsExt from 'fs-ext';
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

function validateHistory(records) {
  if(!records.length) return records;
  const first=records[0];
  if(first.kind!=='proposal' || first.revision!==1) throw new Error('Workspace history requires an initial proposal at revision 1');
  if(workspaceConfigDigest(first.config)!==first.digest) throw new Error('Workspace history proposal digest does not match its snapshot');
  for(let index=1;index<records.length;index+=1) {
    const previous=records[index-1],record=records[index];
    if(record.kind==='acceptance') {
      if(previous.kind!=='proposal' || record.revision!==previous.revision) throw new Error('Workspace history acceptance must match the pending proposal revision');
    } else if(record.kind==='change') {
      if(!['acceptance','change'].includes(previous.kind) || record.revision!==previous.revision+1) throw new Error('Workspace history change must follow accepted policy at the next revision');
    } else throw new Error('Workspace history cannot contain a later proposal');
  }
  return records;
}

export function parseWorkspaceHistory(text) {
  if(typeof text!=='string') throw new Error('Workspace history must be text');
  if(!text) return [];
  if(!text.endsWith('\n')) throw new Error('Workspace history has an incomplete record');
  const records=text.trimEnd().split('\n').map((line,index)=>{
    try { return validRecord(JSON.parse(line)); }
    catch(error) { throw new Error(`Workspace history line ${index+1}: ${error.message}`); }
  });
  return validateHistory(records);
}

export function readWorkspaceHistory(root) {
  const file=historyPath(root);
  if(!file || !fs.existsSync(file)) return [];
  return parseWorkspaceHistory(fs.readFileSync(file,'utf8'));
}

function sameFile(left,right) { return left.dev===right.dev && left.ino===right.ino; }
function acquireHistoryLock(root) {
  const file=historyPath(root,{createDirectory:true}),lock=`${file}.lock`;
  const descriptor=fs.openSync(lock,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600);
  try {
    const opened=fs.fstatSync(descriptor),named=fs.lstatSync(lock);
    if(!opened.isFile() || opened.nlink!==1 || named.isSymbolicLink() || !named.isFile() || !sameFile(opened,named)) {
      throw new Error('Workspace history lock must be a root-local regular file');
    }
    fsExt.flockSync(descriptor,'ex');
    const current=fs.lstatSync(lock);
    if(current.isSymbolicLink() || !current.isFile() || !sameFile(opened,current)) {
      throw new Error('Workspace history lock changed during acquisition');
    }
    return {descriptor,file};
  } catch(error) { fs.closeSync(descriptor);throw error; }
}
function releaseHistoryLock(lock) {
  try { fsExt.flockSync(lock.descriptor,'un'); } finally { fs.closeSync(lock.descriptor); }
}

export function withWorkspaceHistoryLocks(roots,callback,{beforeRead}={}) {
  const ordered=[...new Set(roots.map(root=>fs.realpathSync(root)))].sort();
  const locks=[];
  try {
    for(const root of ordered) locks.push(acquireHistoryLock(root));
    beforeRead?.();
    const primary=fs.realpathSync(roots[0]);
    const file=historyPath(primary,{createDirectory:true}),records=readWorkspaceHistory(primary);
    return callback({records,append(record){
      validRecord(record);validateHistory([...records,record]);
      const descriptor=fs.openSync(file,'a',0o600);
      try {
        fs.writeFileSync(descriptor,`${JSON.stringify(record)}\n`,'utf8');
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      records.push(record);
    }});
  } finally {
    for(const lock of locks.reverse()) releaseHistoryLock(lock);
  }
}

export function withWorkspaceHistoryLock(root,callback,options={}) {
  return withWorkspaceHistoryLocks([root],callback,options);
}

export function appendWorkspaceHistory(root,record) {
  return withWorkspaceHistoryLock(root,({append})=>append(record));
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
