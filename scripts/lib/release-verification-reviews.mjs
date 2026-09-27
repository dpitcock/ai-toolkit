import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {applyReviewEvent} from './review-scheduling.mjs';
import {localSnapshot} from './epic-finalization.mjs';
import {ACTIVATION_REPORT,validateActivationReport} from './activation-report.mjs';
import {validateReleaseQA,exactReleaseKeys,releaseFailure as fail} from './release-verification-record.mjs';

const ROLES=['code_reviewer','appsec'],REPOSITORY='dpitcock/ai-toolkit';
const done=item=>['acknowledged','reconciled'].includes(item?.status);
const normalized=value=>value.trim().toLowerCase();
function independent(record,by,sessionId) {
 if(typeof by!=='string' || !by.trim() || typeof sessionId!=='string' || !sessionId.trim() || normalized(by)===normalized(record.developer) || sessionId===record.developerSession) fail('independent observed session required');
}
function target(record,host=false) {return {repository:REPOSITORY,...(host?{pr:record.publishedPr}:{epic:'EPIC-006',release:'activation-evidence'}),head:record.head};}
function schedule(state,event) {const result=applyReviewEvent(state,event);state.reviews=result.state.reviews;return result;}
function claims(state,record,host=false) {return Object.values(state.reviews).filter(item=>item.repository===REPOSITORY && item.head===record.head && !item.invalidated && (host?item.pr===record.publishedPr:item.release==='activation-evidence'));}
export function assertReleaseReviewState(state,record) {
 applyReviewEvent(state,{type:'push',...target(record)});
 const relevant=Object.values(state.reviews).filter(item=>item.repository===REPOSITORY && (item.release==='activation-evidence' || (record.publishedPr!==null && item.pr===record.publishedPr)));
 for(const assignment of record.assignments) {
  const claim=relevant.find(item=>item.claim.id===assignment.claimId);
  if(!claim || claim.head!==assignment.head || claim.role!==assignment.role || claim.claim.status==='queued' || claim.claim.reviewerIdentity!==assignment.by || claim.claim.operationId!==assignment.operationId
   || (assignment.boundary==='local'?claim.release!=='activation-evidence':claim.pr!==record.publishedPr)) fail('durable assignment claim missing or corrupt');
 }
 for(const claim of relevant) if(claim.claim.status!=='queued' && !record.assignments.some(item=>item.claimId===claim.claim.id)) fail('durable claim assignment missing or corrupt');
 for(const host of [false,true]) if(host?record.hostReady:record.localReady) {
  const current=claims(state,record,host);
  if(current.length!==2 || ROLES.some(role=>current.filter(item=>item.role===role && item.ready).length!==1)) fail('durable readiness claims missing or corrupt');
 }
}
export function invalidateReleaseReviews(state,record) {
 schedule(state,{type:'push',...target(record)});
 if(record.publishedPr!==null) schedule(state,{type:'push',...target(record,true)});
 record.localReady=false;record.hostReady=false;record.localReviews=[];record.qa=null;record.phase='active';
}
export function observeReleasePull(record,observed) {
 const pull=observed('pullRequest',{repository:REPOSITORY,epic:'EPIC-006',release:record.id,head:record.head,pr:record.publishedPr});
 if(pull?.repository!==REPOSITORY || pull.head!==record.head || pull.state!=='open' || pull.base!=='main' || pull.headBranch!=='epic/EPIC-006'
  || !Number.isSafeInteger(pull.pr) || pull.pr<1 || [record.adoption.original.pr,record.adoption.finalization.pr,record.adoption.adoption.pr].includes(pull.pr)
  || (record.publishedPr!==null && pull.pr!==record.publishedPr)) fail('same actual open PR2 and current head required');
 return pull;
}
function checkIncrements(record) {
 const actions=Object.values(record.actions),commits=actions.filter(item=>item.operation==='commit' && done(item));
 const pushed=commits.filter(item=>actions.some(push=>push.operation==='push' && done(push) && push.receipt.head===item.receipt.head && push.sequence>item.sequence));
 if(new Set(pushed.map(item=>item.receipt.head)).size<2) fail('two actual acknowledged nonempty commits and successful pushes required');
 if(!actions.some(item=>item.operation==='push' && done(item) && item.receipt.head===record.head)) fail('current head successful push required');
 return pushed;
}
function qaReady(record,observed) {
 const commits=checkIncrements(record),qa=validateReleaseQA(observed('qa',{head:record.head,actions:record.actions,correction:record.correction}));
 independent(record,qa.by,qa.sessionId);
 if(qa.head!==record.head || new Set(qa.increments.map(item=>item.head)).size!==qa.increments.length) fail('QA must bind distinct actual increments and current head');
 for(const item of qa.increments) {
  const commit=commits.find(action=>action.id===item.commitId),push=record.actions[item.pushId];
  if(!commit || commit.receipt.head!==item.head || push?.operation!=='push' || !done(push) || push.receipt.head!==item.head) fail('independent QA must assess actual acknowledged commits and pushes');
 }
 return qa;
}
export function assertLocalReleaseGate(state,record) {
 applyReviewEvent(state,{type:'push',...target(record)});
 if(!record.localReady || record.localReady.head!==record.head || record.localReviews.length!==2 || record.localReviews.some((review,index)=>review.role!==ROLES[index] || review.head!==record.head)) fail('local Staff then AppSec review required');
 for(const review of record.localReviews) {
  const claim=claims(state,record).find(item=>item.claim.id===review.claimId);
  const assignment=record.assignments.find(item=>item.claimId===review.claimId);
  if(!claim || !claim.ready || claim.role!==review.role || claim.claim.reviewerIdentity!==review.by || claim.claim.operationId!==assignment?.operationId || !done(claim.claim)) fail('actual acknowledged local review claim required');
 }
}
export function readyReleaseReviews(state,record,actor,observed) {
 if(actor.harness.identity!==record.developer || actor.harness.sessionId!==record.developerSession) fail('readiness actor differs from prepared developer');
 if(record.publishedPr!==null && record.localReviews.length===2) {
  assertLocalReleaseGate(state,record);observeReleasePull(record,observed);
  record.hostReady ||= {head:record.head,pr:record.publishedPr,by:actor.harness.identity,sessionId:actor.harness.sessionId,observedAt:new Date().toISOString()};
  schedule(state,{type:'ready',...target(record,true),roles:ROLES});
  return {stage:'host',purpose:'publish-completed-verdicts',pr:record.publishedPr,head:record.head,roles:ROLES,claims:claims(state,record,true).map(item=>item.claim)};
 }
 if(!record.localReady) {
  record.qa=qaReady(record,observed);
  if(claims(state,record).some(item=>item.claim.status!=='queued')) fail('prior dispatch without current readiness requires recovery or a new head');
  record.localReady={head:record.head,by:actor.harness.identity,sessionId:actor.harness.sessionId,observedAt:new Date().toISOString()};
  record.phase='local-review-ready';
 }
 schedule(state,{type:'ready',...target(record),roles:ROLES});
 return {stage:'local',purpose:'independent-review',head:record.head,roles:ROLES,claims:claims(state,record).map(item=>item.claim)};
}

export function assertEvidenceCorrection(root,record) {
 const request=record.correction;
 if(!request || request.status!=='requested' || request.head!==record.head) fail('published evidence correction requires an independent request');
 const before=validateActivationReport(localSnapshot(root,record.head).read(ACTIVATION_REPORT));
 const after=validateActivationReport(fs.readFileSync(path.join(root,ACTIVATION_REPORT),'utf8'));
 if(before.observations.length!==after.observations.length) fail('correction may only replace requested pending observations');
 for(const [index,item] of before.observations.entries()) {
  const next=after.observations[index];
  if(request.indices.includes(index)) {
   if(item.status!=='pending' || next.status!=='observed' || item.kind!==next.kind) fail('correction must honestly replace pending with observed facts');
  } else if(!equal(item,next)) fail('correction changed an unrequested observation');
 }
}

export function controlReleaseReviews({state,record,root,operation,claimId,actor,observed}) {
 // Validate the complete scheduler schema before consulting any persisted claim.
 schedule(state,{type:'push',...target(record)});
 const developer=actor.harness.identity===record.developer && actor.harness.sessionId===record.developerSession;
 if(['gate','publish'].includes(operation)) {
  if(!developer) fail('publication actor differs from prepared developer');
  assertLocalReleaseGate(state,record);
  if(operation==='publish') {record.publishedPr=observeReleasePull(record,observed).pr;record.phase='published';}
  return {phase:record.phase,publishedPr:record.publishedPr,head:record.head,actionable:false};
 }
 if(operation==='correction') {
  observeReleasePull(record,observed);
  const request=observed('correction',{head:record.head,pr:record.publishedPr});
  exactReleaseKeys(request,['head','pr','by','sessionId','evidence','observedAt','indices']);
  independent(record,request.by,request.sessionId);
  if(request.by!==actor.harness.identity || request.sessionId!==actor.harness.sessionId || request.head!==record.head || request.pr!==record.publishedPr
   || !record.assignments.some(assignment=>assignment.boundary==='local' && assignment.by===request.by && assignment.sessionId===request.sessionId && assignment.head===request.head
    && claims(state,record).some(item=>item.claim.id===assignment.claimId && done(item.claim)))) fail('correction requires the actual acknowledged assigned independent reviewer');
  const report=validateActivationReport(localSnapshot(root,record.head).read(ACTIVATION_REPORT));
  if(!Array.isArray(request.indices) || !request.indices.length || request.indices.some(index=>report.observations[index]?.status!=='pending')) fail('correction requires genuinely pending observations');
  if(record.correction?.status==='requested') fail('correction request already recorded');
  record.correction={...request,status:'requested',correctedHead:null};
  return {actionable:false,correction:record.correction};
 }
 const item=Object.values(state.reviews).find(item=>item.claim.id===claimId && item.repository===REPOSITORY && (item.release==='activation-evidence' || item.pr===record.publishedPr));
 if(!item) fail('review claim is absent');
 const host=item.pr!==undefined,boundary=host?'host':'local';
 if(item.head!==record.head || item.invalidated || !(host?record.hostReady:record.localReady)) fail('claim belongs to stale or absent readiness');
 if(host) {assertLocalReleaseGate(state,record);observeReleasePull(record,observed);}
 const identity=target(record,host),purpose=host?'publish-completed-verdicts':'independent-review';
 if(operation==='review-claim') {
  if(!developer) fail('dispatch actor differs from prepared developer');
  if(item.claim.status!=='queued') fail('claim replay is forbidden; claim is not queued');
  if(!host && item.role==='appsec' && record.localReviews[0]?.role!=='code_reviewer') fail('Staff review must precede AppSec dispatch');
  const assignment=observed('assignment',{...identity,role:item.role,claimId,purpose});
  exactReleaseKeys(assignment,['role','by','sessionId','head','operationId']);
  if(assignment.role!==item.role || assignment.head!==record.head || typeof assignment.operationId!=='string' || !assignment.operationId.trim()) fail('observed assignment differs from role/head');
  if(!host) {
   independent(record,assignment.by,assignment.sessionId);
   if(record.assignments.some(a=>a.boundary==='local' && a.head===record.head && (normalized(a.by)===normalized(assignment.by) || a.sessionId===assignment.sessionId))) fail('Staff and AppSec require distinct independent sessions');
  }
  const result=schedule(state,{type:'claim',...identity,claimId,reviewerIdentity:assignment.by,operationId:assignment.operationId});
  record.assignments.push({boundary,...assignment,claimId});
  return {actionable:true,purpose,dispatch:result.dispatches[0],...(host?{verdict:record.localReviews.find(review=>review.role===item.role)}:{})};
 }
 const assignment=record.assignments.find(item=>item.claimId===claimId);
 if(!assignment) fail('durable observed assignment is missing');
 if(operation==='review') {
  if(host || !done(item.claim)) fail('actual verdict requires acknowledged local dispatch');
  const review=observed('review',{...identity,role:item.role,claimId});
  exactReleaseKeys(review,['role','by','sessionId','head','claimId','verdict','evidence','observedAt']);
  if(review.by!==actor.harness.identity || review.sessionId!==actor.harness.sessionId || review.by!==assignment.by || review.sessionId!==assignment.sessionId
   || review.head!==record.head || review.claimId!==claimId || review.role!==item.role || !['approved','changes-requested'].includes(review.verdict)
   || typeof review.evidence!=='string' || !review.evidence.trim() || typeof review.observedAt!=='string' || !Number.isFinite(Date.parse(review.observedAt))) fail('actual independently observed reviewer verdict required');
  if(review.verdict==='changes-requested') {
   record.lastReview=review;
   record.localReviews=[];record.localReady=false;record.hostReady=false;record.qa=null;record.phase='active';
   return {actionable:false,phase:record.phase,verdict:review};
  }
  const prior=record.localReviews.find(v=>v.claimId===claimId);
  if(prior) {if(!equal(prior,review)) fail('completed verdict cannot be replaced');return {actionable:false,phase:record.phase};}
  if(ROLES[record.localReviews.length]!==review.role) fail('Staff then AppSec review order required');
  record.lastReview=review;record.localReviews.push(review);record.phase=record.localReviews.length===2?'locally-reviewed':'local-review-ready';
  return {actionable:false,phase:record.phase};
 }
 if(!developer) fail('delivery actor differs from prepared developer');
 if(operation==='review-uncertain') {
  schedule(state,{type:'claim',...identity,claimId,reviewerIdentity:assignment.by,operationId:assignment.operationId,uncertain:true});
  return {actionable:false,purpose};
 }
 if(!['review-ack','review-reconcile'].includes(operation)) fail('unsupported review controller operation');
 const delivery=observed('delivery',{...identity,...assignment,purpose});
 exactReleaseKeys(delivery,host?['role','by','sessionId','head','pr','operationId','result']:['role','by','sessionId','head','operationId','result']);
 if(host && delivery.pr!==record.publishedPr) fail('publication receipt must bind actual PR2');
 if(delivery.role!==assignment.role || delivery.by!==assignment.by || delivery.sessionId!==assignment.sessionId || delivery.head!==record.head || delivery.operationId!==assignment.operationId || delivery.result!=='succeeded') fail('actual delivery does not match assigned claim');
 schedule(state,{type:operation==='review-ack'?'ack':'reconcile',...identity,claimId,...(operation==='review-reconcile'?{observed:{operationId:delivery.operationId,reviewerIdentity:delivery.by,role:delivery.role,head:delivery.head}}:{})});
 return {actionable:false,purpose};
}
