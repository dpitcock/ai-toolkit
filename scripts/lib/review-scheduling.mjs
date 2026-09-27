import crypto from 'node:crypto';

const SHA=/^[a-f0-9]{40}$/i;
const CLAIM_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_STATUSES=new Set(['queued','claimed','acknowledged','uncertain','reconciled']);

function fail(message) { throw new Error(`Review scheduling ${message}`); }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function string(value,label) {
  if(typeof value!=='string' || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}
function head(value) {
  if(typeof value!=='string' || !SHA.test(value)) fail('head must be a full Git SHA');
  return value.toLowerCase();
}
function pr(value) {
  if(!Number.isInteger(value) || value<1) fail('PR must be a positive integer');
  return value;
}
function target(value) {
 if(value.release!==undefined || value.epic!==undefined) {
  if(value.pr!==undefined || value.repository!=='dpitcock/ai-toolkit' || value.epic!=='EPIC-006' || value.release!=='activation-evidence') fail('local release identity is outside the finite route');
  return {epic:value.epic,release:value.release};
 }
 return {pr:pr(value.pr)};
}
function targetKey(value) {return value.release?`release:${value.epic}:${value.release}`:value.pr;}
function key(value) { return JSON.stringify([value.repository,targetKey(value),value.role,value.head]); }
function exactKeys(value,keys,label) {
  if(!object(value) || Object.keys(value).some(name=>!keys.includes(name))) fail(`${label} is malformed`);
}
function validateClaim(value) {
  exactKeys(value,['id','status','reviewerIdentity','operationId'],'claim');
  if(!CLAIM_ID.test(value.id) || !CLAIM_STATUSES.has(value.status)) fail('claim is corrupt');
  if(value.status==='queued') {
    if(value.reviewerIdentity!==null || value.operationId!==null) fail('queued claim is corrupt');
  } else if(typeof value.reviewerIdentity!=='string' || !value.reviewerIdentity.trim() || typeof value.operationId!=='string' || !value.operationId.trim()) {
    fail('claim is corrupt');
  }
}
function validateRecord(value,recordKey) {
  exactKeys(value,['repository','pr','epic','release','role','head','ready','invalidated','claim'],'review record');
  const repository=string(value.repository,'repository'),identity=target(value),role=string(value.role,'role'),commit=head(value.head);
  if(typeof value.ready!=='boolean' || typeof value.invalidated!=='boolean') fail('review record is corrupt');
  if(value.invalidated && value.ready) fail('review record is corrupt');
  validateClaim(value.claim);
  if(key({repository,...identity,role,head:commit})!==recordKey) fail('review record key is corrupt');
}
function validateState(state) {
  if(!object(state) || state.version!==1 || !object(state.reviews)) fail('state reviews are missing or corrupt');
  for(const [recordKey,record] of Object.entries(state.reviews)) validateRecord(record,recordKey);
}
function baseEvent(event,allowed) {
  if(!object(event) || typeof event.type!=='string') fail('event is malformed');
  exactKeys(event,[...allowed,'epic','release'],'event');
  return {repository:string(event.repository,'repository'),...target(event),head:head(event.head)};
}
function recordFor(state,identity,claimId) {
  let found=null;
  for(const record of Object.values(state.reviews)) {
    if(record.repository!==identity.repository || targetKey(record)!==targetKey(identity) || record.head!==identity.head) continue;
    if(record.claim.id===claimId) {
      if(found) fail('claim ID is ambiguous');
      found=record;
    }
  }
  if(!found) fail('claim ID does not match repository, PR, and head');
  return found;
}
function claimId(value) {
  if(typeof value!=='string' || !CLAIM_ID.test(value)) fail('claim ID is malformed');
  return value;
}
function result(state,dispatches=[]) { return {state,dispatches}; }

/**
 * Applies one durable, review-dispatch lifecycle event to a workflow state
 * snapshot. The function clones its input so callers can persist the returned
 * state under workflow-state's lock. It never treats an acknowledgement as a
 * review verdict and never dispatches work on a push.
 */
export function applyReviewEvent(state,event) {
  validateState(state);
  const next=structuredClone(state);

  if(event?.type==='ready') {
    const identity=baseEvent(event,['type','repository','pr','head','roles']);
    if(!Array.isArray(event.roles) || event.roles.length===0 || event.roles.some(role=>typeof role!=='string' || !role.trim()) || new Set(event.roles).size!==event.roles.length) {
      fail('ready roles must be unique non-empty strings');
    }
    for(const role of event.roles) {
      const normalizedRole=role.trim(),recordKey=key({...identity,role:normalizedRole});
      if(Object.hasOwn(next.reviews,recordKey)) continue;
      next.reviews[recordKey]={
        ...identity,role:normalizedRole,
        ready:true,invalidated:false,
        claim:{id:crypto.randomUUID(),status:'queued',reviewerIdentity:null,operationId:null},
      };
    }
    return result(next);
  }

  if(event?.type==='push') {
    const identity=baseEvent(event,['type','repository','pr','head']);
    for(const record of Object.values(next.reviews)) {
      if(record.repository===identity.repository && targetKey(record)===targetKey(identity) && record.head!==identity.head) {
        record.ready=false;
        record.invalidated=true;
      }
    }
    return result(next);
  }

  if(event?.type==='claim') {
    const identity=baseEvent(event,['type','repository','pr','head','claimId','reviewerIdentity','operationId','uncertain']);
    const id=claimId(event.claimId),record=recordFor(next,identity,id);
    if(record.invalidated || !record.ready) fail('claim belongs to a stale head');
    const reviewerIdentity=string(event.reviewerIdentity,'reviewer identity'),operationId=string(event.operationId,'operation ID');
    if(event.uncertain===true) {
      if(record.claim.status!=='claimed') fail('claim is not claimed');
      if(record.claim.reviewerIdentity!==reviewerIdentity || record.claim.operationId!==operationId) fail('claim dispatch does not match');
      record.claim.status='uncertain';
      return result(next);
    }
    if(event.uncertain!==undefined && event.uncertain!==false) fail('claim uncertainty must be boolean');
    if(record.claim.status!=='queued') fail('claim is not queued');
    record.claim={id,status:'claimed',reviewerIdentity,operationId};
    return result(next,[{claimId:id,repository:record.repository,...target(record),role:record.role,head:record.head,reviewerIdentity,operationId}]);
  }

  if(event?.type==='ack') {
    const identity=baseEvent(event,['type','repository','pr','head','claimId']);
    const record=recordFor(next,identity,claimId(event.claimId));
    if(record.invalidated || !record.ready) fail('acknowledgement belongs to a stale head');
    if(record.claim.status!=='claimed') fail('claim is not claimed');
    record.claim.status='acknowledged';
    return result(next);
  }

  if(event?.type==='reconcile') {
    const identity=baseEvent(event,['type','repository','pr','head','claimId','observed']);
    const record=recordFor(next,identity,claimId(event.claimId));
    if(record.invalidated || !record.ready) fail('reconciliation belongs to a stale head');
    if(record.claim.status!=='uncertain') fail('claim is not uncertain');
    exactKeys(event.observed,['operationId','reviewerIdentity','role','head'],'observed external operation');
    if(string(event.observed.operationId,'observed operation ID')!==record.claim.operationId ||
      string(event.observed.reviewerIdentity,'observed reviewer identity')!==record.claim.reviewerIdentity ||
      string(event.observed.role,'observed role')!==record.role ||
      head(event.observed.head)!==record.head) {
      fail('observed external operation does not match uncertain claim');
    }
    record.claim.status='reconciled';
    return result(next);
  }

  fail('event type is unsupported');
}
