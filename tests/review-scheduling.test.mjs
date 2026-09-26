import assert from 'node:assert/strict';
import test from 'node:test';
import {applyReviewEvent} from '../scripts/lib/review-scheduling.mjs';

function state() {
  return {version:1,authorizations:{},dispatches:{},reviews:{},epics:{}};
}

function event(type,fields={}) {
  return {type,repository:'agent-canvas',pr:17,head:'a'.repeat(40),...fields};
}

function ready(current,fields={}) {
  return applyReviewEvent(current,event('ready',{roles:['staff'],...fields}));
}

function onlyClaim(current) {
  const claims=Object.values(current.reviews);
  assert.equal(claims.length,1);
  return claims[0].claim;
}

test('a push only invalidates old-head readiness and never dispatches a reviewer',()=>{
  const initial=ready(state()).state;
  const pushed=applyReviewEvent(initial,event('push',{head:'b'.repeat(40)}));
  assert.deepEqual(pushed.dispatches,[]);
  assert.equal(onlyClaim(pushed.state).status,'queued');
  assert.equal(Object.values(pushed.state.reviews)[0].ready,false);
  assert.equal(Object.values(pushed.state.reviews)[0].invalidated,true);
});

test('duplicate readiness produces one immutable claim per repository PR role and head',()=>{
  const first=ready(state());
  const second=ready(first.state);
  assert.equal(Object.keys(second.state.reviews).length,1);
  const claim=onlyClaim(second.state);
  assert.match(claim.id,/^[0-9a-f-]{36}$/i);
  assert.equal(claim.status,'queued');
  assert.deepEqual(second.dispatches,[]);
  assert.equal(onlyClaim(first.state).id,claim.id);
});

test('parallel claim attempts serialize and dispatch only the winner',()=>{
  const queued=ready(state()).state;
  const claim=onlyClaim(queued);
  const claimed=applyReviewEvent(queued,event('claim',{
    claimId:claim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',
  }));
  assert.equal(onlyClaim(claimed.state).status,'claimed');
  assert.equal(claimed.dispatches.length,1);
  assert.throws(()=>applyReviewEvent(claimed.state,event('claim',{
    claimId:claim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',
  })),/not queued/i);
});

test('an ambiguous dispatch remains uncertain until matching observed external evidence reconciles it',()=>{
  const queued=ready(state()).state;
  const claim=onlyClaim(queued);
  const claimed=applyReviewEvent(queued,event('claim',{
    claimId:claim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',
  })).state;
  const uncertain=applyReviewEvent(claimed,event('claim',{
    claimId:claim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',uncertain:true,
  }));
  assert.equal(onlyClaim(uncertain.state).status,'uncertain');
  assert.deepEqual(uncertain.dispatches,[]);
  assert.throws(()=>applyReviewEvent(uncertain.state,event('reconcile',{
    claimId:claim.id,observed:{operationId:'other',reviewerIdentity:'staff-reviewer',role:'staff',head:'a'.repeat(40)},
  })),/observed.*match/i);
  const reconciled=applyReviewEvent(uncertain.state,event('reconcile',{
    claimId:claim.id,observed:{operationId:'dispatch-17',reviewerIdentity:'staff-reviewer',role:'staff',head:'a'.repeat(40)},
  }));
  assert.equal(onlyClaim(reconciled.state).status,'reconciled');
  assert.deepEqual(reconciled.dispatches,[]);
});

test('wrong and replayed acknowledgements fail',()=>{
  const queued=ready(state()).state;
  const claim=onlyClaim(queued);
  const claimed=applyReviewEvent(queued,event('claim',{
    claimId:claim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',
  })).state;
  assert.throws(()=>applyReviewEvent(claimed,event('ack',{claimId:'00000000-0000-4000-8000-000000000000'})),/claim ID/i);
  const acknowledged=applyReviewEvent(claimed,event('ack',{claimId:claim.id}));
  assert.equal(onlyClaim(acknowledged.state).status,'acknowledged');
  assert.throws(()=>applyReviewEvent(acknowledged.state,event('ack',{claimId:claim.id})),/not claimed/i);
});

test('an old-head acknowledgement cannot approve a newly ready head',()=>{
  const queued=ready(state()).state;
  const oldClaim=onlyClaim(queued);
  const claimed=applyReviewEvent(queued,event('claim',{
    claimId:oldClaim.id,reviewerIdentity:'staff-reviewer',operationId:'dispatch-17',
  })).state;
  const pushed=applyReviewEvent(claimed,event('push',{head:'b'.repeat(40)})).state;
  const current=ready(pushed,{head:'b'.repeat(40)}).state;
  const newClaim=Object.values(current.reviews).find(record=>record.head==='b'.repeat(40)).claim;
  assert.throws(()=>applyReviewEvent(current,event('ack',{claimId:oldClaim.id})),/stale head/i);
  assert.equal(newClaim.status,'queued');
});

test('missing or corrupt state blocks review progression',()=>{
  assert.throws(()=>ready(undefined),/state/i);
  assert.throws(()=>ready({version:1,reviews:[]} ),/reviews/i);
  assert.throws(()=>ready({version:1,reviews:{bad:{repository:'agent-canvas'}}}),/Review scheduling/);
});
