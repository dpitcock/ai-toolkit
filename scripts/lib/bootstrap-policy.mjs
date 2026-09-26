import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import YAML from 'yaml';
import {applyWorktreeOverlay,parseWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition} from './workspace-config.mjs';
import {parseWorkspaceHistory} from './workspace-history.mjs';
import {resolveTier3Policy} from './tier3-policy.mjs';

// Independently approved EPIC-006 provisioning, not a configurable migration route.
const B='553daf9fb49df58e55c3c5a6fbb68df6a0be0a41';
const P='74c7c7f66924f43319e1850ad6728708a5adc96b';
const S='a91beb92f858c4be00e09f23de39de3ccee3c17f';
const A='2a51c8fe0a35ebe224840d702ef5ae30f271407e';
const ASSESSMENT='project/task-assessments/governance-activation.yaml';
const ASSESSMENT_BLOB='d4c633fc8387df67422861cb87508fa7c2af75b4';
const POLICY=['config/workspace-config.yaml','project/workspace-config-history.jsonl'];
const PLAN='epics/EPIC-006/epic-plan.md';
const TASK='epics/EPIC-006/tasks/TASK-000.md';

function fail(message) { throw new Error(`EPIC-006 bootstrap ${message}`); }
function git(root,args) {
  try { return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
  catch { fail(`committed history unavailable (${args[0]})`); }
}
const lines=value=>value.trim().split('\n').filter(Boolean);
const paths=value=>value.split('\0').filter(Boolean);
function changed(root,commit) {
  return [...new Set(paths(git(root,['diff-tree','--root','-m','--no-commit-id','--no-renames','--name-only','-z','-r',commit])))].sort();
}
function entry(root,commit,name) {
  const entries=paths(git(root,['ls-tree','-z',commit,'--',name]));
  if(!entries.length) return null;
  const match=entries[0].match(/^100644 blob ([a-f0-9]{40})\t([\s\S]+)$/);
  if(entries.length!==1 || !match || match[2]!==name) fail(`${name} must be a non-executable regular committed file`);
  return match[1];
}
function read(root,commit,name) {
  if(!entry(root,commit,name)) fail(`missing committed ${name}`);
  return git(root,['show',`${commit}:${name}`]);
}
function yaml(raw) {
  const parsed=YAML.parseDocument(raw,{uniqueKeys:true});
  if(parsed.errors.length) fail('invalid YAML snapshot');
  return parsed.toJS({maxAliasCount:0});
}
function document(root,commit,name) {
  const match=read(root,commit,name).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if(!match) fail('plan/task binding document lacks frontmatter');
  return yaml(match[1]);
}
function snapshot(root,commit) {
  const configText=read(root,commit,POLICY[0]),historyText=read(root,commit,POLICY[1]);
  const config=parseWorkspaceConfig(configText),history=parseWorkspaceHistory(historyText),accepted=history.at(-1);
  if(!accepted || !['acceptance','change'].includes(accepted.kind) || accepted.digest!==workspaceConfigDigest(config)
    || !isDeepStrictEqual(accepted.definition??null,workspaceTierDefinition(config))) fail('policy snapshot lacks valid acceptance');
  return {config,configText,history,historyText,accepted};
}
function immutable(record) {
  const {reviewEvidence,roleEvidence,finalChecks,...facts}=record;
  if(facts.accessibilityEvidence!==null && typeof facts.accessibilityEvidence==='object') {
    const {finalReview,...initial}=facts.accessibilityEvidence;facts.accessibilityEvidence=initial;
  }
  return facts;
}
function assertAssessment(record,initial) {
  if(!isDeepStrictEqual(immutable(record),immutable(initial))) fail('assessment facts must remain immutable');
}
function assertPlanBinding(root,head,record,config) {
  const binding=record.tier3Binding,policy=resolveTier3Policy({config});
  if(binding?.planPath!==PLAN || binding.planId!=='EPIC-006-PLAN' || binding.planRevision!==1
    || binding.taskPath!==TASK || binding.taskId!=='TASK-000' || binding.branch!=='epic/EPIC-006'
    || binding.worktreePath!=='.worktrees/EPIC-006'
    || !isDeepStrictEqual(binding.policy,{coordination:record.acceptedConfig.coordination,
      worktree:record.acceptedConfig.worktree,effectiveDigest:policy.effectiveDigest,roles:policy.roles})) {
    fail('original plan/task/branch/policy binding is invalid');
  }
  for(const commit of [S,head]) {
    const plan=document(root,commit,PLAN),task=document(root,commit,TASK);
    if(plan.kind!=='epic-plan' || plan.id!==binding.planId || plan.revision!==1
      || !Array.isArray(plan.tasks) || !plan.tasks.includes('tasks/TASK-000.md')
      || task.kind!=='task' || task.id!=='TASK-000' || task.parent_revision!==1 || task.parent!=='../epic-plan.md') {
      fail('canonical plan/task binding is stale');
    }
  }
}

/** Read-only original-submission proof, also usable for a later release's H0.
 * Does not read the working checkout, change HEAD, or supply review authority.
 * Returns null only for an unrelated assessment; this identity must prove all predicates.
 */
export function recognizeBootstrapPolicy({root,baseSha,headSha,headRef,assessmentPath}={}) {
  if(assessmentPath!==ASSESSMENT) return null;
  const origin=git(root,['remote','get-url','origin']).trim();
  if(!/^(?:https:\/\/github\.com\/|git@github\.com:)dpitcock\/ai-toolkit(?:\.git)?$/.test(origin)
    || baseSha!==B || headRef!=='epic/EPIC-006' || !/^[a-f0-9]{40}$/.test(headSha??'')) fail('identity does not match approved repository/base/branch');
  for(const commit of [B,P,S,A,headSha]) {
    if(git(root,['rev-parse',`${commit}^{commit}`]).trim()!==commit) fail('identity does not resolve to pinned commit');
  }
  for(const [ancestor,descendant] of [[B,P],[P,S],[S,A],[A,headSha]]) git(root,['merge-base','--is-ancestor',ancestor,descendant]);
  if(POLICY.some(name=>entry(root,B,name)!==null)) fail('base must contain neither policy path');
  const history=lines(git(root,['rev-list','--reverse',`${B}..${headSha}`]));
  const changes=new Map(history.map(commit=>[commit,changed(root,commit)]));
  const provisioning=history.filter(commit=>changes.get(commit).some(name=>POLICY.includes(name)));
  if(provisioning.some(commit=>commit!==P && commit!==S)) fail('policy changed after starting head or outside exact provisioning');
  if(!isDeepStrictEqual(provisioning,[P,S]) || !isDeepStrictEqual(changes.get(P),POLICY)) fail('provisioning must change exactly the two policy paths');
  const parents=lines(git(root,['show','-s','--format=%P',P])).join(' ').split(' ');
  if(parents.length!==1 || POLICY.some(name=>entry(root,parents[0],name)!==null)) fail('provisioning must add both previously absent policy paths');
  const initialBlob=entry(root,A,ASSESSMENT);
  if(initialBlob!==ASSESSMENT_BLOB || git(root,['show','-s','--format=%P',A]).trim()!==S
    || !isDeepStrictEqual(changes.get(A),[ASSESSMENT]) || entry(root,S,ASSESSMENT)!==null) fail('original assessment identity or sole-path direct-child evidence is invalid');
  const additions=lines(git(root,['log','--full-history','--reverse','--format=%H','--diff-filter=A',headSha,'--',ASSESSMENT]));
  if(!isDeepStrictEqual(additions,[A])) fail('original assessment must be added exactly once');
  const initial=yaml(read(root,A,ASSESSMENT));
  if(initial.kind!=='task-assessment' || initial.id!=='governance-activation' || initial.startingHead!==S
    || initial.selectedTier!==3 || initial.reviewEvidence!==null || initial.roleEvidence!==null) fail('initial assessment facts are invalid');
  const acceptedRoot=snapshot(root,P),linked=snapshot(root,S),provenance=initial.acceptedConfig;
  if(Object.hasOwn(acceptedRoot.config,'worktree_overrides') || acceptedRoot.history.length!==2
    || acceptedRoot.accepted.kind!=='acceptance' || acceptedRoot.accepted.revision!==1) fail('provisioning root acceptance is invalid');
  if(!isDeepStrictEqual(yaml(linked.configText),{...yaml(acceptedRoot.configText),worktree_overrides:[]})
    || !isDeepStrictEqual(linked.config.worktree_overrides,[])) fail('starting policy must add only the empty override marker');
  const effective=applyWorktreeOverlay(acceptedRoot.config,linked.config).config;
  if(!isDeepStrictEqual(provenance,{coordination:{digest:acceptedRoot.accepted.digest,revision:acceptedRoot.accepted.revision},
    worktree:{digest:linked.accepted.digest,revision:linked.accepted.revision},effectiveDigest:workspaceConfigDigest(effective),revision:acceptedRoot.accepted.revision})) {
    fail('assessment policy digests or revisions do not match provisioning');
  }
  if(!linked.historyText.startsWith(acceptedRoot.historyText) || linked.history.length!==acceptedRoot.history.length+1
    || linked.accepted.kind!=='change' || linked.accepted.revision!==acceptedRoot.accepted.revision+1
    || !isDeepStrictEqual(linked.accepted.changes,['worktree_overrides'])) fail('starting history must append exactly the accepted marker change');
  for(const commit of history.filter(commit=>changes.get(commit).includes(ASSESSMENT))) {
    assertAssessment(yaml(read(root,commit,ASSESSMENT)),initial);
  }
  assertAssessment(yaml(read(root,headSha,ASSESSMENT)),initial);
  assertPlanBinding(root,headSha,initial,acceptedRoot.config);
  for(const name of POLICY) {
    if(read(root,headSha,name)!==read(root,S,name)) fail('candidate policy snapshot differs from starting head');
  }
  // All other intended files retain the ordinary PR-base preflight restriction.
  const prior=paths(git(root,['diff','--name-only','--no-renames','-z',`${B}...${S}`,'--',...initial.intendedFiles]));
  if(prior.some(name=>!POLICY.includes(name))) fail('another intended source path changed before preflight');
  return {root:acceptedRoot,linked,effective,allowedPaths:[...POLICY],initialAssessment:initial,initialEvidenceCommit:A};
}
