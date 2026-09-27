import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readDocument} from '../check-gate.mjs';
import {admitEpic} from './epic-completion.mjs';
import {withWorkflowState} from './workflow-state.mjs';

function fail(message) { throw new Error(`Epic admission ${message}`); }
function git(root,args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }

// Called under the common-directory workflow lock, including before provisioning.
// Missing runtime records never erase the existence of canonical older epics.
export function validateEpicAdmission({root,epic,state,observeIntegration}={}) {
 if(!/^EPIC-\d+$/.test(epic??'')) fail('epic ID is malformed');
 const worktrees=git(root,['worktree','list','--porcelain']).split('\n').filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
 if(!worktrees.includes(fs.realpathSync(root))) fail('root is not a registered checkout');
 const prior=new Map();
 for(const branch of git(root,['for-each-ref','--format=%(refname:short)','refs/heads/epic/']).split('\n')) {
  const id=branch.match(/^epic\/(EPIC-\d+)$/)?.[1];
  if(id && id!==epic) prior.set(id,true);
 }
 for(const worktree of worktrees) {
  const directory=path.join(worktree,'epics');
  if(!fs.existsSync(directory)) continue;
  for(const name of fs.readdirSync(directory)) {
   if(!/^EPIC-\d+$/.test(name) || name===epic) continue;
   const file=path.join(directory,name,'epic.md');
   if(!fs.existsSync(file)) fail(`predecessor ${name} has missing canonical evidence`);
   if(!fs.realpathSync(file).startsWith(`${worktree}${path.sep}`)) fail('predecessor escapes checkout');
   const {data}=readDocument(file);
   if(data.id!==name || data.kind!=='epic' || data.status!=='merged') fail(`predecessor ${name} is incomplete`);
   prior.set(name,true);
  }
 }
 const activeEpics=Object.entries(state.epics).filter(([id,value])=>id!==epic && (value.active===true || value.provisioning===true)).map(([id])=>id);
 if(activeEpics.length) fail('another epic remains active');
 for(const [id,record] of Object.entries(state.epics)) if(id!==epic) {
  if(!/^EPIC-\d+$/.test(id) || (!record.completed && !record.historicalBaseline)) fail(`predecessor ${id} is incomplete`);
  prior.set(id,true);
 }
 if(!prior.size) return {admitted:true,epic,firstProject:true};
 const latest=[...prior.keys()].sort((a,b)=>Number(a.slice(5))-Number(b.slice(5))).at(-1),record=state.epics[latest];
 if(!record) fail(`predecessor ${latest} completion is missing; explicit recovery required`);
 if(record.historicalBaseline) {
  if(record.historicalBaseline.epic!==latest) fail('historical baseline names another predecessor');
  return admitEpic({historical:true,historicalBaseline:record.historicalBaseline,activeEpics},{id:epic});
 }
 if(!record.completed || !record.completion?.receipt) fail(`predecessor ${latest} completion is missing`);
 if(typeof observeIntegration!=='function') fail('fresh trusted integration observation is required');
 const receipt=record.completion.receipt;
 const origin=git(root,['remote','get-url','origin']);
 const match=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
 if(match?.[1]!==receipt.repository || receipt.epic!==latest) fail('completion repository or epic does not match canonical checkout');
 const hostObservation=observeIntegration(receipt);
 if(hostObservation && typeof hostObservation.then==='function') fail('integration observer must be synchronous');
 return admitEpic({completion:receipt,activeEpics,hostObservation},{id:epic});
}

export function reserveEpicProvisioning({root,epic,observeIntegration}={}) {
 return withWorkflowState(root,state=>{
  if(state.epics[epic]) fail('epic already has runtime state; reconcile provisioning before retry');
  const result=validateEpicAdmission({root,epic,state,observeIntegration});
  state.epics[epic]={provisioning:true};
  return result;
 });
}
