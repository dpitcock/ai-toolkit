import fs from 'node:fs';
import path from 'node:path';
import fsExt from 'fs-ext';
import {workspaceConfigDigest,workspaceTierDefinition} from './workspace-config.mjs';
import {workspaceHistoryValidation} from './workspace-history-validation.mjs';

const {validRecord,validateHistory,parseWorkspaceHistory,assertAcceptedHistory}=
  workspaceHistoryValidation({workspaceConfigDigest,workspaceTierDefinition});
export {parseWorkspaceHistory};

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
  return assertAcceptedHistory(readWorkspaceHistory(root),config);
}
