import assert from 'node:assert/strict';
import test from 'node:test';
import {assertSameHead,evaluateChecks,evaluateReviews} from '../scripts/lib/review-evidence.mjs';

const head='a'.repeat(40);
const oldHead='b'.repeat(40);

function identity(actor,roleEvidence=true) {
  return {actor,kind:'human',provenance:{source:'gh-identity',id:`mapping-${actor}`},roleEvidence};
}

function review(id,actor,state='APPROVED',commit_id=head) {
  return {id,user:{login:actor,type:'User'},state,commit_id,submitted_at:`2026-09-26T12:00:0${id}Z`};
}

function input(overrides={}) {
  return {
    stage:'final',head,requiredRoles:['code_reviewer','appsec'],
    identities:{code_reviewer:identity('staff'),appsec:identity('security')},
    reviews:[review(1,'staff'),review(2,'security')],
    ...overrides,
  };
}

test('accepts current-head mapped approvals and returns host-bound receipts',()=>{
  const result=evaluateReviews(input());
  assert.equal(result.approved,true);
  assert.deepEqual(result.receipts.map(receipt=>receipt.role),['code_reviewer','appsec']);
  assert.ok(result.receipts.every(receipt=>receipt.reviewedSha===head && receipt.verdict==='APPROVED'));
});

test('reads all paginated pages and rejects outdated approvals',()=>{
  const paginated=[[review(1,'staff','APPROVED',oldHead)],[review(2,'security')]];
  assert.throws(()=>evaluateReviews(input({reviews:paginated})),/current head|approval/i);
});

test('dismissed and unresolved changes-requested verdicts block',()=>{
  assert.throws(()=>evaluateReviews(input({reviews:[review(1,'staff','DISMISSED'),review(2,'security')]})),/dismissed|approval/i);
  assert.throws(()=>evaluateReviews(input({reviews:[review(1,'staff','CHANGES_REQUESTED'),review(2,'security')]})),/changes requested/i);
});

test('wrong actor and human/bot confusion cannot satisfy a mapped role',()=>{
  assert.throws(()=>evaluateReviews(input({reviews:[review(1,'other'),review(2,'security')]})),/code_reviewer.*approval/i);
  const bot=review(1,'staff');bot.user.type='Bot';
  assert.throws(()=>evaluateReviews(input({reviews:[bot,review(2,'security')]})),/human/i);
});

test('one actor cannot satisfy distinct roles without explicit role evidence',()=>{
  assert.throws(()=>evaluateReviews(input({
    identities:{code_reviewer:identity('staff',false),appsec:identity('staff',false)},
    reviews:[review(1,'staff'),review(2,'staff')],
  })),/reused.*role evidence/i);
});

test('stage order and plan receipts fail closed on invalid scope or unresolved requests',()=>{
  assert.throws(()=>evaluateReviews(input({stage:'plan',requiredRoles:['appsec','principal'],identities:{principal:identity('principal'),appsec:identity('security')},reviews:[review(1,'principal'),review(2,'security')]})),/order/i);
  assert.throws(()=>evaluateReviews(input({stage:'plan',requiredRoles:['principal','appsec'],identities:{principal:identity('principal'),appsec:identity('security')},reviews:[review(1,'principal'),review(2,'security')],plan:{id:'P',revision:1,reviewedSha:head,unresolvedRequests:['review-1']}})),/unresolved/i);
});

test('a head race fails before a host verdict can be used',()=>{
  assert.throws(()=>assertSameHead(oldHead,head),/head changed/i);
});

test('pending or failed current checks cannot accompany an approval',()=>{
  assert.throws(()=>evaluateChecks({head,checks:[{id:1,name:'gate',status:'in_progress',conclusion:null}]}),/pending/i);
  assert.throws(()=>evaluateChecks({head,checks:[{id:1,name:'gate',status:'completed',conclusion:'failure'}]}),/did not pass/i);
  assert.deepEqual(evaluateChecks({head,checks:[{id:1,name:'gate',status:'completed',conclusion:'success'}]}),[
    {id:'1',name:'gate',status:'completed',conclusion:'success',head},
  ]);
});
