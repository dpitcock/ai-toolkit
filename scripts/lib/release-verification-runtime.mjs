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
import {proveReleaseVerification,evaluateReleaseHostGate,evaluateReleaseCompletionGate,materializeReleaseHistory} from './release-verification-proof.mjs';
import {validateReleaseRecord,exactReleaseKeys,releaseFailure as fail} from './release-verification-record.mjs';
import {readyReleaseReviews,controlReleaseReviews,invalidateReleaseReviews,assertEvidenceCorrection,observeReleasePull,assertLocalReleaseGate,assertReleaseReviewState} from './release-verification-reviews.mjs';
import {evaluateCompletion,admitEpic} from './epic-completion.mjs';

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
function revalidate(resolved,record,observers,current,{dirty=false,integration}={}) {
 const i=record.adoption.adoption.integrationSha,api=observers?.api??githubJSON;
 if(api(`repos/${REPOSITORY}/git/ref/heads/main`)?.object?.sha!==(integration?.sha??i)) fail('current main changed during effect observation');
 mirrors(resolved,i);
 publicationBinding(record,current.head,api);
 const fresh=acceptedPolicy(resolved.worktree);
 if(fresh.branch!==BRANCH || fresh.repository!==resolved.repository || !equal(fresh.policy.provenance,resolved.policy.provenance)) fail('registered branch or policy changed during observation');
 if(snapshot(resolved.worktree,record,{dirty}).fingerprint!==current.fingerprint) fail('snapshot changed during effect observation');
}
function exactPublishedHead(record,observers) {
 if(record.publishedPr!==null && (observers?.api??githubJSON)(`repos/${REPOSITORY}/pulls/${record.publishedPr}`)?.head?.sha!==record.head) fail('readiness requires current published PR2 head');
}
function publicationBinding(record,head,api) {
 if(record?.publishedPr===null || record?.publishedPr===undefined) return undefined;
 const remote=api(`repos/${REPOSITORY}/pulls/${record.publishedPr}`)?.head?.sha;
 const pushed=Object.values(record.actions).filter(item=>item.operation==='push' && ['acknowledged','reconciled'].includes(item.status)).sort((a,b)=>a.sequence-b.sequence).at(-1)?.receipt.head;
 const advancing=Object.values(record.actions).some(item=>item.operation==='push' && ['dispatched','uncertain'].includes(item.status) && item.beforeHead===head);
 if(remote!==pushed && !(advancing && remote===head)) fail('PR2 remote head differs from acknowledged push or current dispatched push');
 return {pr:record.publishedPr,head:remote};
}
function context(state,resolved,actor,observers,{empty=false,integration}={}) {
 const {worktree:root,coordinationRoot,repository,branch,policy}=resolved;
 if(root===coordinationRoot || repository!==REPOSITORY || branch!==BRANCH) fail('requires the registered isolated EPIC-006 worktree');
 const adopted=state.epics[EPIC]?.policyAdoption;
 if(adopted?.phase!=='integrated') fail('verified adoption runtime is required');
 const i=adopted.proof.adoption.integrationSha,digest=adopted.proof.policy.canonical.digest;
 if(policy.provenance.digest!==digest || policy.provenance.rootAcceptance!==`workspace:3:${digest}` || policy.provenance.worktreeAcceptance!==`workspace:3:${digest}`) fail('exact accepted canonical policy mirrors are required');
 mirrors(resolved,i);
 const loaded=observed(observers,'activation',{epic:EPIC,base:i});
 if(loaded?.source!=='session-harness' || loaded.sessionId!==actor.harness.sessionId || loaded.loadedRevision!==i || loaded.policyDigest!==digest || typeof loaded.observedAt!=='string' || !Number.isFinite(Date.parse(loaded.observedAt))) fail('observed loaded integrated adapter required');
 const head=git(root,['rev-parse','HEAD']);
 const record=state.epics[EPIC]?.releaseVerification;
 // The published PR2/H2 receipt remains a separate runtime binding after the
 // PR closes.  It cannot be passed into the pure integrated proof: that proof
 // deliberately permits no open PR publication alongside a merged J relation.
 const publication=integration?undefined:publicationBinding(record,head,observers?.api??githubJSON);
 if(integration) publicationBinding(record,head,observers?.api??githubJSON);
 const proof=proveReleaseVerification({root,baseSha:i,headSha:head,headRef:branch,api:observers?.api,empty,publication,integration});
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
   actions:{},assignments:[],localReviews:[],lastReview:null,localReady:false,hostReady:false,publishedPr:null,qa:null,correction:null,proof:null};
  state.epics[EPIC].releaseVerification=record;
 }
 validateReleaseRecord(record);
 assertReleaseReviewState(state,record);
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
 if(record.publishedPr!==null && input.operation==='commit') assertEvidenceCorrection(resolved.worktree,record);
 const sequence=Math.max(0,...Object.values(record.actions).map(item=>item.sequence))+1;
 const effect={id:input.id,sequence,operation:input.operation,status:'authorized',beforeHead:head,snapshot:current.fingerprint,blobs:current.blobs,receipt:null};
 record.actions[input.id]=effect;record.phase='active';
 return {phase:record.phase,operation:input.operation,actionable:false,effect:structuredClone(effect)};
}

/** Harness effect boundary: dispatch revalidates the exact decision immediately
 * before execution; ack/reconcile observe effects. No method executes commands,
 * pushes, grants tool permissions or writes to the coordination checkout.
 */
export function controlReleaseVerification({root,operation,deliveryId,claimId,actor,observers,integration}={}) {
 trustedActor(actor);root=fs.realpathSync(root);
 return withWorkflowState(root,state=>{
  const resolved=acceptedPolicy(root);
  const record=state.epics[EPIC]?.releaseVerification;if(!record) fail('runtime release record is missing');
  validateReleaseRecord(record);assertReleaseReviewState(state,record);
  const action=operation==='integrate'?'merge.eligible':['dispatch','ack','uncertain','reconcile'].includes(operation)?'release.verify':'review.ready';
  authorize(state,resolved,actor,record,action);
  if(operation==='integrate') {
   if(record.phase==='integrated') fail('release integration is already recorded');
   exactReleaseKeys(integration,['pr','sha']);
   if(!Number.isSafeInteger(integration.pr) || integration.pr!==record.publishedPr || typeof integration.sha!=='string' || !/^[a-f0-9]{40}$/.test(integration.sha)) fail('integration must name the current published PR2 and J');
   const current=snapshot(root,record);
   if(current.head!==record.head || Object.values(record.actions).some(item=>['authorized','dispatched','uncertain'].includes(item.status))) fail('unacknowledged head change or pending action prevents integration');
   assertLocalReleaseGate(state,record);
   if(!record.hostReady || !record.correction || record.correction.status!=='committed' || record.correction.correctedHead!==record.head) fail('integrated release requires current same-PR evidence correction');
   const publications=Object.values(state.reviews).filter(item=>item.pr===record.publishedPr && item.head===record.head && !item.invalidated);
   if(publications.length!==2 || publications.some(item=>!['acknowledged','reconciled'].includes(item.claim.status))) fail('integrated release requires current hosted publication acknowledgements');
   const qa=observed(observers,'mergeQA',{head:record.head,pr:record.publishedPr,correction:record.correction});
   exactReleaseKeys(qa,['head','pr','accepted','evidence','by','sessionId','observedAt']);
   if(qa.head!==record.head || qa.pr!==record.publishedPr || qa.accepted!==true || typeof qa.evidence!=='string' || !qa.evidence.trim() || qa.evidence.length>2048
    || typeof qa.by!=='string' || !qa.by.trim() || qa.by.trim().toLowerCase()===record.developer.trim().toLowerCase() || typeof qa.sessionId!=='string' || !qa.sessionId.trim() || qa.sessionId===record.developerSession
    || typeof qa.observedAt!=='string' || !Number.isFinite(Date.parse(qa.observedAt))) fail('current independent final merge QA acceptance required');
   materializeReleaseHistory({root,baseSha:record.adoption.adoption.integrationSha,headSha:record.head,integration,api:observers?.api});
   const {proof}=context(state,resolved,actor,observers,{integration});
   const hostEvidence=evaluateReleaseHostGate({root,baseSha:record.adoption.adoption.integrationSha,headSha:record.head,pr:record.publishedPr,integration,api:observers?.api});
   if(!equal(hostEvidence.releaseVerification,proof) || hostEvidence.releaseVerification.release.pr!==record.publishedPr || hostEvidence.releaseVerification.release.head!==record.head) fail('verified host relation differs from the current release runtime');
   revalidate(resolved,record,observers,current,{integration});context(state,resolved,actor,observers,{integration});
   authorize(state,resolved,actor,record,action);
   record.proof=hostEvidence.releaseVerification;record.phase='integrated';validateReleaseRecord(record);
   return {phase:record.phase,proof:structuredClone(record.proof),hostEvidence};
  }
  if(!['dispatch','ack','uncertain','reconcile'].includes(operation)) {
   context(state,resolved,actor,observers);const current=snapshot(root,record);
   exactPublishedHead(record,observers);
   if(current.head!==record.head) fail('unacknowledged head change requires reconciliation');
   if(Object.values(record.actions).some(item=>['authorized','dispatched','uncertain'].includes(item.status))) fail('pending effect requires acknowledgement or reconciliation');
   const result=controlReleaseReviews({state,record,root,operation,claimId,actor,observed:(name,value)=>observed(observers,name,value)});
   revalidate(resolved,record,observers,current);
   if(record.publishedPr!==null) observeReleasePull(record,(name,value)=>observed(observers,name,value));
   exactPublishedHead(record,observers);revalidate(resolved,record,observers,current);authorize(state,resolved,actor,record,action);validateReleaseRecord(record);return result;
  }
  const effect=record.actions[deliveryId];if(!effect) fail('authorized effect delivery is absent');
  context(state,resolved,actor,observers,{empty:git(root,['rev-parse','HEAD'])===record.adoption.adoption.integrationSha});
  if(actor.harness.identity!==record.developer || actor.harness.sessionId!==record.developerSession) fail('effect actor differs from prepared developer');
  if(operation==='dispatch') {
   if(effect.status!=='authorized') fail('effect replay is forbidden; dispatched or uncertain work requires reconciliation');
   const current=snapshot(root,record,{dirty:effect.operation==='commit'});
   if(effect.beforeHead!==current.head || effect.snapshot!==current.fingerprint) fail('delayed decision head/diff changed');
   revalidate(resolved,record,observers,current,{dirty:effect.operation==='commit'});
   authorize(state,resolved,actor,record);
   effect.status='dispatched';return {actionable:true,effect:structuredClone(effect)};
  }
  if(operation==='uncertain') {
   if(effect.status!=='dispatched') fail('only a dispatched effect can become uncertain');
   authorize(state,resolved,actor,record);effect.status='uncertain';return {actionable:false,effect:structuredClone(effect)};
  }
  if(!['ack','reconcile'].includes(operation) || effect.status!==(operation==='ack'?'dispatched':'uncertain')) fail('effect acknowledgement or reconciliation state invalid');
  const current=snapshot(root,record),receipt=observed(observers,'effect',effect);
  if(receipt?.head!==current.head || receipt.result!=='succeeded' || typeof receipt.operationId!=='string' || !receipt.operationId.trim() || !Number.isFinite(Date.parse(receipt.observedAt))) fail('actual effect observation is incomplete');
  if(effect.operation==='commit') {
   if(git(root,['show','-s','--format=%P',current.head])!==effect.beforeHead || !equal(current.blobs,effect.blobs) || current.head===effect.beforeHead) fail('actual commit does not match authorized snapshot');
   record.head=current.head;invalidateReleaseReviews(state,record);
   if(record.correction?.status==='requested') {record.correction.status='committed';record.correction.correctedHead=current.head;}
  } else if(current.head!==effect.beforeHead || receipt.remoteHead!==current.head) fail('actual successful push observation differs');
  if(effect.operation==='push') exactPublishedHead(record,observers);
  revalidate(resolved,record,observers,current);authorize(state,resolved,actor,record);
  effect.receipt=receipt;effect.status=operation==='ack'?'acknowledged':'reconciled';
  validateReleaseRecord(record);return {actionable:false,effect:structuredClone(effect)};
 });
}

/** Existing event authorization and lock remain the outer boundary. */
export function applyReleaseReviewBoundary(state,input,resolved,actor,observers) {
 const record=state.epics[EPIC]?.releaseVerification;
 if(!record) fail('runtime release record is missing');
 validateReleaseRecord(record);assertReleaseReviewState(state,record);authorize(state,resolved,actor,record,input.type);
 context(state,resolved,actor,observers);const current=snapshot(resolved.worktree,record);
 exactPublishedHead(record,observers);
 if(current.head!==record.head) fail('unacknowledged head change requires reconciliation');
 if(Object.values(record.actions).some(item=>['authorized','dispatched','uncertain'].includes(item.status))) fail('pending effect requires acknowledgement or reconciliation');
 let result;
 const observe=(name,value)=>observed(observers,name,value);
 if(input.type==='review.ready') result={review:readyReleaseReviews(state,record,actor,observe)};
 else {
  assertLocalReleaseGate(state,record);observeReleasePull(record,observe);
  if(!record.hostReady || !record.correction || record.correction.status!=='committed' || record.correction.correctedHead!==record.head) fail('host readiness and genuine same-PR evidence correction required');
  const publications=Object.values(state.reviews).filter(item=>item.pr===record.publishedPr && item.head===record.head && !item.invalidated);
  if(publications.length!==2 || publications.some(item=>!['acknowledged','reconciled'].includes(item.claim.status))) fail('current-head hosted verdict publication acknowledgements required');
  const qa=observe('mergeQA',{head:record.head,pr:record.publishedPr,correction:record.correction});
  exactReleaseKeys(qa,['head','pr','accepted','evidence','by','sessionId','observedAt']);
  if(qa.head!==record.head || qa.pr!==record.publishedPr || qa.accepted!==true || typeof qa.evidence!=='string' || !qa.evidence.trim() || qa.evidence.length>2048
   || typeof qa.by!=='string' || !qa.by.trim() || qa.by.trim().toLowerCase()===record.developer.trim().toLowerCase() || typeof qa.sessionId!=='string' || !qa.sessionId.trim() || qa.sessionId===record.developerSession
   || typeof qa.observedAt!=='string' || !Number.isFinite(Date.parse(qa.observedAt))) fail('independent final pre-merge QA acceptance required');
  const hostEvidence=evaluateReleaseHostGate({root:resolved.worktree,baseSha:record.adoption.adoption.integrationSha,headSha:record.head,pr:record.publishedPr,api:observers?.api});
  result={hostEvidence,qa,originalPr:record.adoption.original.pr,publicationPr:record.publishedPr};
 }
 revalidate(resolved,record,observers,current);
 if(record.publishedPr!==null) observeReleasePull(record,observe);
 exactPublishedHead(record,observers);revalidate(resolved,record,observers,current);authorize(state,resolved,actor,record,input.type);validateReleaseRecord(record);return result;
}

/** Completion is a separate J-bound observation. It does not reopen PR2/H2
 * readiness: it verifies the immutable integration proof, then requires fresh
 * J loading, host checks, smoke, documentation, findings, and safe cleanup. */
export function completeReleaseVerification(state,input,resolved,actor,observers) {
 const record=state.epics[EPIC]?.releaseVerification;
 if(!record) fail('runtime release record is missing');
 validateReleaseRecord(record);assertReleaseReviewState(state,record);authorize(state,resolved,actor,record,'epic.complete');
 if(record.phase!=='integrated' || !record.proof?.release.integrationSha) fail('verified J release integration is required');
 const j=record.proof.release.integrationSha,i=record.adoption.adoption.integrationSha;
 const current=snapshot(resolved.worktree,record);
 if(current.head!==record.head || Object.values(record.actions).some(item=>!['acknowledged','reconciled'].includes(item.status))) fail('release completion requires the settled submitted H2 record');
 mirrors(resolved,i);publicationBinding(record,current.head,observers?.api??githubJSON);
 if((observers?.api??githubJSON)(`repos/${REPOSITORY}/git/ref/heads/main`)?.object?.sha!==j) fail('current main changed since verified J integration');
 const loaded=observed(observers,'activation',{epic:EPIC,base:j,phase:'completion'});
 if(loaded?.source!=='session-harness' || loaded.sessionId!==actor.harness.sessionId || loaded.loadedRevision!==j || loaded.policyDigest!==record.adoption.policy.canonical.digest || typeof loaded.observedAt!=='string' || !Number.isFinite(Date.parse(loaded.observedAt))) fail('fresh loaded J adapter required for completion');
 const proof=proveReleaseVerification({root:resolved.worktree,baseSha:i,headSha:record.head,headRef:resolved.branch,api:observers?.api,integration:{pr:record.publishedPr,sha:j}});
 if(!equal(proof,record.proof)) fail('J provenance differs from the persisted integration proof');
 const completionGate=evaluateReleaseCompletionGate({root:resolved.worktree,baseSha:i,headSha:record.head,pr:record.publishedPr,integration:{pr:record.publishedPr,sha:j},api:observers?.api});
 if(!equal(completionGate.proof,proof)) fail('J required gates provenance differs from the persisted integration proof');
 const evidence=observed(observers,'completion',{epic:EPIC,completionId:input.completionId,proof:structuredClone(proof),loaded:structuredClone(loaded)});
 const {receipt}=evaluateCompletion({...evidence,releaseVerification:proof});
 if(receipt.repository!==REPOSITORY || receipt.epic!==EPIC || receipt.pullRequest!==proof.adoption.original.pr || receipt.submittedHead!==proof.adoption.original.submittedHead || receipt.integrationSha!==j
  || receipt.policy.digest!==record.adoption.policy.canonical.digest || receipt.releaseVerification===undefined) fail('completion does not bind the preserved EPIC-006 J relation');
 if(receipt.activation.observedAt!==loaded.observedAt) fail('completion activation is not the fresh J load observation');
 if(!equal(receipt.host.checks,completionGate.checks)) fail('completion host checks do not match the exact J required gates status');
 const admissionObservation=observed(observers,'integration',structuredClone(receipt));
 admitEpic({completion:receipt,activeEpics:[],hostObservation:admissionObservation,currentIntegrationSha:j},{id:EPIC});
 if(snapshot(resolved.worktree,record).fingerprint!==current.fingerprint || !equal(evaluateReleaseCompletionGate({root:resolved.worktree,baseSha:i,headSha:record.head,pr:record.publishedPr,integration:{pr:record.publishedPr,sha:j},api:observers?.api}).checks,completionGate.checks)) fail('completion observations changed during verification');
 authorize(state,resolved,actor,record,'epic.complete');
 state.epics[EPIC]={...state.epics[EPIC],completion:{id:input.completionId,receipt}};
 return {completion:receipt};
}
