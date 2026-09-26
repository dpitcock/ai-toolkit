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
 exactReleaseKeys(value,['version','id','phase','adoption','head','developer','developerSession','authorizationId','loaded','actions','localReviews','localReady','hostReady','publishedPr','qa','correction','proof']);
 if(value.version!==1 || value.id!=='activation-evidence' || !['prepared','active','local-review-ready','locally-reviewed','published','integrated'].includes(value.phase)) releaseFailure('runtime identity or phase invalid');
 validateAdoptionRelation(value.adoption);
 if(value.adoption.adoption.integrationSha===null) releaseFailure('runtime requires verified I');
 const text=v=>typeof v==='string' && v.length>0 && v.length<=2048;
 const sha=v=>typeof v==='string' && /^[a-f0-9]{40}$/.test(v);
 if(!sha(value.head) || !text(value.developer) || !text(value.developerSession) || !text(value.authorizationId)) releaseFailure('runtime identity malformed');
 exactReleaseKeys(value.loaded,['source','sessionId','loadedRevision','policyDigest','observedAt']);
 if(value.loaded.source!=='session-harness' || value.loaded.loadedRevision!==value.adoption.adoption.integrationSha || value.loaded.policyDigest!==value.adoption.policy.canonical.digest || value.loaded.sessionId!==value.developerSession || !Number.isFinite(Date.parse(value.loaded.observedAt))) releaseFailure('loaded adapter is not bound to I');
 if(!value.actions || typeof value.actions!=='object' || Array.isArray(value.actions)) releaseFailure('action collection malformed');
 for(const [id,action] of Object.entries(value.actions)) {
  exactReleaseKeys(action,['id','operation','status','beforeHead','snapshot','blobs','receipt']);
  if(action.id!==id || !text(id) || !['commit','push'].includes(action.operation) || !['authorized','dispatched','uncertain','acknowledged','reconciled'].includes(action.status) || !sha(action.beforeHead) || typeof action.snapshot!=='string' || !/^[a-f0-9]{64}$/.test(action.snapshot)) releaseFailure('action identity malformed');
  exactReleaseKeys(action.blobs,['docs/verification.md','project/EPIC-006-activation-evidence.json']);
  if(Object.values(action.blobs).some(blob=>!sha(blob))) releaseFailure('action snapshots malformed');
  if(['acknowledged','reconciled'].includes(action.status)) {
   exactReleaseKeys(action.receipt,action.operation==='push'?['operationId','head','remoteHead','result','observedAt']:['operationId','head','result','observedAt']);
   if(!text(action.receipt.operationId) || !sha(action.receipt.head) || action.receipt.result!=='succeeded' || !Number.isFinite(Date.parse(action.receipt.observedAt)) || (action.operation==='push' && action.receipt.remoteHead!==action.receipt.head)) releaseFailure('effect receipt invalid');
  } else if(action.receipt!==null) releaseFailure('unacknowledged action cannot carry receipt');
 }
 if(!Array.isArray(value.localReviews) || value.localReviews.length>2 || typeof value.localReady!=='boolean' || typeof value.hostReady!=='boolean') releaseFailure('readiness malformed');
 if(value.publishedPr!==null && (!Number.isSafeInteger(value.publishedPr) || value.publishedPr<1 || [value.adoption.original.pr,value.adoption.finalization.pr,value.adoption.adoption.pr].includes(value.publishedPr))) releaseFailure('PR2 identity invalid');
 if(value.proof!==null) validateReleaseRelation(value.proof);
 if(value.phase==='integrated' && (!value.proof?.release.integrationSha || value.proof.release.pr!==value.publishedPr)) releaseFailure('integrated runtime lacks J proof');
 return value;
}
