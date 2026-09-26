#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {assertSameHead,evaluateChecks,evaluateReviews} from './lib/review-evidence.mjs';

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
      return pages.flatMap(page=>page.check_runs);
    },
  };
}

function requiredCheckReceipts(receipts,names) {
  const actual=new Set(receipts.map(receipt=>receipt.name));
  for(const name of names) if(!actual.has(name)) fail(`required check is missing: ${name}`);
  return receipts;
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
  const checks=requiredCheckReceipts(evaluateChecks({head,checks:api.checks(repository,head)}),checksRequired);
  assertSameHead(api.pull(repository,pr),head);
  const result=evaluateReviews({stage,head,requiredRoles,identities,reviews:api.reviews(repository,pr),plan});
  assertSameHead(api.pull(repository,pr),head);
  return {repository,pr,head:head.toLowerCase(),checks,receipts:result.receipts};
}

export function runHostReviewGate(args=process.argv.slice(2)) {
  if(args.length===0) fail('arguments are required');
  const repository=argument('--repository',args);
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

if(import.meta.url===new URL(`file://${process.argv[1]}`).href) {
  try { runHostReviewGate(); } catch(error) { process.stderr.write(`check-host-reviews: ${error.message}\n`);process.exitCode=1; }
}
