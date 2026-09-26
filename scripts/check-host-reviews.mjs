#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {assertSameHead,evaluateChecks,evaluateReviews} from './lib/review-evidence.mjs';
import {trustedPolicyAdoptionGate} from './lib/epic-policy-adoption.mjs';

function fail(message) { throw new Error(`Host review gate failed: ${message}`); }
function argument(name,args=process.argv) {
  const index=args.indexOf(name),value=index<0?null:args[index+1];
  if(index<0 || typeof value!=='string' || !value.trim() || value.startsWith('--')) fail(`${name} is required`);
  return value;
}
function jsonArgument(name,args) {
  try { return JSON.parse(argument(name,args)); } catch { fail(`${name} must be JSON`); }
}
function stringArray(value,label) {
  if(!Array.isArray(value) || !value.length || value.some(item=>typeof item!=='string' || !item.trim()) || new Set(value).size!==value.length) {
    fail(`${label} must be a non-empty array of unique strings`);
  }
  return value.map(item=>item.trim());
}
function gh(args,{paginated=false}={}) {
  try { return execFileSync('gh',['api',...(paginated?['--paginate','--slurp']:[]),...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
  catch { fail('authenticated gh api request failed'); }
}
function json(raw,label) {
  try { return JSON.parse(raw); } catch { fail(`${label} returned invalid JSON`); }
}
function paginated(raw,label) {
  const result=json(raw,label);
  if(!Array.isArray(result) || result.some(page=>!Array.isArray(page))) fail(`${label} did not return paginated arrays`);
  return result.flat();
}
function pull(repository,pr) {
  const value=json(gh([`repos/${repository}/pulls/${pr}`]),'pull request');
  if(typeof value?.head?.sha!=='string') fail('pull request head is unavailable');
  return value.head.sha;
}

function trustedApi() {
  return {
    pull:(repository,pr)=>pull(repository,pr),
    reviews:(repository,pr)=>paginated(gh([`repos/${repository}/pulls/${pr}/reviews?per_page=100`],{paginated:true}),'reviews'),
    checks:(repository,head)=>{
      const pages=json(gh([`repos/${repository}/commits/${head}/check-runs?per_page=100`],{paginated:true}),'check runs');
      if(!Array.isArray(pages) || pages.some(page=>!Array.isArray(page?.check_runs))) fail('check runs did not return paginated data');
      const checks=pages.flatMap(page=>page.check_runs);
      for(const check of checks.filter(check=>check.name==='gates').sort((a,b)=>a.id-b.id).slice(-1)) {
        const suite=check.check_suite?.id;
        if(!Number.isSafeInteger(suite) || suite<1) fail('check suite provenance is missing');
        const runs=json(gh([`repos/${repository}/actions/runs?check_suite_id=${suite}&per_page=100`],{paginated:true}),'workflow runs');
        if(!Array.isArray(runs) || runs.some(page=>!Array.isArray(page.workflow_runs))) fail('workflow runs are malformed');
        const matches=runs.flatMap(page=>page.workflow_runs).filter(run=>run.check_suite_id===suite);
        if(matches.length!==1) fail('check suite workflow provenance is ambiguous');
        const run=matches[0];
        if(run.path!=='.github/workflows/workflow.yml' || run.repository?.full_name!==repository
          || !['push','pull_request'].includes(run.event) || run.status!=='completed' || run.conclusion!=='success') {
          fail('required check has untrusted or incomplete workflow provenance');
        }
        assertSameHead(run.head_sha,head);
      }
      return checks;
    },
  };
}

function requiredCheckReceipts(checks,names,head) {
  const selected=names.map(name=>{
    const matches=checks.filter(check=>check.name===name);
    if(!matches.length) fail(`required check is missing: ${name}`);
    for(const check of matches) {
      assertSameHead(check.head_sha,head);
      if(check.app?.id!==15368 || check.app?.slug!=='github-actions') fail(`check ${name} has untrusted app provenance`);
      if(!Number.isSafeInteger(check.id) || check.id<1) fail('check ID is malformed');
    }
    const latest=matches.sort((a,b)=>a.id-b.id).at(-1);
    if(latest.conclusion!=='success') fail(`check ${name} is pending or did not pass`);
    return latest;
  });
  return evaluateChecks({head,checks:selected});
}

/**
 * Revalidates live GitHub evidence for one PR head. The injected API exists
 * solely for unit tests; the executable CLI always supplies trustedApi().
 */
export function evaluateHostReviewGate({repository,pr,head,stage,requiredRoles,identities,requiredChecks,plan,api}={}) {
  if(typeof repository!=='string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail('repository must be owner/name');
  if(!Number.isInteger(pr) || pr<1) fail('PR must be a positive integer');
  const checksRequired=stringArray(requiredChecks,'required checks');
  if(!api || typeof api.pull!=='function' || typeof api.reviews!=='function' || typeof api.checks!=='function') fail('trusted host API is required');

  // A review event does not carry authority. Each delivery is re-evaluated
  // against the same explicit SHA before and after all remote reads.
  assertSameHead(api.pull(repository,pr),head);
  const checks=requiredCheckReceipts(api.checks(repository,head),checksRequired,head);
  assertSameHead(api.pull(repository,pr),head);
  const result=evaluateReviews({stage,head,requiredRoles,identities,reviews:api.reviews(repository,pr),plan});
  assertSameHead(api.pull(repository,pr),head);
  return {repository,pr,head:head.toLowerCase(),checks,receipts:result.receipts};
}

export function runHostReviewGate(args=process.argv.slice(2)) {
  if(args.length===0) fail('arguments are required');
  const repository=argument('--repository',args);
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail('repository must be owner/name');
  // gh resolves local credential-store authentication itself. CI supplies its
  // scoped GH_TOKEN; never retrieve or print either credential source here.
  if(args.includes('--verify-merged')) {
    if(args.includes('--publish')) fail('choose one publishing mode');
    return publishGate(repository,args,{verifyMerged:true});
  }
  if(args.includes('--publish')) return publishGate(repository,args);
  const pr=argument('--pr',args);
  if(!/^\d+$/.test(pr) || Number(pr)<1) fail('--pr must be a positive integer');
  const stage=argument('--stage',args);
  const result=evaluateHostReviewGate({
    repository,pr:Number(pr),head:argument('--head',args),stage,
    requiredRoles:jsonArgument('--required-roles',args),identities:jsonArgument('--identities',args),
    requiredChecks:jsonArgument('--required-checks',args),
    plan:stage==='plan'?jsonArgument('--plan',args):undefined,api:trustedApi(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

// The workflow invokes this from trusted default-branch code only. An event
// is merely a wakeup: enumerate live PRs so fork workflow payload omissions,
// duplicate deliveries, and stale event heads cannot select stale evidence.
function publishGate(repository,args,{verifyMerged=false}={}) {
  let explicitPr;
  if(verifyMerged || args.includes('--pr')) {
    const value=argument('--pr',args);
    if(!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) fail('PR must be a positive integer');
    explicitPr=Number(value);
  }
  const prs=explicitPr?[explicitPr]:paginated(
    gh([`repos/${repository}/pulls?state=open&base=main&per_page=100`],{paginated:true}),'pull requests').map(pr=>pr.number);
  const errors=[];
  for(const pr of prs) {
    if(!Number.isSafeInteger(pr) || pr<1) fail('PR must be a positive integer');
    let head;
    const publish=state=>gh([`repos/${repository}/statuses/${head}`,'--method','POST','-f',`state=${state}`,
      '-f','context=host-review-gate','-f',`description=${verifyMerged?'Integrated publisher verification (diagnostic)':'Current-head host review gate'}: ${state}`]);
    try {
      const current=json(gh([`repos/${repository}/pulls/${pr}`]),'pull request');
      if(current.base?.ref!=='main' || current.base?.repo?.full_name!==repository) fail('PR is outside the trusted main gate');
      if(verifyMerged ? current.state!=='closed' || current.merged!==true : current.state!=='open') fail('PR is outside the selected open/merged gate');
      head=current.head?.sha;
      assertSameHead(head,head);
      publish('pending');
      const roles=jsonArgument('--required-roles',args);
      if(!Array.isArray(roles) || !roles.includes('code_reviewer') || !roles.includes('appsec')) fail('final code reviewer and AppSec are mandatory');
      // Owner-managed role maps cannot remove these final-review floors.
      // Compare CI definitions to trusted main. Workflow changes require the
      // existing independent bootstrap/maintenance path, never self-validation.
      const defaultBranch=json(gh([`repos/${repository}`]),'repository').default_branch;
      if(defaultBranch!=='main') fail('trusted default branch must be main');
      const integration=verifyMerged?integratedSnapshot(repository,current):null;
      for(const file of ['workflow.yml','review-gates.yml']) {
        const blob=ref=>json(gh([`repos/${repository}/contents/.github/workflows/${file}?ref=${ref}`]),'workflow').sha;
        const trusted=blob(integration?.mainSha??defaultBranch);
        if(typeof trusted!=='string' || trusted!==blob(head)) fail('candidate workflow differs from trusted default branch');
      }
      const adoption=verifyMerged?null:trustedPolicyAdoptionGate({root:process.cwd(),repository,pull:current});
      const result=adoption??evaluateHostReviewGate({repository,pr,head,stage:'final',requiredRoles:roles,
        identities:jsonArgument('--identities',args),requiredChecks:['gates'],api:trustedApi()});
      if(integration) recheckIntegration(repository,pr,head,integration);
      publish('success');
      // Close a head change during publication by revoking this snapshot.
      assertSameHead(pull(repository,pr),head);
      if(adoption) trustedPolicyAdoptionGate({root:process.cwd(),repository,pull:json(gh([`repos/${repository}/pulls/${pr}`]),'pull request')});
      if(integration) recheckIntegration(repository,pr,head,integration);
      const receipt=integration?{...result,kind:'integrated-host-gate-verification',diagnostic:true,
        submittedHead:head,...integration,statusContext:'host-review-gate',workflowRunId:process.env.GITHUB_RUN_ID??null}:result;
      process.stdout.write(`${JSON.stringify(receipt)}\n`);
    } catch(error) {
      if(typeof head==='string' && /^[a-f0-9]{40}$/i.test(head)) publish('failure');
      errors.push(`PR ${pr}: ${error.message}`);
    }
  }
  if(errors.length) fail(errors.join('; '));
}

// Integration SHA is GitHub's merge result, which can differ from submitted
// head after squash/rebase. This receipt verifies the publisher, not release
// completion or permission to merge any PR.
function integratedSnapshot(repository,current) {
  const integrationSha=current.merge_commit_sha;
  assertSameHead(integrationSha,integrationSha);
  const mainSha=json(gh([`repos/${repository}/commits/main`]),'main commit').sha;
  assertSameHead(mainSha,mainSha);
  const comparison=json(gh([`repos/${repository}/compare/${integrationSha}...${mainSha}`]),'integration comparison');
  if(!['ahead','identical'].includes(comparison.status)
    || comparison.base_commit?.sha!==integrationSha || comparison.merge_base_commit?.sha!==integrationSha) {
    fail('merged integration is not contained in current main');
  }
  return {integrationSha,mainSha};
}

function recheckIntegration(repository,pr,head,expected) {
  const current=json(gh([`repos/${repository}/pulls/${pr}`]),'merged pull request');
  if(current.state!=='closed' || current.merged!==true || current.base?.ref!=='main'
    || current.base?.repo?.full_name!==repository) fail('merged PR state changed');
  assertSameHead(current.head?.sha,head);
  assertSameHead(current.merge_commit_sha,expected.integrationSha);
  const snapshot=integratedSnapshot(repository,current);
  assertSameHead(snapshot.mainSha,expected.mainSha);
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href) {
  try { runHostReviewGate(); } catch(error) { process.stderr.write(`check-host-reviews: ${error.message}\n`);process.exitCode=1; }
}
