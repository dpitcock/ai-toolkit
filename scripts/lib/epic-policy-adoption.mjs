import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import YAML from 'yaml';
import {recognizeBootstrapPolicy} from './bootstrap-policy.mjs';
import {parseWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition,canonicalCoordinationRoot} from './workspace-config.mjs';
import {parseWorkspaceHistory} from './workspace-history.mjs';
import {canonicalRepository,githubJSON,hostPages,assertHostFinalization,assertFinalizationSnapshots,localSnapshot,hostSnapshot} from './epic-finalization.mjs';
import {withWorkflowState} from './workflow-state.mjs';
import {validateAdoptionRelation,validateAdoptionRecord} from './policy-adoption-record.mjs';
import {evaluateHostReviewGate} from '../check-host-reviews.mjs';

const REPOSITORY='dpitcock/ai-toolkit',EPIC='EPIC-006',BRANCH='epic/EPIC-006';
const B='553daf9fb49df58e55c3c5a6fbb68df6a0be0a41';
const ASSESSMENT='project/task-assessments/governance-activation.yaml';
const PLAN='epics/EPIC-006/epic-plan.md',CANDIDATE='project/EPIC-006-root-migration.yaml';
const POLICY=['config/workspace-config.yaml','project/workspace-config-history.jsonl'];
const DIGEST='7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd';
function fail(message) {throw new Error(`Policy adoption ${message}`);}
function git(root,args) {return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});}
function sha(value) {if(!/^[a-f0-9]{40}$/.test(value??'')) fail('requires full commit identities');return value;}
function hash(value) {return createHash('sha256').update(value).digest('hex');}
function doc(snapshot,name=PLAN) {
 const raw=snapshot.read(name),match=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!match) fail('canonical document is absent');
 const parsed=YAML.parseDocument(match[1],{uniqueKeys:true});if(parsed.errors.length) fail('canonical document is invalid');
 return parsed.toJS({maxAliasCount:0});
}
function regular(snapshot,name) {
 const entry=snapshot.tree.get(name);if(entry?.mode!=='100644' || entry.type!=='blob') fail(`${name} must be a regular non-executable file`);
 return snapshot.read(name);
}
function fields(before,after,prefix='') {
 const result=[];
 for(const key of new Set([...Object.keys(before??{}),...Object.keys(after??{})])) {
  const name=prefix?`${prefix}.${key}`:key,left=before?.[key],right=after?.[key];
  if(left && right && typeof left==='object' && typeof right==='object' && !Array.isArray(left) && !Array.isArray(right)) result.push(...fields(left,right,name));
  else if(JSON.stringify(left)!==JSON.stringify(right)) result.push(name);
 }
 return result.sort();
}
function merged(pull) {
 if(pull?.state!=='closed' || pull.merged!==true || pull.base?.ref!=='main' || pull.base?.repo?.full_name!==REPOSITORY || pull.head?.ref!==BRANCH) fail('requires a canonical merged epic PR');
 sha(pull.head.sha);sha(pull.merge_commit_sha);return pull;
}
function sameTree(left,right) {if(!equal(left.tree,right.tree)) fail('original merge must preserve the submitted snapshot');}

/** Trusted-base stage discovery only; it never grants adoption authority. */
export function policyAdoptionStage({root,baseSha}={}) {
 const base=localSnapshot(root,sha(baseSha));
 if(!base.tree.has(PLAN)) return null;
 const plan=doc(base);
 if(plan.id!=='EPIC-006-PLAN' || plan.revision!==1 || plan.status!=='merged') return null;
 if(canonicalRepository(root)!==REPOSITORY) return null;
 const config=parseWorkspaceConfig(regular(base,POLICY[0]));
 const record=parseWorkspaceHistory(regular(base,POLICY[1])).at(-1);
 const raw='d58b8020bf9db0f73ab1ddcbe8867106132d3a713491c906a6711373a6eab7ab';
 return workspaceConfigDigest(config)===raw && record?.digest===raw && record.revision===2?'pending':'post-adoption';
}

/** Materialize only observed immutable objects before the pure proof. Fresh CI
 * may lack H0 after PR0 was squashed. This never switches HEAD or executes files.
 */
export function materializePolicyAdoptionHistory({root,baseSha,headSha,api=githubJSON}={}) {
 if(!policyAdoptionStage({root,baseSha})) fail('materialization requires the canonical merged base');
 const marker=doc(localSnapshot(root,baseSha)).pr_url?.match(/^https:\/\/github\.com\/dpitcock\/ai-toolkit\/pull\/([1-9]\d*)$/);
 if(!marker) fail('original PR marker is missing');
 const original=merged(api(`repos/${REPOSITORY}/pulls/${Number(marker[1])}`));
 for(const revision of [original.head.sha,original.merge_commit_sha,headSha]) {
  sha(revision);
  try {git(root,['cat-file','-e',`${revision}^{commit}`]);}
  catch {git(root,['fetch','--no-tags','--no-recurse-submodules','--no-write-fetch-head','https://github.com/dpitcock/ai-toolkit.git',revision]);}
  if(git(root,['rev-parse',`${revision}^{commit}`]).trim()!==revision) fail('materialized commit identity differs');
 }
}

/** Pure committed delta; both submitted and squash/rebase integration call it. */
function delta({root,from,to,candidate,integratedHead}) {
 git(root,['merge-base','--is-ancestor',from,to]);
 const before=localSnapshot(root,from),after=localSnapshot(root,to);
 const changed=[...new Set([...before.tree.keys(),...after.tree.keys()])].filter(name=>!equal(before.tree.get(name),after.tree.get(name))).sort();
 if(!equal(changed,POLICY)) fail('diff must change exactly the two policy files');
 for(const commit of git(root,['rev-list',`${from}..${to}`]).trim().split('\n').filter(Boolean)) {
  const parents=git(root,['show','-s','--format=%P',commit]).trim().split(' ');
  if(parents.length!==1 && !(commit===to && integratedHead && equal(parents,[from,integratedHead]))) fail('unrelated merge in adoption history');
  const paths=git(root,['diff-tree','--root','-m','--no-commit-id','--no-renames','--name-only','-z','-r',commit]).split('\0').filter(Boolean);
  if(paths.some(name=>!POLICY.includes(name))) fail('intermediate commit changes an unauthorized path');
  const snapshot=localSnapshot(root,commit);for(const name of POLICY) regular(snapshot,name);
 }
 const oldText=regular(before,POLICY[0]),configText=regular(after,POLICY[0]);
 if(configText!==candidate) fail('config differs from the exact original reviewed candidate');
 const config=parseWorkspaceConfig(configText),old=parseWorkspaceConfig(oldText);
 if(Object.hasOwn(config,'worktree_overrides') || workspaceConfigDigest(config)!==DIGEST) fail('canonical candidate digest or representation is invalid');
 const prefix=regular(before,POLICY[1]),historyText=regular(after,POLICY[1]);
 const previous=parseWorkspaceHistory(prefix),history=parseWorkspaceHistory(historyText),record=history.at(-1);
 if(!historyText.startsWith(prefix) || history.length!==previous.length+1 || record.kind!=='change' || record.revision!==previous.at(-1).revision+1
  || record.digest!==DIGEST || !equal(record.definition,workspaceTierDefinition(config)) || !equal(record.changes,fields(old,config))) fail('history must append exactly one canonical acceptance with derived changes');
 if(Object.keys(record).sort().join(',')!==['kind','revision','digest','by','date','reason','changes','definition'].sort().join(',')) fail('acceptance contains unsupported fields');
 return {raw:{digest:workspaceConfigDigest(old),revision:previous.at(-1).revision},canonical:{digest:DIGEST,revision:record.revision},definition:record.definition,historyPrefix:hash(prefix),history:hash(historyText),acceptedBy:record.by};
}

/** CI provenance only: never consumes local authority, local reviews, or PR1 checks. */
export function provePolicyAdoption({root,baseSha,headSha,headRef,api=githubJSON,integration}={}) {
 return adoptionChain({root,baseSha,headSha,headRef,api,integration},true);
}

/** Historical chain only. Does not grant publication, integration, or current-main
 * authority. Reconstructs the whole pinned proof from real host/Git facts; live
 * callers still use provePolicyAdoption and cannot supply a historical switch.
 */
export function proveHistoricalPolicyAdoption({root,proof,api=githubJSON}={}) {
 validateAdoptionRelation(proof);
 if(!proof.adoption.integrationSha || !proof.adoption.pr) fail('historical proof requires integrated adoption');
 const actual=adoptionChain({root,baseSha:proof.adoption.base,headSha:proof.adoption.head,headRef:proof.branch,api,
  integration:{pr:proof.adoption.pr,sha:proof.adoption.integrationSha}},false);
 if(!equal(actual,proof)) fail('historical relation differs from observed chain');
 return actual;
}

/** Resolve I from immutable host PR association, never from report-selected lineage. */
export function observeHistoricalPolicyAdoption({root,integrationSha,api=githubJSON}={}) {
 const i=sha(integrationSha),prefix=`repos/${REPOSITORY}`;
 const associated=hostPages(api(`${prefix}/commits/${i}/pulls?per_page=100`,{paginate:true}));
 const matches=associated.map(item=>api(`${prefix}/pulls/${item.number}`)).filter(item=>item?.merged===true && item.merge_commit_sha===i);
 if(matches.length!==1) fail('historical adoption PR identity is ambiguous');
 const pull=merged(matches[0]);
 return adoptionChain({root,baseSha:sha(pull.base.sha),headSha:pull.head.sha,headRef:BRANCH,api,integration:{pr:pull.number,sha:i}},false);
}

function adoptionChain({root,baseSha,headSha,headRef,api,integration},live) {
 if(canonicalRepository(root)!==REPOSITORY || headRef!==BRANCH) fail('repository or branch is outside the bounded route');
 const f=sha(baseSha),h1=sha(headSha),base=localSnapshot(root,f),plan=doc(base);
 if(plan.id!=='EPIC-006-PLAN' || plan.revision!==1 || plan.status!=='merged' || plan.accessibility?.ui!==false) fail('requires the original merged plan revision');
 const match=plan.pr_url?.match(/^https:\/\/github\.com\/dpitcock\/ai-toolkit\/pull\/([1-9]\d*)$/);
 if(!match) fail('original PR marker is missing');
 const pr=Number(match[1]),prefix=`repos/${REPOSITORY}`,original=merged(api(`${prefix}/pulls/${pr}`));
 const h0=original.head.sha,m=original.merge_commit_sha;
 if(f===m) fail('status finalization integration is required before adoption');
 const bootstrap=recognizeBootstrapPolicy({root,baseSha:B,headSha:h0,headRef:BRANCH,assessmentPath:ASSESSMENT});
 if(!bootstrap) fail('original immutable assessment proof is missing');
 sameTree(localSnapshot(root,h0),localSnapshot(root,m));
 const finalization=assertHostFinalization({api,repository:REPOSITORY,epic:EPIC,pr,from:m,to:f});
 assertFinalizationSnapshots({epic:EPIC,repository:REPOSITORY,pr,before:localSnapshot(root,m),after:base});
 for(const name of [PLAN,'epics/EPIC-006/epic.md']) {
  const data=doc(base,name);if(data.status!=='merged' || data.pr_url!==plan.pr_url) fail('both finalization markers must be merged and retain PR0');
 }
 const associated=hostPages(api(`${prefix}/commits/${f}/pulls?per_page=100`,{paginate:true}));
 const finalPRs=associated.filter(item=>item.number!==pr).map(item=>merged(api(`${prefix}/pulls/${item.number}`))).filter(item=>item.merge_commit_sha===f);
 if(finalPRs.length!==1) fail('finalization PR identity is ambiguous');
 const candidate=regular(localSnapshot(root,h0),CANDIDATE);
 if(workspaceConfigDigest(parseWorkspaceConfig(candidate))!==DIGEST) fail('original candidate digest differs from the approved migration');
 const candidateConfig=parseWorkspaceConfig(candidate);
 if(!equal(candidateConfig.approvals_required,bootstrap.root.config.approvals_required) || !equal(candidateConfig.approvals_overrides,bootstrap.root.config.approvals_overrides) || candidateConfig.tier_overrides?.direct_merge!==false) fail('candidate changes old governing review authority');
 const policy=delta({root,from:f,to:h1,candidate});
 if(policy.raw.digest!==bootstrap.linked.accepted.digest || policy.raw.revision!==2 || policy.canonical.revision!==3) fail('old raw policy substitution');
 let adoption={base:f,head:h1,pr:null,integrationSha:null};
 if(integration) {
  const current=merged(api(`${prefix}/pulls/${integration.pr}`));
  if(current.number===pr || current.number===finalPRs[0].number || current.head.sha!==h1 || current.merge_commit_sha!==integration.sha || current.base.sha!==f) fail('adoption integration identity differs');
  const integrated=delta({root,from:f,to:sha(integration.sha),candidate,integratedHead:h1});
  if(!equal(integrated,policy)) fail('submitted and integrated adoption snapshots differ');
  adoption={...adoption,pr:current.number,integrationSha:integration.sha};
 }
 const expectedMain=integration?.sha??f;
 if(live) {
  const open=hostPages(api(`${prefix}/pulls?state=open&base=main&per_page=100`,{paginate:true}));
  if(open.some(item=>item.head?.ref===BRANCH && (integration || item.head.sha!==h1)) || open.filter(item=>item.head?.ref===BRANCH).length>1) fail('unexpected open or second adoption PR');
  if(api(`${prefix}/git/ref/heads/main`)?.object?.sha!==expectedMain) fail('current main advanced beyond the bounded base');
 }
 const again=merged(api(`${prefix}/pulls/${pr}`));if(again.head.sha!==h0 || again.merge_commit_sha!==m) fail('original host identity changed');
 const finalAgain=merged(api(`${prefix}/pulls/${finalPRs[0].number}`));
 if(finalAgain.head.sha!==finalPRs[0].head.sha || finalAgain.merge_commit_sha!==f || (live && api(`${prefix}/git/ref/heads/main`)?.object?.sha!==expectedMain)) fail('finalization/main changed during observation');
 return validateAdoptionRelation({kind:'epic-policy-adoption',version:1,epic:EPIC,repository:REPOSITORY,branch:BRANCH,
  original:{pr,submittedHead:h0,mergeCommit:m},finalization:{pr:finalPRs[0].number,from:m,to:f,paths:finalization.changed},
  assessment:{path:ASSESSMENT,commit:bootstrap.initialEvidenceCommit,digest:hash(localSnapshot(root,h0).read(ASSESSMENT))},plan:{id:plan.id,revision:1},
  candidate:{path:CANDIDATE,blob:localSnapshot(root,h0).tree.get(CANDIDATE).sha,digest:DIGEST,definition:policy.definition},
  policy:{...policy,root:{digest:bootstrap.root.accepted.digest,revision:bootstrap.root.accepted.revision}},adoption});
}

/** Authenticated native head/check observations, never a candidate-provided green result. */
export function evaluatePolicyAdoptionHostGate({root,baseSha,headSha,headRef=BRANCH,pr,api=githubJSON,integration}={}) {
 const proof=provePolicyAdoption({root,baseSha,headSha,headRef,api,integration});
 const prefix=`repos/${REPOSITORY}`;
 const verify=()=>{
  const pull=api(`${prefix}/pulls/${pr}`);
  if(!Number.isSafeInteger(pr) || pr<1 || [proof.original.pr,proof.finalization.pr].includes(pr) || pull?.number!==pr || pull.head?.sha!==headSha || pull.head.ref!==BRANCH
   || pull.base?.ref!=='main' || pull.base.repo?.full_name!==REPOSITORY || pull.base.sha!==baseSha || (integration?pull.state!=='closed' || pull.merged!==true || pull.merge_commit_sha!==integration.sha:pull.state!=='open')
   || api(`${prefix}/git/ref/heads/main`)?.object?.sha!==(integration?.sha??baseSha)) fail('host main/head/base/PR changed');
  return pull.head.sha;
 };
 let roles,identities;
 try {
  roles=JSON.parse(api(`${prefix}/actions/variables/GOVERNANCE_REQUIRED_REVIEW_ROLES`).value);
  identities=JSON.parse(api(`${prefix}/actions/variables/GOVERNANCE_REVIEW_IDENTITIES`).value);
 } catch {fail('owner-managed role authority is unavailable');}
 if(!Array.isArray(roles) || !roles.includes('code_reviewer') || !roles.includes('appsec')) fail('old governing final review floors are mandatory');
 const result=evaluateHostReviewGate({repository:REPOSITORY,pr,head:headSha,stage:'final',requiredRoles:roles,identities,requiredChecks:['gates'],api:{pull:verify,
  reviews:()=>hostPages(api(`${prefix}/pulls/${pr}/reviews?per_page=100`,{paginate:true})),checks:()=>{
   const checks=hostPages(api(`${prefix}/commits/${headSha}/check-runs?per_page=100`,{paginate:true}),'check_runs');
   const latest=checks.filter(check=>check.name==='gates').sort((a,b)=>a.id-b.id).at(-1),suite=latest?.check_suite?.id;
   if(!Number.isSafeInteger(suite) || suite<1) fail('check suite provenance is unavailable');
   const runs=hostPages(api(`${prefix}/actions/runs?check_suite_id=${suite}&per_page=100`,{paginate:true}),'workflow_runs').filter(run=>run.check_suite_id===suite);
   if(runs.length!==1 || runs[0].head_sha!==headSha || runs[0].path!=='.github/workflows/workflow.yml' || runs[0].repository?.full_name!==REPOSITORY || !['push','pull_request'].includes(runs[0].event) || runs[0].status!=='completed' || runs[0].conclusion!=='success') fail('check workflow provenance is untrusted or pending');
   return checks;
  }}});
 verify();return {...result,policyAdoption:proof};
}

/** Called only by the trusted default-branch publisher. Fetches immutable Git
 * objects as data, never checking out or executing the candidate. No credential
 * is materialized; this bounded repository is public. Generic routes stay intact.
 */
export function trustedPolicyAdoptionGate({root,repository,pull,api=githubJSON}={}) {
 if(repository!==REPOSITORY) return null;
 const trusted=git(root,['rev-parse','HEAD']).trim(),base=localSnapshot(root,trusted);
 const stage=policyAdoptionStage({root,baseSha:trusted});if(!stage) return null;
 const candidate=hostSnapshot(api,repository,sha(pull.head.sha));
 if(POLICY.every(name=>equal(base.tree.get(name),candidate.tree.get(name)))) return null;
 if(stage!=='pending') {
  if(pull.head?.ref===BRANCH) fail('a second adoption requires explicit reconciliation');
  return null;
 }
 if(pull.head?.ref!==BRANCH) fail('pending adoption requires the canonical epic branch');
 if(pull.base?.sha!==trusted || api(`repos/${repository}/git/ref/heads/main`)?.object?.sha!==trusted) fail('trusted publisher must run the exact finalization base F');
 materializePolicyAdoptionHistory({root,baseSha:trusted,headSha:pull.head.sha,api});
 return evaluatePolicyAdoptionHostGate({root,baseSha:trusted,headSha:pull.head.sha,headRef:BRANCH,pr:pull.number,api});
}

function observed(callback,proof,label) {
 if(typeof callback!=='function') fail(`observed ${label} context is required`);
 const value=callback(structuredClone(proof));if(value?.then) fail('observers must be synchronous');return value;
}
function actorIdentity(actor) {
 const harness=actor?.harness;
 if(harness?.authenticated!==true || typeof harness.identity!=='string' || !harness.identity.trim() || typeof harness.sessionId!=='string' || !harness.sessionId.trim()) fail('trusted harness actor required');
 return harness;
}
function cleanHead(root) {
 if(canonicalCoordinationRoot(root)===fs.realpathSync(root)) fail('local adoption requires the registered isolated epic worktree');
 if(git(root,['status','--porcelain']).trim()) fail('local adoption checkout must be clean');
 if(git(root,['branch','--show-current']).trim()!==BRANCH) fail('local adoption branch differs');
 return git(root,['rev-parse','HEAD']).trim();
}

/** Out-of-band trusted harness API, never event/document/environment authority.
 * Preparing/recovery reacquires live owner authority; recovery never recovers reviews.
 * No operation creates a PR, accepts policy, writes coordination files, or merges.
 */
export function controlPolicyAdoption({root,operation,actor,observers,baseSha,headSha,integration}={}) {
 const harness=actorIdentity(actor);
 if(!['prepare','recover','review','gate','publish','integrate'].includes(operation)) fail('unknown controller operation');
 const head=cleanHead(root);if(headSha!==undefined && head!==headSha) fail('working head differs');
 return withWorkflowState(root,state=>{
  const prior=state.epics[EPIC]?.policyAdoption;
  if(!prior && !['prepare','recover'].includes(operation)) fail('runtime release record is missing; explicit recovery required');
  const proof=provePolicyAdoption({root,baseSha:baseSha??prior?.proof.adoption.base,headSha:head,headRef:BRANCH,api:observers?.api,integration:operation==='integrate'?integration:undefined});
  const owner=observed(observers?.owner,proof,'owner authority');
  if(!harness.ownerDecisionIds?.includes(owner?.id)) fail('actual owner decision is absent from harness context');
  if(prior && (prior.proof.adoption.base!==proof.adoption.base || !equal(prior.proof.original,proof.original) || !equal(prior.proof.candidate,proof.candidate))) fail('release lineage changed; no arbitrary recovery or second adoption');
  if(prior?.phase==='integrated') fail('adoption is already integrated');
  if(prior && operation!=='review' && (harness.identity.trim().toLowerCase()!==prior.developer.trim().toLowerCase() || (operation!=='recover' && harness.sessionId!==prior.developerSession))) fail('developer session changed; explicit observed recovery required');
  let record=structuredClone(prior);
  if(['prepare','recover'].includes(operation)) {
   if(prior && head===prior.proof.adoption.head && operation==='prepare') {
    if(!equal(owner,prior.owner)) fail('owner authority changed; explicit recovery required');
    return validateAdoptionRecord(prior);
   }
   record={version:1,phase:'prepared',proof,owner,developer:prior?.developer??harness.identity,developerSession:operation==='recover'?harness.sessionId:prior?.developerSession??harness.sessionId,reviews:[],lastReview:null,publishedPr:prior?.publishedPr??null,observedAt:new Date().toISOString()};
  } else {
   if(prior.proof.adoption.head!==head) fail('head changed; prepare again to invalidate both reviews');
   if(!equal(owner,prior.owner)) fail('owner authority changed or revoked');
   if(operation==='review') {
    const review=observed(observers?.review,proof,'independent review');
    if(review?.by!==harness.identity || review?.sessionId!==harness.sessionId || review.by===record.developer) fail('independent observed reviewer session required');
    record.lastReview=review;
    if(['changes-requested','dismissed'].includes(review.verdict)) {
     record.reviews=[];record.phase='prepared';
    } else {
     if(review.role==='appsec' && record.reviews.length!==1) fail('Staff review must precede AppSec');
     record.reviews.push(review);if(record.reviews.length===2) record.phase='locally-reviewed';
    }
   } else {
    if(record.reviews.length!==2) fail('Staff then AppSec current-head reviews required');
    if(harness.identity!==record.developer) fail('release controller developer identity differs');
    if(operation==='publish') {
     const pull=observed(observers?.pullRequest,proof,'published PR');
     const actual=observers?.api?observers.api(`repos/${REPOSITORY}/pulls/${pull?.number}`):githubJSON(`repos/${REPOSITORY}/pulls/${pull?.number}`);
     if(actual?.state!=='open' || actual.base?.ref!=='main' || actual.base.repo?.full_name!==REPOSITORY || actual.base.sha!==proof.adoption.base || actual.head?.ref!==BRANCH || actual.head.sha!==head
      || !Number.isSafeInteger(actual.number) || actual.number<1 || [proof.original.pr,proof.finalization.pr].includes(actual.number) || (record.publishedPr!==null && record.publishedPr!==actual.number)) fail('published PR identity is invalid or is a second adoption');
     record.publishedPr=actual.number;record.proof.adoption.pr=actual.number;record.phase='published';
    } else if(operation==='integrate') {
     if(record.phase!=='published' || record.publishedPr!==integration?.pr) fail('requires the observed published adoption PR');
     evaluatePolicyAdoptionHostGate({root,baseSha:proof.adoption.base,headSha:head,pr:integration.pr,api:observers?.api,integration});
     record.proof=proof;record.phase='integrated';
    }
   }
   record.observedAt=new Date().toISOString();
  }
  validateAdoptionRecord(record);
  if(cleanHead(root)!==head) fail('head changed during local observation');
  const api=observers?.api??githubJSON;
  if(api(`repos/${REPOSITORY}/git/ref/heads/main`)?.object?.sha!==(operation==='integrate'?integration.sha:proof.adoption.base)) fail('main changed during local observation');
  if(record.publishedPr!==null) {
   const current=api(`repos/${REPOSITORY}/pulls/${record.publishedPr}`);
   if(current?.head?.sha!==head || (operation==='integrate'?current.merged!==true || current.merge_commit_sha!==integration.sha:current.state!=='open')) fail('published head changed during local observation');
  }
  state.epics[EPIC]={...state.epics[EPIC],policyAdoption:record};
  return structuredClone(record);
 });
}
