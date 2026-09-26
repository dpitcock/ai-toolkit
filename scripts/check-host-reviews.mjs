#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {assertSameHead,evaluateReviews} from './lib/review-evidence.mjs';

function fail(message) { throw new Error(`Host review gate failed: ${message}`); }
function argument(name) {
  const index=process.argv.indexOf(name),value=index<0?null:process.argv[index+1];
  if(index<0 || typeof value!=='string' || !value.trim() || value.startsWith('--')) fail(`${name} is required`);
  return value;
}
function jsonArgument(name) {
  try { return JSON.parse(argument(name)); } catch { fail(`${name} must be JSON`); }
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

const repository=argument('--repository');
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail('--repository must be owner/name');
const pr=argument('--pr');
if(!/^\d+$/.test(pr) || Number(pr)<1) fail('--pr must be a positive integer');
const expectedHead=argument('--head');
const stage=argument('--stage');
const requiredRoles=jsonArgument('--required-roles');
const identities=jsonArgument('--identities');
const plan=stage==='plan'?jsonArgument('--plan'):undefined;

// The CLI never accepts review snapshots: only authenticated gh api output can
// supply merge-authorizing evidence. No token is read, passed, or printed.
assertSameHead(pull(repository,pr),expectedHead);
const reviews=paginated(gh([`repos/${repository}/pulls/${pr}/reviews?per_page=100`],{paginated:true}),'reviews');
const checkPages=json(gh([`repos/${repository}/commits/${expectedHead}/check-runs?per_page=100`],{paginated:true}),'check runs');
if(!Array.isArray(checkPages) || checkPages.some(page=>!Array.isArray(page?.check_runs))) fail('check runs did not return paginated data');
const checks=checkPages.flatMap(page=>page.check_runs);
assertSameHead(pull(repository,pr),expectedHead);
const result=evaluateReviews({stage,head:expectedHead,requiredRoles,identities,reviews,plan});
assertSameHead(pull(repository,pr),expectedHead);
process.stdout.write(`${JSON.stringify({repository,pr:Number(pr),head:expectedHead.toLowerCase(),checks:checks.map(check=>({id:check.id,name:check.name,status:check.status,conclusion:check.conclusion})),receipts:result.receipts})}\n`);
