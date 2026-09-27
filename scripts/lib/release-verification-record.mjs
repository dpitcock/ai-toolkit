import {validateAdoptionRelation} from './policy-adoption-record.mjs';
// Pure schema; only the controller can obtain observations or establish authority.
export function releaseFailure(message) {throw new Error(`Release verification ${message}`);}
export function exactReleaseKeys(value,keys) {
 if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join(',')!==[...keys].sort().join(',')) releaseFailure('schema is malformed');
}
export function validateReleaseRelation(value) {
 exactReleaseKeys(value,['kind','version','id','adoption','release']);
 if(value.kind!=='epic-release-verification' || value.version!==1 || value.id!=='activation-evidence') releaseFailure('finite identity is invalid');
 validateAdoptionRelation(value.adoption);
 const {release,adoption}=value;
 exactReleaseKeys(release,['base','head','pr','integrationSha','paths']);
 if(!adoption.adoption.integrationSha || release.base!==adoption.adoption.integrationSha || typeof release.head!=='string' || !/^[a-f0-9]{40}$/.test(release.head)
  || JSON.stringify(release.paths)!==JSON.stringify(['docs/verification.md','project/EPIC-006-activation-evidence.json'])) releaseFailure('I-to-J binding is invalid');
 if(release.pr!==null && (!Number.isSafeInteger(release.pr) || release.pr<1 || [adoption.original.pr,adoption.finalization.pr,adoption.adoption.pr].includes(release.pr))) releaseFailure('distinct PR2 identity required');
 if(release.integrationSha!==null && (typeof release.integrationSha!=='string' || !/^[a-f0-9]{40}$/.test(release.integrationSha) || release.pr===null || release.integrationSha===release.base)) releaseFailure('J identity is invalid');
 return value;
}

export function validateReleaseRecord(value) {
 exactReleaseKeys(value,['version','id','phase','adoption','head','developer','developerSession','authorizationId','loaded','actions','assignments','localReviews','lastReview','localReady','hostReady','publishedPr','qa','correction','proof']);
 if(value.version!==1 || value.id!=='activation-evidence' || !['prepared','active','local-review-ready','locally-reviewed','published','integrated'].includes(value.phase)) releaseFailure('runtime identity or phase invalid');
 validateAdoptionRelation(value.adoption);
 if(value.adoption.adoption.integrationSha===null) releaseFailure('runtime requires verified I');
 const text=v=>typeof v==='string' && v.trim().length>0 && v.length<=2048;
 const sha=v=>typeof v==='string' && /^[a-f0-9]{40}$/.test(v);
 if(!sha(value.head) || !text(value.developer) || !text(value.developerSession) || !text(value.authorizationId)) releaseFailure('runtime identity malformed');
 exactReleaseKeys(value.loaded,['source','sessionId','loadedRevision','policyDigest','observedAt']);
 if(value.loaded.source!=='session-harness' || value.loaded.loadedRevision!==value.adoption.adoption.integrationSha || value.loaded.policyDigest!==value.adoption.policy.canonical.digest || value.loaded.sessionId!==value.developerSession || typeof value.loaded.observedAt!=='string' || !Number.isFinite(Date.parse(value.loaded.observedAt))) releaseFailure('loaded adapter is not bound to I');
 if(!value.actions || typeof value.actions!=='object' || Array.isArray(value.actions) || Object.keys(value.actions).length>512) releaseFailure('action collection malformed');
 for(const [id,action] of Object.entries(value.actions)) {
  exactReleaseKeys(action,['id','sequence','operation','status','beforeHead','snapshot','blobs','receipt']);
  if(!Number.isSafeInteger(action.sequence) || action.sequence<1) releaseFailure('action sequence malformed');
  if(action.id!==id || !text(id) || !['commit','push'].includes(action.operation) || !['authorized','dispatched','uncertain','acknowledged','reconciled'].includes(action.status) || !sha(action.beforeHead) || typeof action.snapshot!=='string' || !/^[a-f0-9]{64}$/.test(action.snapshot)) releaseFailure('action identity malformed');
  exactReleaseKeys(action.blobs,['docs/verification.md','project/EPIC-006-activation-evidence.json']);
  if(Object.values(action.blobs).some(blob=>!sha(blob))) releaseFailure('action snapshots malformed');
  if(['acknowledged','reconciled'].includes(action.status)) {
   exactReleaseKeys(action.receipt,action.operation==='push'?['operationId','head','remoteHead','result','observedAt']:['operationId','head','result','observedAt']);
   if(!text(action.receipt.operationId) || !sha(action.receipt.head) || action.receipt.result!=='succeeded' || typeof action.receipt.observedAt!=='string' || !Number.isFinite(Date.parse(action.receipt.observedAt)) || (action.operation==='push' && action.receipt.remoteHead!==action.receipt.head)) releaseFailure('effect receipt invalid');
  } else if(action.receipt!==null) releaseFailure('unacknowledged action cannot carry receipt');
 }
 const sequences=Object.values(value.actions).map(item=>item.sequence).sort((a,b)=>a-b);
 if(sequences.some((sequence,index)=>sequence!==index+1)) releaseFailure('action sequence missing or duplicated');
 const roles=['code_reviewer','appsec'],time=v=>typeof v==='string' && Number.isFinite(Date.parse(v));
 const identity=v=>text(v.by) && text(v.sessionId) && sha(v.head);
 if(!Array.isArray(value.assignments) || value.assignments.length>512) releaseFailure('assignments malformed');
 for(const item of value.assignments) {
  exactReleaseKeys(item,['boundary','role','by','sessionId','head','claimId','operationId']);
  if(!['local','host'].includes(item.boundary) || !roles.includes(item.role) || !identity(item) || !text(item.claimId) || !text(item.operationId)) releaseFailure('assignment malformed');
 }
 if(new Set(value.assignments.map(item=>item.claimId)).size!==value.assignments.length) releaseFailure('duplicate assignment');
 if(value.lastReview!==null) {
  const item=value.lastReview;exactReleaseKeys(item,['role','by','sessionId','head','claimId','verdict','evidence','observedAt']);
  if(!roles.includes(item.role) || !identity(item) || !['approved','changes-requested'].includes(item.verdict) || !text(item.evidence) || !time(item.observedAt)
   || !value.assignments.some(a=>a.boundary==='local' && a.claimId===item.claimId && a.role===item.role && a.head===item.head && a.by===item.by && a.sessionId===item.sessionId)) releaseFailure('observed verdict malformed');
 }
 if(!Array.isArray(value.localReviews) || value.localReviews.length>2) releaseFailure('reviews malformed');
 for(const [index,item] of value.localReviews.entries()) {
  exactReleaseKeys(item,['role','by','sessionId','head','claimId','verdict','evidence','observedAt']);
  if(item.role!==roles[index] || !identity(item) || item.head!==value.head || item.verdict!=='approved' || !text(item.evidence) || !time(item.observedAt)
   || item.by.trim().toLowerCase()===value.developer.trim().toLowerCase() || item.sessionId===value.developerSession
   || !value.assignments.some(a=>a.boundary==='local' && a.claimId===item.claimId && a.role===item.role && a.head===item.head && a.by===item.by && a.sessionId===item.sessionId)) releaseFailure('ordered independent review invalid');
 }
 if(value.localReviews.length===2 && (value.localReviews[0].by.trim().toLowerCase()===value.localReviews[1].by.trim().toLowerCase() || value.localReviews[0].sessionId===value.localReviews[1].sessionId)) releaseFailure('review sessions must be distinct');
 for(const boundary of ['localReady','hostReady']) if(value[boundary]!==false) {
  const ready=value[boundary];exactReleaseKeys(ready,boundary==='localReady'?['head','by','sessionId','observedAt']:['head','pr','by','sessionId','observedAt']);
  if(!identity(ready) || ready.head!==value.head || ready.by!==value.developer || ready.sessionId!==value.developerSession || !time(ready.observedAt) || (boundary==='hostReady' && ready.pr!==value.publishedPr)) releaseFailure('readiness malformed');
 }
 if(value.qa!==null) validateReleaseQA(value.qa);
 if(value.correction!==null) {
  const c=value.correction;exactReleaseKeys(c,['head','pr','by','sessionId','evidence','observedAt','indices','status','correctedHead']);
  if(!identity(c) || !text(c.evidence) || !time(c.observedAt) || c.pr!==value.publishedPr || !['requested','committed'].includes(c.status)
   || !Array.isArray(c.indices) || !c.indices.length || c.indices.length>128 || c.indices.some(i=>!Number.isSafeInteger(i) || i<0 || i>=128) || new Set(c.indices).size!==c.indices.length
   || (c.status==='requested'?c.correctedHead!==null:!sha(c.correctedHead))) releaseFailure('correction malformed');
 }
 if(value.localReady && value.qa?.head!==value.head) releaseFailure('readiness requires current independent QA');
 if(value.phase==='local-review-ready' && !value.localReady) releaseFailure('review phase requires explicit readiness');
 if(['locally-reviewed','published'].includes(value.phase) && (!value.localReady || value.localReviews.length!==2)) releaseFailure('reviewed phase requires Staff then AppSec');
 if(value.hostReady && (value.localReviews.length!==2 || value.publishedPr===null)) releaseFailure('host readiness requires local reviews and PR2');
 if(value.publishedPr!==null && (!Number.isSafeInteger(value.publishedPr) || value.publishedPr<1 || [value.adoption.original.pr,value.adoption.finalization.pr,value.adoption.adoption.pr].includes(value.publishedPr))) releaseFailure('PR2 identity invalid');
 if(value.proof!==null) validateReleaseRelation(value.proof);
 if(value.phase==='integrated' && (!value.proof?.release.integrationSha || value.proof.release.pr!==value.publishedPr)) releaseFailure('integrated runtime lacks J proof');
 return value;
}

export function validateReleaseQA(value) {
 exactReleaseKeys(value,['head','by','sessionId','verdict','evidence','observedAt','increments','preReadinessDispatches','routineConfirmations','routineStaffAuthorizations']);
 const text=v=>typeof v==='string' && v.trim().length>0 && v.length<=2048;
 if(typeof value.head!=='string' || !/^[a-f0-9]{40}$/.test(value.head) || !text(value.by) || !text(value.sessionId) || !text(value.evidence) || value.verdict!=='accepted'
  || typeof value.observedAt!=='string' || !Number.isFinite(Date.parse(value.observedAt)) || value.preReadinessDispatches!==0 || value.routineConfirmations!==0 || value.routineStaffAuthorizations!==0
  || !Array.isArray(value.increments) || value.increments.length<2 || value.increments.length>128) releaseFailure('independent meaningfulness QA invalid');
 for(const item of value.increments) {
  exactReleaseKeys(item,['commitId','pushId','head','evidence']);
  if(!text(item.commitId) || !text(item.pushId) || !text(item.evidence) || typeof item.head!=='string' || !/^[a-f0-9]{40}$/.test(item.head)) releaseFailure('QA increment invalid');
 }
 return value;
}
