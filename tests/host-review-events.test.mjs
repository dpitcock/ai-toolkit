import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {evaluateHostReviewGate} from '../scripts/check-host-reviews.mjs';

const head='a'.repeat(40);
const changedHead='b'.repeat(40);
const identities={
  code_reviewer:{actor:'staff',kind:'human',provenance:{source:'gh-identity',id:'staff-map'},roleEvidence:true},
  appsec:{actor:'security',kind:'human',provenance:{source:'gh-identity',id:'security-map'},roleEvidence:true},
};
function review(id,actor,state='APPROVED',commit_id=head) {
  return {id,user:{login:actor,type:'User'},state,commit_id,submitted_at:`2026-09-26T12:00:0${id}Z`};
}
function gateway({heads=[head,head,head],reviews=[review(1,'staff'),review(2,'security')],checks=[{id:1,name:'workflow / gates',status:'completed',conclusion:'success'}]}={}) {
  let index=0;
  return {pull:()=>heads[Math.min(index++,heads.length-1)],reviews:()=>reviews,checks:()=>checks};
}
function input(overrides={}) {
  return {repository:'owner/repo',pr:1,head,stage:'final',requiredRoles:['code_reviewer','appsec'],identities,requiredChecks:['workflow / gates'],...overrides};
}

test('re-evaluates a duplicate or out-of-order event against the same exact head',()=>{
  const first=evaluateHostReviewGate({...input(),api:gateway()});
  const duplicate=evaluateHostReviewGate({...input(),api:gateway()});
  assert.deepEqual(duplicate,first);
  assert.equal(first.head,head);
});

test('head races, approval dismissal, and identity mismatches fail closed',()=>{
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({heads:[head,changedHead]})}),/head changed/i);
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({reviews:[review(1,'staff','DISMISSED'),review(2,'security')]})}),/dismissed|approval/i);
  assert.throws(()=>evaluateHostReviewGate({...input({identities:{...identities,appsec:{...identities.appsec,actor:'different'}}}),api:gateway()}),/appsec.*approval/i);
});

test('a missing required status fails closed',()=>{
  assert.throws(()=>evaluateHostReviewGate({...input(),api:gateway({checks:[]})}),/required check.*missing/i);
});

test('trusted workflow runs only base code with scoped permissions',()=>{
  const file=path.resolve('.github/workflows/review-gates.yml');
  const workflow=fs.readFileSync(file,'utf8');
  assert.match(workflow,/pull_request_target:/);
  assert.match(workflow,/pull_request_review:/);
  assert.match(workflow,/types:\s*\[[^\]]*synchronize[^\]]*\]/);
  assert.match(workflow,/ref:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}/);
  assert.match(workflow,/contents:\s*read/);
  assert.match(workflow,/pull-requests:\s*read/);
  assert.match(workflow,/checks:\s*write/);
  assert.doesNotMatch(workflow,/ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/);
  assert.doesNotMatch(workflow,/github\.head_ref/);
});
