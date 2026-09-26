import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fsExt from 'fs-ext';
import {validateAdoptionRecord} from './policy-adoption-record.mjs';

const STATE_FILE='workflow-state.json';
const VERSION=1;
const COLLECTIONS=['authorizations','dispatches','reviews','epics'];

function fail(message) { throw new Error(`Workflow state ${message}`); }
function initialState() { return {version:VERSION,authorizations:{},dispatches:{},reviews:{},epics:{}}; }
function isObject(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function sameFile(left,right) { return left.dev===right.dev && left.ino===right.ino; }

function commonDirectory(root) {
 const directory=execFileSync('git',['-C',root,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim();
 if(!directory) fail('could not resolve the Git common directory');
 return fs.realpathSync(directory);
}

export function workflowStatePath(root) { return path.join(commonDirectory(root),STATE_FILE); }

function validate(state) {
 if(!isObject(state)) fail('must be an object');
 if(state.version!==VERSION) fail(`version must be ${VERSION}`);
 const keys=Object.keys(state).sort(),expected=['version',...COLLECTIONS].sort();
 if(keys.length!==expected.length || keys.some((key,index)=>key!==expected[index])) fail('has an unexpected schema');
 for(const name of COLLECTIONS) {
  if(!isObject(state[name])) fail(`${name} records must be an object`);
 }
 for(const [epic,record] of Object.entries(state.epics)) if(record?.policyAdoption!==undefined) {
  if(epic!=='EPIC-006') fail('policy adoption is restricted to EPIC-006');
  validateAdoptionRecord(record.policyAdoption);
 }
 return state;
}

function lstatRegular(file,label) {
 let stat;
 try { stat=fs.lstatSync(file); } catch(error) { if(error.code==='ENOENT') return null;throw error; }
 if(stat.isSymbolicLink() || !stat.isFile() || stat.nlink!==1) fail(`${label} must be a regular file, not a symbolic link`);
 return stat;
}

function readFile(file) {
 const named=lstatRegular(file,'file');
 if(!named) return initialState();
 let descriptor;
 try {
  descriptor=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const opened=fs.fstatSync(descriptor),current=lstatRegular(file,'file');
  if(!opened.isFile() || opened.nlink!==1 || !current || !sameFile(opened,current)) fail('file changed during read');
  const text=fs.readFileSync(descriptor,'utf8');
  try { return validate(JSON.parse(text)); } catch(error) {
   if(error.message.startsWith('Workflow state ')) throw error;
   fail(`is malformed: ${error.message}`);
  }
 } finally { if(descriptor!==undefined) fs.closeSync(descriptor); }
}

export function readWorkflowState(root) { return readFile(workflowStatePath(root)); }

function acquireLock(file) {
 const lock=`${file}.lock`;
 let descriptor;
 try { descriptor=fs.openSync(lock,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600); }
 catch(error) { fail(`lock cannot be opened safely: ${error.message}`); }
 try {
  const opened=fs.fstatSync(descriptor),named=lstatRegular(lock,'lock');
  if(!named || !opened.isFile() || opened.nlink!==1 || !sameFile(opened,named)) fail('lock changed during acquisition');
  fsExt.flockSync(descriptor,'ex');
  const current=lstatRegular(lock,'lock');
  if(!current || !sameFile(opened,current)) fail('lock changed during acquisition');
  return descriptor;
 } catch(error) { fs.closeSync(descriptor);throw error; }
}

function writeAtomically(file,state) {
 const previous=lstatRegular(file,'file');
 const temporary=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
 let descriptor;
 try {
  descriptor=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  fs.writeFileSync(descriptor,`${JSON.stringify(state)}\n`,'utf8');fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;
  const current=lstatRegular(file,'file');
  if((previous===null)!==(current===null) || (previous && !sameFile(previous,current))) fail('file changed during mutation');
  fs.renameSync(temporary,file);
  const directory=fs.openSync(path.dirname(file),fs.constants.O_RDONLY);
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
 } catch(error) {
  if(descriptor!==undefined) fs.closeSync(descriptor);
  try { fs.unlinkSync(temporary); } catch(unlinkError) { if(unlinkError.code!=='ENOENT') throw unlinkError; }
  throw error;
 }
}

export function withWorkflowState(root,mutate) {
 if(typeof mutate!=='function') fail('mutation must be a function');
 const file=workflowStatePath(root),lock=acquireLock(file);
 try {
  const state=readFile(file);
  const result=mutate(state);
  if(result && typeof result.then==='function') fail('mutation must be synchronous');
  validate(state);writeAtomically(file,state);
  return result;
 } finally {
  try { fsExt.flockSync(lock,'un'); } finally { fs.closeSync(lock); }
 }
}
