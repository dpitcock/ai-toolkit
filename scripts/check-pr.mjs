import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {check,readDocument} from './check-gate.mjs';
import {validateTier2Assessment} from './check-tier2.mjs';
import {validateTier3RoleEvidence} from './lib/tier3-policy.mjs';
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
const changed=execFileSync('git',['diff','--name-only','-z',`${base}...${headSha}`],{encoding:'utf8'}).split('\0').filter(Boolean);
const ids=new Set(changed.map(f=>f.match(/^epics\/(EPIC-\d+)\//)?.[1]).filter(Boolean));
const branch=process.env.HEAD_REF || execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
const branchId=branch.match(/^epic\/(EPIC-\d+)$/)?.[1]; if(branchId) ids.add(branchId);
const templateFile=/^(?:docs\/|project\/|scripts\/|tests\/|skills\/|\.github\/|\.clinerules\/|epics\/EPIC-XXX\/|project\/project-plan\.md\.template$|(?:README\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|skills-lock\.json|\.gitignore)$)/;
const assessmentPaths=changed.filter(file=>/^project\/task-assessments\/.+\.yaml$/.test(file));
if(ids.size===0 && assessmentPaths.length===0 && changed.some(f=>!templateFile.test(f))) throw new Error('Application changes require an epic branch, changed epic plan, or task assessment');
const validatedEpicPlans=new Map();
for(const id of ids) {
 const file=`epics/${id}/epic-plan.md`;
 if(!fs.existsSync(file)) throw new Error(`Missing epic plan: ${file}`);
 const {data}=readDocument(file);
 // A post-merge metadata-only update may mark the already-merged epic closed.
 const metadataOnly=changed.every(f=>/^(epics|project)\//.test(f));
 if(data.status==='merged' && metadataOnly && /^https:\/\//.test(data.pr_url??'')) continue;
 console.log(check(file,'pr'));
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
  validateTier3RoleEvidence({policy:result.tier3Policy,plan,epic:readDocument(epicPath).data,developer:result.developer,reviewedCommit:plan.review_commit});
 }
 console.log(`${result.assessmentPath}: Tier ${result.tier} ${result.status}${result.route?` (${result.route})`:''}`);
}
