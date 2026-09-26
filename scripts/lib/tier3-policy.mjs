import {resolveWorkspaceConfig,workspaceConfigDigest} from './workspace-config.mjs';

const tier3Roles=['principal','qa','appsec','accessibility_reviewer'];

/**
 * Public contract for downstream Tier 3 binding and PR validation. Resolved
 * role values are immutable provenance, not an alternate approval route.
 */
export const tier3PolicyContract=Object.freeze({
  resolvedRoles:'Resolved role values and sources are immutable provenance for Tier 3 bindings.',
  evidenceFloors:'check-gate document approval floors prevail over resolved role values and exemptions.',
});

function fail(message) { throw new Error(`Tier 3 ${message}`); }
function object(value,label) {
  if(value===null || typeof value!=='object' || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}
function sameIdentity(left,right) {
  return typeof left==='string' && typeof right==='string' && left.trim().toLowerCase()===right.trim().toLowerCase();
}
function date(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
function commit(value) { return typeof value==='string' && /^[a-f0-9]{40}$/i.test(value); }
function approval(value,{label,developer,owner,revision,reviewedCommit=null}) {
  const expected=reviewedCommit===null ? ['by','date','notes','revision'] : ['by','date','notes','revision','commit'];
  if(value===null || typeof value!=='object' || Array.isArray(value)
    || Object.keys(value).some(key=>!expected.includes(key)) || expected.some(key=>!Object.hasOwn(value,key))
    || typeof value.by!=='string' || !value.by.trim() || typeof value.notes!=='string' || !value.notes.trim()
    || !date(value.date) || value.revision!==revision || sameIdentity(value.by,developer) || sameIdentity(value.by,owner)
    || (reviewedCommit!==null && (!commit(value.commit) || value.commit.toLowerCase()!==reviewedCommit.toLowerCase()))) {
    fail(`${label} evidence is missing, malformed, self-issued, stale, or on the wrong commit`);
  }
  return value;
}
function approvals(document,label) { return object(object(document,label).approvals,`${label}.approvals`); }
function owner(document,label) {
  const value=object(document,label).owner;
  if(typeof value!=='string' || !value.trim()) fail(`${label} owner is required`);
  return value;
}
function requiresPlanAppsec(plan) {
  const security=object(plan.security,'plan.security');
  if(!['auth','data','external'].every(key=>typeof security[key]==='boolean') || !Array.isArray(security.concerns)
    || !Array.isArray(plan.touches_concerns)) fail('plan security applicability is malformed');
  return security.auth || security.data || security.external || security.concerns.length>0 || plan.touches_concerns.length>0;
}

/**
 * Resolves just the four Tier 3 evidence roles from the existing workspace
 * policy. The workspace schema may contain other roles; they are deliberately
 * not part of this Tier 3 contract.
 */
export function resolveTier3Policy({coordinationRoot,worktreeRoot,config,sources={}}={}) {
  const resolved=config===undefined
    ? resolveWorkspaceConfig({coordinationRoot,worktreeRoot})
    : {config,sources};
  const policy=object(resolved.config,'workspace config');
  const required=object(policy.approvals_required,'workspace approvals_required');
  const overrides=object(policy.approvals_overrides,'workspace approvals_overrides');
  if(!Array.isArray(overrides.exempt)) fail('workspace exemptions are malformed');

  const roles={};
  for(const role of tier3Roles) {
    if(typeof required[role]!=='boolean') fail(`workspace ${role} policy is malformed`);
    roles[role]={
      required:required[role] && !overrides.exempt.includes(role),
      source:resolved.sources?.[`approvals_required.${role}`] ?? 'root',
    };
  }
  return {config:policy,sources:resolved.sources??{},roles,effectiveDigest:workspaceConfigDigest(policy)};
}

/**
 * Validates evidence floors that a Tier 3 policy cannot waive. Principal and
 * QA remain required by the named plan and epic; final code/AppSec review is
 * always required; accessibility remains required only for a named UI plan.
 */
export function validateTier3RoleEvidence({policy,plan,epic,developer,reviewedCommit}={}) {
  const resolved=object(policy,'policy');
  const roles=object(resolved.roles,'policy.roles');
  if(Object.keys(roles).length!==tier3Roles.length || tier3Roles.some(role=>!Object.hasOwn(roles,role))) {
    fail('policy must contain exactly the four configured roles');
  }
  for(const role of tier3Roles) {
    if(!roles[role] || typeof roles[role].required!=='boolean' || typeof roles[role].source!=='string' || !roles[role].source.trim()) {
      fail(`${role} policy is malformed`);
    }
  }
  if(typeof developer!=='string' || !developer.trim()) fail('developer identity is required');
  if(!commit(reviewedCommit)) fail('reviewed commit is malformed');
  const namedPlan=object(plan,'plan');
  const namedEpic=object(epic,'epic');
  if(!Number.isInteger(namedPlan.revision) || namedPlan.revision<1 || !Number.isInteger(namedEpic.revision) || namedEpic.revision<1) {
    fail('plan and epic revisions are required');
  }

  const planApprovals=approvals(namedPlan,'plan');
  const epicApprovals=approvals(namedEpic,'epic');
  const planOwner=owner(namedPlan,'plan');
  const epicOwner=owner(namedEpic,'epic');
  approval(planApprovals.principal_engineer,{label:'principal',developer,owner:planOwner,revision:namedPlan.revision});
  approval(epicApprovals.qa_lead,{label:'qa',developer,owner:epicOwner,revision:namedEpic.revision});

  if(requiresPlanAppsec(namedPlan)) {
    approval(planApprovals.appsec,{label:'appsec plan approval',developer,owner:planOwner,revision:namedPlan.revision});
  }
  approval(planApprovals.code_review,{label:'code review',developer,owner:planOwner,revision:namedPlan.revision,reviewedCommit});
  approval(planApprovals.appsec_review,{label:'appsec final review',developer,owner:planOwner,revision:namedPlan.revision,reviewedCommit});

  const accessibility=object(namedPlan.accessibility,'plan.accessibility');
  if(typeof accessibility.ui!=='boolean') fail('plan accessibility assessment is malformed');
  if(accessibility.ui) {
    approval(planApprovals.accessibility,{label:'accessibility plan approval',developer,owner:planOwner,revision:namedPlan.revision});
    approval(planApprovals.accessibility_review,{label:'accessibility final review',developer,owner:planOwner,revision:namedPlan.revision,reviewedCommit});
  }
  return {roles:structuredClone(roles),reviewedCommit:reviewedCommit.toLowerCase()};
}
