import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {check,readDocument} from './check-gate.mjs';
import {validateTier2Assessment} from './check-tier2.mjs';
import {observeMergedEpic,assertFinalizationSnapshots,localSnapshot} from './lib/epic-finalization.mjs';
import {provePolicyAdoption,policyAdoptionStage,materializePolicyAdoptionHistory} from './lib/epic-policy-adoption.mjs';
import {releaseVerificationStage,materializeReleaseHistory,proveReleaseVerification} from './lib/release-verification-proof.mjs';
import {localReviewRoute} from './lib/local-review-route.mjs';
function canonicalCommit(value,label) {
 if(!/^[a-f0-9]{40}$/i.test(value??'')) throw new Error(`${label} must be a full commit SHA`);
 const canonical=execFileSync('git',['rev-parse',`${value}^{commit}`],{encoding:'utf8'}).trim();
 if(canonical.toLowerCase()!==value.toLowerCase()) throw new Error(`${label} does not identify the requested commit`);
 return canonical;
}
const base=process.env.BASE_SHA;
if(!/^[a-f0-9]{40}$/.test(base??'')) throw new Error('BASE_SHA must be a full commit SHA');
const headSha=canonicalCommit(process.env.HEAD_SHA,'HEAD_SHA');
const checkedOutHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(checkedOutHead.toLowerCase()!==headSha.toLowerCase()) throw new Error('HEAD_SHA must match the checked-out PR HEAD');
const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',`${base}...${headSha}`],{encoding:'utf8'}).split('\0').filter(Boolean);
const event=process.env.GITHUB_EVENT_PATH?JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')):null;
const route=localReviewRoute({baseRef:base,headRef:headSha,prNumber:event?.pull_request?.number});
if(route.route==='authoring') {
 console.log('Authoring infrastructure: independent code_reviewer required by host-review-gate; legacy epic and production role gates do not apply.');
 process.exit(0);
}
const ids=new Set(changed.map(f=>f.match(/^epics\/(EPIC-\d+)\//)?.[1]).filter(Boolean));
const branch=process.env.HEAD_REF || execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
const branchId=branch.match(/^epic\/(EPIC-\d+)$/)?.[1]; if(branchId) ids.add(branchId);
const templateFile=/^(?:docs\/|project\/|policy\/|scripts\/|tests\/|skills\/|\.github\/|\.clinerules\/|epics\/EPIC-XXX\/|project\/project-plan\.md\.template$|(?:README\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|skills-lock\.json|\.gitignore)$)/;
const planOnlyFile=/^(?:docs\/[^/]+\.md|project\/[^/]+\.md|epics\/.+\.md|README\.md)$/;
const assessmentPaths=changed.filter(file=>/^project\/task-assessments\/.+\.yaml$/.test(file));
const policyChanged=changed.some(name=>['config/workspace-config.yaml','project/workspace-config-history.jsonl'].includes(name));
const adoptionStage=policyChanged?policyAdoptionStage({root:process.cwd(),baseSha:base}):null;
const releaseStage=releaseVerificationStage({root:process.cwd(),baseSha:base});
if(releaseStage==='pending' || (releaseStage==='integrated' && branch==='epic/EPIC-006')) {
 if(branch!=='epic/EPIC-006') throw new Error('Release verification requires the canonical epic branch');
 materializeReleaseHistory({root:process.cwd(),baseSha:base,headSha});
 proveReleaseVerification({root:process.cwd(),baseSha:base,headSha,headRef:branch});
 console.log('EPIC-006: release-verification committed provenance verified (not publication or merge authority)');
 // The finite proof has validated the complete diff and every intermediate commit.
 // It cannot contain an assessment or another epic, even under a changed branch.
 ids.clear();
}
if(adoptionStage==='pending') {
 if(branch!=='epic/EPIC-006') throw new Error('Policy adoption requires the canonical epic branch');
 ids.add('EPIC-006');
}
if(ids.size===0 && assessmentPaths.length===0 && changed.some(f=>!templateFile.test(f))) throw new Error('Application changes require an epic branch, changed epic plan, or task assessment');
const validatedEpicPlans=new Map();
for(const id of ids) {
 const file=`epics/${id}/epic-plan.md`;
 if(!fs.existsSync(file)) throw new Error(`Missing epic plan: ${file}`);
 const {data}=readDocument(file);
 if(id==='EPIC-006' && policyChanged && adoptionStage) {
  if(assessmentPaths.length || ids.size!==1) throw new Error('Policy adoption cannot authorize a new assessment or another epic');
  materializePolicyAdoptionHistory({root:process.cwd(),baseSha:base,headSha});
  provePolicyAdoption({root:process.cwd(),baseSha:base,headSha,headRef:branch});
  console.log(`${data.id}: policy-adoption-pr committed provenance verified (not publication or merge authority)`);
  continue;
 }
 if(data.status==='merged') {
  if(assessmentPaths.length || ids.size!==1) throw new Error('Postmerge finalization cannot authorize a Tier 3 assessment or another epic');
  const merged=observeMergedEpic({root:process.cwd(),epic:id,plan:data,reviews:false,working:false,revision:headSha});
  execFileSync('git',['merge-base','--is-ancestor',merged.mergeCommit,headSha],{stdio:'pipe'});
  const finalization=assertFinalizationSnapshots({epic:id,repository:merged.repository,pr:merged.pr,before:localSnapshot(process.cwd(),base),after:localSnapshot(process.cwd(),headSha)});
  if(!finalization.changed.length) throw new Error('Postmerge finalization requires actual merged markers');
  console.log(check(file,'finalization-pr',{root:process.cwd()}));
  continue; // A completed plan never becomes authority for new implementation.
 }
 const stage=changed.every(name=>planOnlyFile.test(name)) ? 'plan-pr' : 'implementation-pr';
 if(stage==='implementation-pr' && !['in-progress','in-review','in-appsec-review','in-accessibility-review','ready-for-pr'].includes(data.status)) {
  throw new Error('PR requires ready-for-pr epic plan or a started implementation plan');
 }
 console.log(check(file,stage,{root:process.cwd(),changedFiles:changed}));
 validatedEpicPlans.set(file,data);
}
for(const assessmentPath of assessmentPaths) {
 const result=validateTier2Assessment({assessmentPath,repoRoot:process.cwd(),baseSha:base,headSha,headRef:process.env.HEAD_REF});
 if(result.tier===3) {
  if(!result.tier3Binding) throw new Error('Tier 3 assessment requires a successfully validated epic plan and a named immutable plan binding');
  const binding=result.tier3Binding;
  const plan=validatedEpicPlans.get(binding.planPath);
  if(!plan) throw new Error(`Tier 3 assessment must validate its named ready-for-PR plan: ${binding.planPath}`);
  if(plan.id!==binding.planId || plan.revision!==binding.planRevision) {
   throw new Error('Tier 3 assessment binding plan ID or revision does not match the loaded ready-for-PR plan');
  }
  const task=readDocument(binding.taskPath).data;
  if(task.id!==binding.taskId || task.parent_revision!==binding.planRevision || !plan.tasks.includes(`tasks/${binding.taskId}.md`)) {
   throw new Error('Tier 3 assessment task binding is stale or does not belong to its named plan');
  }
  const epicPath=`epics/${binding.branch.slice('epic/'.length)}/epic.md`;
  if(!fs.existsSync(epicPath)) throw new Error(`Tier 3 assessment is missing its named epic: ${epicPath}`);
  // PR creation and updates validate immutable scope binding. Final role
  // evidence is intentionally live and is checked at merge time against the
  // exact host head, so committing metadata cannot chase the review head.
 }
 console.log(`${result.assessmentPath}: Tier ${result.tier} ${result.status}${result.route?` (${result.route})`:''}`);
}
