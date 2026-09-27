import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {policyAdoptionStage,observeHistoricalPolicyAdoption} from './epic-policy-adoption.mjs';
import {canonicalRepository,localSnapshot,githubJSON,hostPages} from './epic-finalization.mjs';
import {assertActivationHistory,ACTIVATION_PATHS} from './activation-history.mjs';
import {ACTIVATION_REPORT,ACTIVATION_DOCUMENT,activationBlockBounds} from './activation-report.mjs';
import {validateReleaseRelation,releaseFailure as fail} from './release-verification-record.mjs';
import {evaluateHostReviewGate} from '../check-host-reviews.mjs';

const REPOSITORY='dpitcock/ai-toolkit',BRANCH='epic/EPIC-006';
/** Route selection comes only from integrated base, before inspecting candidate
 * status or branch. A malformed release candidate cannot choose ordinary CI.
 */
export function releaseVerificationStage({root,baseSha}={}) {
 if(policyAdoptionStage({root,baseSha})!=='post-adoption') return null;
 const base=localSnapshot(root,baseSha);
 // Presence of the report means this finite release has already advanced.
 // Even corrupt marker/report state keeps the finite route selected and closed.
 return base.tree.has(ACTIVATION_REPORT)?'integrated':'pending';
}
function checkMain(api,expected) {
 if(api(`repos/${REPOSITORY}/git/ref/heads/main`)?.object?.sha!==expected) fail('current main differs from the bounded release');
}
/** Committed provenance only: no local reviews, permit, runtime or own CI result. */
export function proveReleaseVerification({root,baseSha,headSha,headRef,api=githubJSON,integration,empty=false,publication}={}) {
 if(canonicalRepository(root)!==REPOSITORY || headRef!==BRANCH) fail('repository or branch is outside the finite release');
 if(releaseVerificationStage({root,baseSha})!=='pending') fail('requires the unique integrated adoption base I');
 const expected=integration?.sha??baseSha;checkMain(api,expected);
 const adoption=observeHistoricalPolicyAdoption({root,integrationSha:baseSha,api});
 const base=localSnapshot(root,baseSha);
 activationBlockBounds(base.read(ACTIVATION_DOCUMENT));
 const submitted=assertActivationHistory({root,base:baseSha,head:headSha,digest:adoption.policy.canonical.digest,empty});
 const prefix=`repos/${REPOSITORY}`;
 if(publication) {
  if(integration || !Number.isSafeInteger(publication.pr) || publication.pr<1 || typeof publication.head!=='string' || !/^[a-f0-9]{40}$/.test(publication.head)) fail('local publication binding invalid');
  execFileSync('git',['--no-replace-objects','-C',root,'merge-base','--is-ancestor',publication.head,headSha],{stdio:'pipe'});
 }
 let pr=null,j=null;
 const verify=()=>{
  if(integration) {
   const pull=api(`${prefix}/pulls/${integration.pr}`);
   if(!Number.isSafeInteger(integration.pr) || pull?.number!==integration.pr || pull.state!=='closed' || pull.merged!==true || pull.merge_commit_sha!==integration.sha
    || pull.head?.sha!==headSha || pull.head?.ref!==BRANCH || pull.base?.sha!==baseSha || pull.base?.ref!=='main' || pull.base.repo?.full_name!==REPOSITORY) fail('actual PR2 integration identity differs');
   pr=pull.number;j=integration.sha;
  }
  const open=hostPages(api(`${prefix}/pulls?state=open&base=main&per_page=100`,{paginate:true})).filter(item=>item.head?.ref===BRANCH);
  if(open.length>1 || (publication && (open.length!==1 || open[0].number!==publication.pr)) || open.some(item=>integration || item.head.sha!==(publication?.head??headSha) || item.base?.sha!==baseSha)) fail('wrong or second release PR remains open');
  checkMain(api,expected);
 };
 verify();
 if(integration) {
  assertActivationHistory({root,base:baseSha,head:integration.sha,digest:adoption.policy.canonical.digest,integratedHead:headSha});
  if(!equal(localSnapshot(root,headSha).tree,localSnapshot(root,integration.sha).tree)) fail('submitted and integrated release snapshots differ');
 }
 verify();
 return validateReleaseRelation({kind:'epic-release-verification',version:1,id:'activation-evidence',adoption,
  release:{base:baseSha,head:headSha,pr,integrationSha:j,paths:ACTIVATION_PATHS}});
}
/** Fetch immutable observed objects only; never execute or check out candidate code. */
export function materializeReleaseHistory({root,baseSha,headSha,api=githubJSON}={}) {
 if(releaseVerificationStage({root,baseSha})!=='pending') fail('materialization requires trusted I');
 const prefix=`repos/${REPOSITORY}`;
 const pulls=hostPages(api(`${prefix}/commits/${baseSha}/pulls?per_page=100`,{paginate:true})).map(item=>api(`${prefix}/pulls/${item.number}`)).filter(pull=>pull?.merged && pull.merge_commit_sha===baseSha);
 if(pulls.length!==1) fail('adoption association is ambiguous');
 const adoption=pulls[0],originalMarker=localSnapshot(root,baseSha).read('epics/EPIC-006/epic-plan.md').match(/pr_url: https:\/\/github\.com\/dpitcock\/ai-toolkit\/pull\/([1-9]\d*)/);
 if(!originalMarker) fail('original PR marker is absent');
 const original=api(`${prefix}/pulls/${originalMarker[1]}`);
 for(const revision of [original?.head?.sha,original?.merge_commit_sha,adoption?.head?.sha,adoption?.base?.sha,headSha]) {
  if(!/^[a-f0-9]{40}$/.test(revision??'')) fail('materialization requires immutable revisions');
  const git=args=>execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  try {git(['cat-file','-e',`${revision}^{commit}`]);} catch {git(['fetch','--no-tags','--no-recurse-submodules','--no-write-fetch-head','https://github.com/dpitcock/ai-toolkit.git',revision]);}
  if(git(['rev-parse',`${revision}^{commit}`])!==revision) fail('materialized identity differs');
 }
}

/** Native independent current-head gate, separate from pure committed provenance. */
export function evaluateReleaseHostGate({root,baseSha,headSha,headRef=BRANCH,pr,api=githubJSON,integration}={}) {
 const proof=proveReleaseVerification({root,baseSha,headSha,headRef,api,integration}),prefix=`repos/${REPOSITORY}`;
 const verify=()=>{
  const pull=api(`${prefix}/pulls/${pr}`);
  if(!Number.isSafeInteger(pr) || pr<1 || [proof.adoption.original.pr,proof.adoption.finalization.pr,proof.adoption.adoption.pr].includes(pr)
   || pull?.number!==pr || pull.head?.sha!==headSha || pull.head?.ref!==BRANCH || pull.base?.sha!==baseSha || pull.base?.ref!=='main' || pull.base?.repo?.full_name!==REPOSITORY
   || (integration?pull.state!=='closed' || pull.merged!==true || pull.merge_commit_sha!==integration.sha:pull.state!=='open')) fail('current PR2/head/base changed');
  checkMain(api,integration?.sha??baseSha);return headSha;
 };
 let roles,identities;try {
  roles=JSON.parse(api(`${prefix}/actions/variables/GOVERNANCE_REQUIRED_REVIEW_ROLES`).value);
  identities=JSON.parse(api(`${prefix}/actions/variables/GOVERNANCE_REVIEW_IDENTITIES`).value);
 } catch {fail('owner-managed review authority is unavailable');}
 if(!Array.isArray(roles) || !roles.includes('code_reviewer') || !roles.includes('appsec')) fail('Staff and AppSec floors are mandatory');
 const result=evaluateHostReviewGate({repository:REPOSITORY,pr,head:headSha,stage:'final',requiredRoles:roles,identities,requiredChecks:['gates'],api:{pull:verify,
  reviews:()=>hostPages(api(`${prefix}/pulls/${pr}/reviews?per_page=100`,{paginate:true})),checks:()=>{
   const checks=hostPages(api(`${prefix}/commits/${headSha}/check-runs?per_page=100`,{paginate:true}),'check_runs');
   const latest=checks.filter(check=>check.name==='gates').sort((a,b)=>a.id-b.id).at(-1),suite=latest?.check_suite?.id;
   if(!Number.isSafeInteger(suite) || suite<1) fail('native check provenance unavailable');
   const runs=hostPages(api(`${prefix}/actions/runs?check_suite_id=${suite}&per_page=100`,{paginate:true}),'workflow_runs').filter(run=>run.check_suite_id===suite);
   if(runs.length!==1 || runs[0].head_sha!==headSha || runs[0].path!=='.github/workflows/workflow.yml' || runs[0].repository?.full_name!==REPOSITORY || !['push','pull_request'].includes(runs[0].event) || runs[0].status!=='completed' || runs[0].conclusion!=='success') fail('native workflow provenance invalid');
   return checks;
  }}});
 verify();return {...result,releaseVerification:proof};
}
export function trustedReleaseVerificationGate({root,repository,pull,api=githubJSON}={}) {
 if(repository!==REPOSITORY) return null;
 const baseSha=execFileSync('git',['--no-replace-objects','-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const stage=releaseVerificationStage({root,baseSha});
 if(!stage || (stage==='integrated' && pull.head?.ref!==BRANCH)) return null;
 if(stage!=='pending') fail('a second release verification is forbidden');
 if(pull.head?.ref!==BRANCH || pull.base?.sha!==baseSha) fail('release requires canonical branch and trusted I');
 checkMain(api,baseSha);
 materializeReleaseHistory({root,baseSha,headSha:pull.head.sha,api});
 return evaluateReleaseHostGate({root,baseSha,headSha:pull.head.sha,pr:pull.number,api});
}
