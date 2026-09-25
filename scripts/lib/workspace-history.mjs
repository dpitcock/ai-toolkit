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

export function readWorkspaceHistory(root) {
  const file=historyPath(root);
  if(!file || !fs.existsSync(file)) return [];
  const text=fs.readFileSync(file,'utf8');
  if(!text) return [];
  if(!text.endsWith('\n')) throw new Error('Workspace history has an incomplete record');
  const records=text.trimEnd().split('\n').map((line,index)=>{
    try { return validRecord(JSON.parse(line)); }
    catch(error) { throw new Error(`Workspace history line ${index+1}: ${error.message}`); }
  });
  return validateHistory(records);
}

export function withWorkspaceHistoryLock(root,callback) {
  const file=historyPath(root,{createDirectory:true});
  const lock=`${file}.lock`;
  let descriptor;
  for(let attempt=0;attempt<100;attempt+=1) {
    try {
      descriptor=fs.openSync(lock,'wx',0o600);
      fs.writeFileSync(descriptor,JSON.stringify({pid:process.pid}),{encoding:'utf8'});
      break;
    }
    catch(error) {
      if(error.code!=='EEXIST' || attempt===99) throw error;
      const stat=fs.lstatSync(lock);
      if(stat.isSymbolicLink() || !stat.isFile() || stat.size>1024) throw new Error('Workspace history lock must be a regular file');
      if(stat.size===0) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);continue; }
      let owner;
      try { owner=JSON.parse(fs.readFileSync(lock,'utf8')); } catch { throw new Error('Workspace history lock is malformed'); }
      if(!Number.isInteger(owner?.pid) || owner.pid<1) throw new Error('Workspace history lock is malformed');
      try { process.kill(owner.pid,0); }
      catch(ownerError) {
        if(ownerError.code==='ESRCH') { fs.unlinkSync(lock);continue; }
        if(ownerError.code!=='EPERM') throw ownerError;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
    }
  }
  try {
    const records=readWorkspaceHistory(root);
    return callback({records,append(record){
      validRecord(record);validateHistory([...records,record]);
      fs.writeFileSync(file,`${JSON.stringify(record)}\n`,{flag:'a',mode:0o600});records.push(record);
    }});
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
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
