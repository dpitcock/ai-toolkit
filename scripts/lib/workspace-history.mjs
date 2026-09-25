import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
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

function syncDirectory(directory) { const fd=fs.openSync(directory,'r');try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function pauseForTest(checkpoint) { if(process.env.WORKSPACE_INIT_TEST_PAUSE_AFTER===checkpoint) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60_000); }
function lockStat(file,links) {
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink() || !stat.isFile() || stat.nlink!==links) throw new Error('Workspace history lock is malformed');
  return stat;
}
function sameFile(left,right) { return left.dev===right.dev && left.ino===right.ino; }
function fixedChanged(lock,fixed) {
  try { return !sameFile(fixed,lockStat(lock,2)); }
  catch { return true; }
}
function ownerFor(lock) {
  const directory=path.dirname(lock),prefix=`${path.basename(lock)}.`;
  let fixed;
  try { fixed=lockStat(lock,2); } catch { return null; }
  const names=fs.readdirSync(directory).filter(name=>name.startsWith(prefix) && name.endsWith('.owner'));
  const owners=names.map(name=>path.join(directory,name)).filter(file=>{ try { return sameFile(fixed,lockStat(file,2)); } catch { return false; } });
  if(owners.length!==1) {
    if(fixedChanged(lock,fixed)) return null;
    throw new Error('Workspace history lock is malformed');
  }
  let owner;
  try { owner=JSON.parse(fs.readFileSync(owners[0],'utf8')); }
  catch(error) { if(error.code==='ENOENT') return null;throw new Error('Workspace history lock is malformed'); }
  if(!Number.isInteger(owner?.pid) || owner.pid<1 || !/^[a-f0-9]{32}$/.test(owner?.nonce ?? '')) throw new Error('Workspace history lock is malformed');
  try {
    if(!sameFile(fixed,lockStat(lock,2)) || !sameFile(fixed,lockStat(owners[0],2))) return null;
  } catch(error) { if(error.code==='ENOENT' || fixedChanged(lock,fixed)) return null;throw error; }
  let ownerStat;
  try { ownerStat=lockStat(owners[0],2); }
  catch(error) {
    if(fixedChanged(lock,fixed)) return null;
    throw error;
  }
  return {file:owners[0],owner,fixed,ownerStat};
}
function releaseLock(lock,held) {
  const fixed=lockStat(lock,2),owned=lockStat(held.file,2);
  if(!sameFile(fixed,owned) || !sameFile(held.ownerStat,owned)) throw new Error('Workspace history lock changed during cleanup');
  fs.unlinkSync(lock);syncDirectory(path.dirname(lock));
  pauseForTest('lock-fixed-unlinked');
  const soleOwner=lockStat(held.file,1);
  if(!sameFile(held.ownerStat,soleOwner)) throw new Error('Workspace history lock changed during cleanup');
  fs.unlinkSync(held.file);syncDirectory(path.dirname(lock));
}

export function withWorkspaceHistoryLock(root,callback,{beforeRead}={}) {
  const file=historyPath(root,{createDirectory:true}),lock=`${file}.lock`;
  let ownerFile,heldLock;
  for(let attempt=0;attempt<100;attempt+=1) {
    const nonce=randomBytes(16).toString('hex');ownerFile=`${lock}.${process.pid}.${nonce}.owner`;
    try {
      const fd=fs.openSync(ownerFile,'wx',0o600);try { fs.writeFileSync(fd,JSON.stringify({pid:process.pid,nonce}));fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.linkSync(ownerFile,lock);syncDirectory(path.dirname(lock));
      heldLock=ownerFor(lock);
      if(!heldLock || heldLock.file!==ownerFile || heldLock.owner.pid!==process.pid || heldLock.owner.nonce!==nonce) {
        throw new Error('Workspace history lock changed during acquisition');
      }
      break;
    } catch(error) {
      if(fs.existsSync(ownerFile) && fs.lstatSync(ownerFile).nlink===1) fs.unlinkSync(ownerFile);
      if(error.code!=='EEXIST' || attempt===99) throw error;
      const held=ownerFor(lock);
      if(!held) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);continue; }
      try { process.kill(held.owner.pid,0); }
      catch(ownerError) { if(ownerError.code==='ESRCH') { releaseLock(lock,held);continue; } if(ownerError.code!=='EPERM') throw ownerError; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
    }
  }
  try {
    beforeRead?.();
    const records=readWorkspaceHistory(root);
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
    releaseLock(lock,heldLock);
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
