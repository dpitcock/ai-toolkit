import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {acceptedPolicy,trustedActor} from './workflow-context.mjs';
import {decideAction} from './workflow-authorization.mjs';
import {withWorkflowState} from './workflow-state.mjs';
import {localSnapshot,githubJSON} from './epic-finalization.mjs';
import {assertActivationSnapshot,ACTIVATION_PATHS} from './activation-history.mjs';
import {proveReleaseVerification} from './release-verification-proof.mjs';
import {validateReleaseRecord,releaseFailure as fail} from './release-verification-record.mjs';

const EPIC='EPIC-006',REPOSITORY='dpitcock/ai-toolkit',BRANCH='epic/EPIC-006';
const POLICY=['config/workspace-config.yaml','project/workspace-config-history.jsonl'];
function git(root,args) {const output=execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:'pipe',maxBuffer:16*1024*1024});return args.includes('-z')?output:output.trim();}
function hash(text) {return createHash('sha256').update(text).digest('hex');}
function blob(text) {return createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');}
function observed(observers,name,context) {
 if(typeof observers?.[name]!=='function') fail(`trusted ${name} observation required`);
 const value=observers[name](structuredClone(context));if(value?.then) fail('observations must be synchronous under the lock');return value;
}
function regular(root,name,max=1024*1024) {
 const file=path.join(root,name),stat=fs.lstatSync(file);
 if(!stat.isFile() || stat.isSymbolicLink() || stat.mode&0o111 || stat.nlink!==1 || stat.size>max || !fs.realpathSync(file).startsWith(`${root}${path.sep}`)) fail('release files must be bounded regular non-executable files');
 return fs.readFileSync(file,'utf8');
}
function snapshot(root,record,{dirty=false}={}) {
 const head=git(root,['rev-parse','HEAD']),base=record.adoption.adoption.integrationSha;
 const tracked=git(root,['diff','--name-only','-z','HEAD']).split('\0').filter(Boolean),untracked=git(root,['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
 const names=[...new Set([...tracked,...untracked])];
 if(!dirty && names.length) fail('operation requires a clean checkout');
 if(names.some(name=>!ACTIVATION_PATHS.includes(name))) fail('working diff has unauthorized paths');
 const after=localSnapshot(root,head),bytes=new Map(),blobs={};
 for(const name of ACTIVATION_PATHS) {
  const text=regular(root,name,name.startsWith('project/')?32768:1024*1024);bytes.set(name,text);blobs[name]=blob(text);after.tree.set(name,{mode:'100644',type:'blob',sha:blobs[name]});
 }
 after.read=name=>bytes.has(name)?bytes.get(name):localSnapshot(root,head).read(name);
 assertActivationSnapshot({before:localSnapshot(root,base),after,base,digest:record.adoption.policy.canonical.digest});
 if(dirty && !names.length) fail('commit requires a nonempty evidence change');
 const index=git(root,['diff','--cached','--raw','--no-renames','HEAD']);
 const staged=git(root,['diff','--cached','--name-only','--no-renames','-z','HEAD']).split('\0').filter(Boolean);
 if(staged.some(name=>!ACTIVATION_PATHS.includes(name))) fail('index contains unauthorized staged paths');
 if(staged.length) for(const name of ACTIVATION_PATHS) {
  if(git(root,['ls-files','--stage','--',name])!==`100644 ${blobs[name]} 0\t${name}`) fail('index must match the complete evidence snapshot');
 }
 return {head,blobs,fingerprint:hash(JSON.stringify({head,names,index,blobs}))};
}
function mirrors(resolved,i) {
 const base=localSnapshot(resolved.worktree,i);
 for(const name of POLICY) if(regular(resolved.worktree,name)!==base.read(name) || regular(resolved.coordinationRoot,name)!==base.read(name)) fail('root/worktree policy history must exactly mirror I');
}
function revalidate(resolved,record,observers,current,{dirty=false}={}) {
 const i=record.adoption.adoption.integrationSha,api=observers?.api??githubJSON;
 if(api(`repos/${REPOSITORY}/git/ref/heads/main`)?.object?.sha!==i) fail('current main changed during effect observation');
 mirrors(resolved,i);
 const fresh=acceptedPolicy(resolved.worktree);
 if(fresh.branch!==BRANCH || fresh.repository!==resolved.repository || !equal(fresh.policy.provenance,resolved.policy.provenance)) fail('registered branch or policy changed during observation');
 if(snapshot(resolved.worktree,record,{dirty}).fingerprint!==current.fingerprint) fail('snapshot changed during effect observation');
}
function context(state,resolved,actor,observers,{empty=false}={}) {
 const {worktree:root,coordinationRoot,repository,branch,policy}=resolved;
 if(root===coordinationRoot || repository!==REPOSITORY || branch!==BRANCH) fail('requires the registered isolated EPIC-006 worktree');
 const adopted=state.epics[EPIC]?.policyAdoption;
 if(adopted?.phase!=='integrated') fail('verified adoption runtime is required');
 const i=adopted.proof.adoption.integrationSha,digest=adopted.proof.policy.canonical.digest;
 if(policy.provenance.digest!==digest || policy.provenance.rootAcceptance!==`workspace:3:${digest}` || policy.provenance.worktreeAcceptance!==`workspace:3:${digest}`) fail('exact accepted canonical policy mirrors are required');
 mirrors(resolved,i);
 const loaded=observed(observers,'activation',{epic:EPIC,base:i});
 if(loaded?.source!=='session-harness' || loaded.sessionId!==actor.harness.sessionId || loaded.loadedRevision!==i || loaded.policyDigest!==digest || !Number.isFinite(Date.parse(loaded.observedAt))) fail('observed loaded integrated adapter required');
 const head=git(root,['rev-parse','HEAD']);
 const proof=proveReleaseVerification({root,baseSha:i,headSha:head,headRef:branch,api:observers?.api,empty});
 if(!equal(proof.adoption,adopted.proof)) fail('runtime adoption differs from live historical chain');
 mirrors(resolved,i);
 return {head,loaded,proof};
}
function authorize(state,resolved,actor,record,type='release.verify') {
 const permit=state.authorizations[record.authorizationId];
 // The original criterion is captured in the immutable delivery input, not report data.
 const event=Object.values(state.dispatches).find(item=>item.event.type==='release.verify' && item.event.operation==='prepare' && item.event.authorizationId===record.authorizationId)?.event;
 if(!event) fail('prepared authority delivery is missing');
 const decision=decideAction({authorization:permit,policy:resolved.policy,actor,action:{repository:resolved.repository,branch:resolved.branch,scope:`epics/${EPIC}`,name:type,completionCriterion:event.completionCriterion}});
 if(decision.decision!=='continue' || decision.reason!=='authorized-routine') fail(`current routine authorization required: ${decision.reason}`);
}

/** Called only after ordinary event authorization, within its existing state lock. */
export function applyReleaseVerification(state,input,resolved,actor,observers) {
 if(input.epic!==EPIC) fail('event is limited to EPIC-006');
 const {head,loaded,proof}=context(state,resolved,actor,observers,{empty:input.operation==='prepare' || git(resolved.worktree,['rev-parse','HEAD'])===state.epics[EPIC]?.policyAdoption?.proof.adoption.integrationSha});
 let record=state.epics[EPIC].releaseVerification;
 if(!record) {
  if(input.operation!=='prepare' || head!==proof.release.base || git(resolved.worktree,['status','--porcelain'])) fail('first prepare requires clean verified I');
  record={version:1,id:'activation-evidence',phase:'prepared',adoption:proof.adoption,head,developer:actor.harness.identity,developerSession:actor.harness.sessionId,authorizationId:input.authorizationId,loaded,
   actions:{},localReviews:[],localReady:false,hostReady:false,publishedPr:null,qa:null,correction:null,proof:null};
  state.epics[EPIC].releaseVerification=record;
 }
 validateReleaseRecord(record);
 if(record.phase==='integrated' || record.authorizationId!==input.authorizationId || record.developer!==actor.harness.identity || record.developerSession!==actor.harness.sessionId) fail('release identity or authority differs');
 if(input.operation==='prepare') return {phase:record.phase,operation:'prepare',actionable:false};
 const prior=record.actions[input.id];
 if(prior && ['acknowledged','reconciled'].includes(prior.status)) return {phase:record.phase,operation:prior.operation,actionable:false,effect:structuredClone(prior)};
 const current=snapshot(resolved.worktree,record,{dirty:input.operation==='commit'});
 if(prior) {
  if(prior.operation!==input.operation || prior.beforeHead!==head || prior.snapshot!==current.fingerprint) fail('delayed decision state changed');
  return {phase:record.phase,operation:prior.operation,actionable:false,effect:structuredClone(prior)};
 }
 if(Object.values(record.actions).some(item=>['authorized','dispatched','uncertain'].includes(item.status))) fail('prior action requires acknowledgement or reconciliation');
 if(current.head!==record.head) fail('unacknowledged head change requires reconciliation');
 if(record.publishedPr!==null && input.operation==='commit' && !record.correction) fail('published evidence correction requires an independent request');
 const effect={id:input.id,operation:input.operation,status:'authorized',beforeHead:head,snapshot:current.fingerprint,blobs:current.blobs,receipt:null};
 record.actions[input.id]=effect;record.phase='active';
 return {phase:record.phase,operation:input.operation,actionable:false,effect:structuredClone(effect)};
}

/** Harness effect boundary: dispatch revalidates the exact decision immediately
 * before execution; ack/reconcile observe effects. No method executes commands,
 * pushes, grants tool permissions or writes to the coordination checkout.
 */
export function controlReleaseVerification({root,operation,deliveryId,actor,observers}={}) {
 trustedActor(actor);root=fs.realpathSync(root);
 return withWorkflowState(root,state=>{
  const resolved=acceptedPolicy(root);
  const record=state.epics[EPIC]?.releaseVerification;if(!record) fail('runtime release record is missing');
  validateReleaseRecord(record);authorize(state,resolved,actor,record);
  const effect=record.actions[deliveryId];if(!effect) fail('authorized effect delivery is absent');
  context(state,resolved,actor,observers,{empty:git(root,['rev-parse','HEAD'])===record.adoption.adoption.integrationSha});
  if(actor.harness.identity!==record.developer || actor.harness.sessionId!==record.developerSession) fail('effect actor differs from prepared developer');
  if(operation==='dispatch') {
   if(effect.status!=='authorized') fail('effect replay is forbidden; dispatched or uncertain work requires reconciliation');
   const current=snapshot(root,record,{dirty:effect.operation==='commit'});
   if(effect.beforeHead!==current.head || effect.snapshot!==current.fingerprint) fail('delayed decision head/diff changed');
   revalidate(resolved,record,observers,current,{dirty:effect.operation==='commit'});
   effect.status='dispatched';return {actionable:true,effect:structuredClone(effect)};
  }
  if(operation==='uncertain') {
   if(effect.status!=='dispatched') fail('only a dispatched effect can become uncertain');
   effect.status='uncertain';return {actionable:false,effect:structuredClone(effect)};
  }
  if(!['ack','reconcile'].includes(operation) || effect.status!==(operation==='ack'?'dispatched':'uncertain')) fail('effect acknowledgement or reconciliation state invalid');
  const current=snapshot(root,record),receipt=observed(observers,'effect',effect);
  if(receipt?.head!==current.head || receipt.result!=='succeeded' || typeof receipt.operationId!=='string' || !receipt.operationId.trim() || !Number.isFinite(Date.parse(receipt.observedAt))) fail('actual effect observation is incomplete');
  if(effect.operation==='commit') {
   if(git(root,['show','-s','--format=%P',current.head])!==effect.beforeHead || !equal(current.blobs,effect.blobs) || current.head===effect.beforeHead) fail('actual commit does not match authorized snapshot');
   record.head=current.head;record.localReady=false;record.hostReady=false;record.localReviews=[];record.phase='active';
  } else if(current.head!==effect.beforeHead || receipt.remoteHead!==current.head) fail('actual successful push observation differs');
  revalidate(resolved,record,observers,current);
  effect.receipt=receipt;effect.status=operation==='ack'?'acknowledged':'reconciled';
  validateReleaseRecord(record);return {actionable:false,effect:structuredClone(effect)};
 });
}
