import {execFileSync} from 'node:child_process';
import {evaluateChecks} from './review-evidence.mjs';

function fail(message) {throw new Error(`Epic integration ${message}`);}
function github(endpoint,{paginate=false}={}) {
 try {
  return JSON.parse(execFileSync('gh',['api',...(paginate?['--paginate','--slurp']:[]),endpoint],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:8*1024*1024}));
 } catch {fail('authenticated GitHub observation unavailable');}
}
function pages(value,field) {
 if(!Array.isArray(value) || value.some(page=>!Array.isArray(field?page?.[field]:page))) fail('paginated host response is malformed');
 return value.flatMap(page=>field?page[field]:page);
}

// The default observer uses the existing authenticated gh session. No token is
// read or copied. Injected API callbacks belong to the trusted controller/tests.
export function observeEpicIntegration(receipt,{api=github}={}) {
 const {repository,pullRequest,integrationSha,epic}=receipt;
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository??'') || !Number.isSafeInteger(pullRequest) || pullRequest<1 || !/^[a-f0-9]{40}$/.test(integrationSha??'') || !/^EPIC-\d+$/.test(epic??'')) fail('receipt identity is malformed');
 const prefix=`repos/${repository}`;
 const verify=()=>{
  const pull=api(`${prefix}/pulls/${pullRequest}`);
  if(pull?.merged!==true || pull.merge_commit_sha!==integrationSha || pull.base?.ref!=='main' || pull.base?.repo?.full_name!==repository) fail('PR is not the canonical main integration');
  if(api(`${prefix}/git/ref/heads/main`)?.object?.sha!==integrationSha) fail('remote main integration changed');
 };
 verify();
 const all=pages(api(`${prefix}/commits/${integrationSha}/check-runs?per_page=100`,{paginate:true}),'check_runs');
 const candidates=all.filter(check=>check.name==='gates').sort((a,b)=>a.id-b.id);
 const check=candidates.at(-1);
 if(!check || check.head_sha!==integrationSha || check.app?.id!==15368 || check.app?.slug!=='github-actions' || check.conclusion!=='success' || !Number.isSafeInteger(check.check_suite?.id)) fail('required gates check is missing, pending, or untrusted');
 const runs=pages(api(`${prefix}/actions/runs?check_suite_id=${check.check_suite.id}&per_page=100`,{paginate:true}),'workflow_runs').filter(run=>run.check_suite_id===check.check_suite.id);
 if(runs.length!==1 || runs[0].path!=='.github/workflows/workflow.yml' || runs[0].repository?.full_name!==repository || runs[0].head_sha!==integrationSha || !['push','pull_request'].includes(runs[0].event) || runs[0].status!=='completed' || runs[0].conclusion!=='success') fail('integrated check workflow provenance is invalid');
 const checks=evaluateChecks({head:integrationSha,checks:[check]});
 const open=pages(api(`${prefix}/pulls?state=open&base=main&per_page=100`,{paginate:true}));
 if(open.some(pull=>pull.head?.ref===`epic/${epic}`)) fail('corrective PR keeps the epic active');
 verify();
 return {source:'authenticated-github-api',observedAt:new Date().toISOString(),repository,pullRequest,integrationSha,mergeCommit:integrationSha,checks,smoke:receipt.host.smoke};
}
