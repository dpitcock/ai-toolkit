import test from 'node:test';
import assert from 'node:assert/strict';
import * as release from '../scripts/lib/release-verification-reviews.mjs';
import {applyReviewEvent} from '../scripts/lib/review-scheduling.mjs';

test('release restart integrity rejects lost claims and mismatched durable assignments',()=>{
 assert.equal(typeof release.assertReleaseReviewState,'function');
 const identity={repository:'dpitcock/ai-toolkit',epic:'EPIC-006',release:'activation-evidence',head:'a'.repeat(40)};
 const empty={version:1,reviews:{},epics:{},dispatches:{},authorizations:{}};
 const record={head:identity.head,publishedPr:null,localReady:{head:identity.head},hostReady:false,assignments:[]};
 assert.throws(()=>release.assertReleaseReviewState(empty,record),/missing|corrupt/);
 const state=applyReviewEvent(empty,{type:'ready',...identity,roles:['code_reviewer','appsec']}).state;
 release.assertReleaseReviewState(state,record);
 const item=Object.values(state.reviews)[0];
 const claimed=applyReviewEvent(state,{type:'claim',...identity,claimId:item.claim.id,reviewerIdentity:'independent-staff',operationId:'dispatch-staff'}).state;
 assert.throws(()=>release.assertReleaseReviewState(claimed,record),/assignment/);
 record.assignments=[{boundary:'local',role:'code_reviewer',head:identity.head,claimId:item.claim.id,by:'independent-staff',sessionId:'staff-session',operationId:'dispatch-staff'}];
 release.assertReleaseReviewState(claimed,record);
 record.assignments[0].operationId='different-dispatch';assert.throws(()=>release.assertReleaseReviewState(claimed,record),/assignment/);
});

test('numeric delivery IDs use persisted sequence rather than object key order',()=>{
 const head='b'.repeat(40),first='a'.repeat(40),observedAt=new Date().toISOString();
 const record={id:'activation-evidence',head,developer:'dev',developerSession:'dev-session',publishedPr:null,localReady:false,hostReady:false,assignments:[],localReviews:[],actions:{
  4:{id:'4',sequence:1,operation:'commit',status:'acknowledged',receipt:{head:first}},
  3:{id:'3',sequence:2,operation:'push',status:'acknowledged',receipt:{head:first}},
  2:{id:'2',sequence:3,operation:'commit',status:'acknowledged',receipt:{head}},
  1:{id:'1',sequence:4,operation:'push',status:'acknowledged',receipt:{head}},
 }};
 const qa={head,by:'qa',sessionId:'qa-session',verdict:'accepted',evidence:'Two independently meaningful increments',observedAt,increments:[{commitId:'4',pushId:'3',head:first,evidence:'activation'},{commitId:'2',pushId:'1',head,evidence:'smoke'}],preReadinessDispatches:0,routineConfirmations:0,routineStaffAuthorizations:0};
 const state={version:1,reviews:{},epics:{},dispatches:{},authorizations:{}};
 const result=release.readyReleaseReviews(state,record,{harness:{identity:'dev',sessionId:'dev-session'}},()=>qa);
 assert.equal(result.claims.length,2);
});
