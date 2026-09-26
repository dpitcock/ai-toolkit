import test from 'node:test';
import assert from 'node:assert/strict';
import {observeEpicIntegration} from '../scripts/lib/epic-integration.mjs';

const head='b'.repeat(40);
const receipt={repository:'fixture/repo',epic:'EPIC-999',pullRequest:7,integrationSha:head,host:{smoke:{revision:head,result:'passed'}}};
function fixture() {
 const pull={merged:true,merge_commit_sha:head,base:{ref:'main',repo:{full_name:'fixture/repo'}}};
 const check={id:1,name:'gates',head_sha:head,status:'completed',conclusion:'success',app:{id:15368,slug:'github-actions'},check_suite:{id:4}};
 const data={pull,head,checks:[check],open:[],run:{check_suite_id:4,path:'.github/workflows/workflow.yml',repository:{full_name:'fixture/repo'},event:'push',status:'completed',conclusion:'success',head_sha:head}};
 const calls=[];
 const api=(endpoint,{paginate=false}={})=>{
  calls.push(endpoint);
  if(endpoint.endsWith('/pulls/7')) return data.pull;
  if(endpoint.endsWith('/git/ref/heads/main')) return {object:{sha:data.head}};
  if(endpoint.includes('/check-runs?')) {assert.equal(paginate,true);return [{check_runs:data.checks}];}
  if(endpoint.includes('/actions/runs?')) return [{workflow_runs:[data.run]}];
  if(endpoint.includes('/pulls?')) {assert.equal(paginate,true);return [data.open];}
  throw new Error(`Unexpected ${endpoint}`);
 };
 return {data,calls,api};
}
test('fresh host admission verifies merged PR, main, exact checks and workflow provenance',()=>{
 const f=fixture(),result=observeEpicIntegration(receipt,{api:f.api});
 assert.equal(result.integrationSha,head);assert.equal(result.source,'authenticated-github-api');
 assert.equal(f.calls.filter(value=>value.endsWith('/pulls/7')).length,2);
 assert.equal(f.calls.filter(value=>value.endsWith('/git/ref/heads/main')).length,2);
});
test('host admission rejects unmerged, changed main, pending/forged checks and corrective PRs',()=>{
 const mutations=[f=>{f.pull.merged=false;},f=>{f.head='c'.repeat(40);},f=>{f.checks[0].status='in_progress';},f=>{f.checks[0].app.id=9;},f=>{f.run.path='untrusted.yml';},f=>{f.open=[{head:{ref:'epic/EPIC-999'}}];},f=>{f.checks=[];}];
 for(const mutate of mutations) {const f=fixture();mutate(f.data);assert.throws(()=>observeEpicIntegration(receipt,{api:f.api}));}
});
test('host errors and a main race fail closed',()=>{
 assert.throws(()=>observeEpicIntegration(receipt,{api:()=>{throw new Error('Unavailable');}}),/Unavailable/);
 const f=fixture();let mainReads=0;
 assert.throws(()=>observeEpicIntegration(receipt,{api:(endpoint,options)=>{if(endpoint.endsWith('/git/ref/heads/main') && ++mainReads===2) f.data.head='c'.repeat(40);return f.api(endpoint,options);}}),/integration|main/i);
});
