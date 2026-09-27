// This module deliberately consumes a harness-authenticated actor. Event and CLI
// payloads are data only: callers must not copy their claimed actor into this input.

const RESTRICTED_EFFECTS=new Set(['access','cost','deploy','destruction']);

function result(decision,reason) { return {decision,reason,actionItem:null}; }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function nonempty(value) { return typeof value==='string' && value.trim().length>0; }
function stringList(value) { return Array.isArray(value) && value.every(nonempty) ? value : null; }
function equal(left,right) { return JSON.stringify(left)===JSON.stringify(right); }

function trustedHarness(actor) {
  const harness=actor?.harness;
  if(!object(harness) || harness.authenticated!==true || !nonempty(harness.sessionId) || !nonempty(harness.identity)) return null;
  if(harness.ownerDecisionIds!==undefined && !stringList(harness.ownerDecisionIds)) return null;
  return harness;
}

function actionName(action) { return action?.name ?? action?.action; }
function criterion(action) { return action?.completionCriterion ?? action?.completion_criterion; }
function policyBinding(value) {
  const binding=value?.provenance ?? value?.policy ?? value;
  if(!object(binding) || !/^[a-f0-9]{64}$/.test(binding.digest ?? binding.policyDigest ?? '')) return null;
  const definition=binding.definition;
  const root=binding.rootAcceptance ?? binding.root_acceptance;
  const worktree=binding.worktreeAcceptance ?? binding.worktree_acceptance;
  if(!object(definition) || !Number.isInteger(definition.version) || definition.version<1 || !/^[a-f0-9]{64}$/.test(definition.digest) || !nonempty(root) || !nonempty(worktree)) return null;
  return {digest:binding.digest ?? binding.policyDigest,definition:{version:definition.version,digest:definition.digest},rootAcceptance:root,worktreeAcceptance:worktree};
}

function bindingMatches(left,right) {
  return left && right && left.digest===right.digest && left.definition.version===right.definition.version && left.definition.digest===right.definition.digest && left.rootAcceptance===right.rootAcceptance && left.worktreeAcceptance===right.worktreeAcceptance;
}

function covers(permit,action,policy) {
  if(!object(permit) || !object(action)) return false;
  const permitScope=stringList(permit.scope),actions=stringList(permit.allowedActions ?? permit.allowed_actions),criteria=stringList(permit.completionCriteria ?? permit.completion_criteria);
  const requestedScope=action.scope;
  if(!nonempty(permit.repository) || !nonempty(permit.branch) || !permitScope || !actions || !criteria || !nonempty(action.repository) || !nonempty(action.branch) || !nonempty(requestedScope) || !nonempty(actionName(action)) || !nonempty(criterion(action))) return false;
  return permit.repository===action.repository && permit.branch===action.branch && permitScope.includes(requestedScope) && actions.includes(actionName(action)) && criteria.includes(criterion(action)) && bindingMatches(policyBinding(permit.policy ?? permit),policy);
}

function restrictedEffects(action) {
  const declared=Array.isArray(action?.effects) ? action.effects : [];
  const effects=new Set(declared.filter(effect=>typeof effect==='string').map(effect=>effect.trim().toLowerCase()));
  for(const effect of RESTRICTED_EFFECTS) if(action?.[effect]===true) effects.add(effect);
  return [...effects].filter(effect=>RESTRICTED_EFFECTS.has(effect));
}

function ownerCovers(decision,action,policy,effects) {
  if(!covers(decision,action,policy)) return false;
  const allowed=stringList(decision.effects);
  return allowed!==null && effects.every(effect=>allowed.includes(effect));
}

/**
 * Evaluate one previously-recorded authorization. This never grants tool access,
 * creates an action item, or authenticates a person; those are harness concerns.
 */
export function decideAction({authorization,action,policy,actor}={}) {
  const harness=trustedHarness(actor);
  if(!harness) return result('human-needed','trusted-harness-actor-required');
  if(!object(authorization) || !object(action) || !object(policy)) return result('human-needed','authorization-input-required');
  if(Array.isArray(action.toolPermissions) && action.toolPermissions.length) return result('human-needed','tool-permissions-are-independent');
  const acceptedPolicy=policyBinding(policy);
  if(!acceptedPolicy) return result('human-needed','accepted-policy-provenance-required');
  if(!bindingMatches(policyBinding(authorization.policy ?? authorization),acceptedPolicy)) return result('human-needed','policy-provenance-mismatch');
  if(authorization.stale===true || (authorization.status!==undefined && authorization.status!=='active') ||
    (nonempty(authorization.expiresAt) && Number.isFinite(Date.parse(authorization.expiresAt)) && Date.parse(authorization.expiresAt)<=Date.now())) {
    return result('human-needed','authorization-stale');
  }
  if(authorization.authorizedBy===harness.identity || authorization.issuedBy===harness.identity) return result('human-needed','self-authorization-denied');
  if(!covers(authorization,action,acceptedPolicy)) return result('human-needed','authorization-scope-mismatch');

  const effects=restrictedEffects(action);
  if(effects.length) {
    const owner=authorization.ownerDecision;
    if(!object(owner) || !nonempty(owner.id)) return result('human-needed','owner-authorization-required');
    if(!harness.ownerDecisionIds?.includes(owner.id)) return result('human-needed','trusted-owner-decision-required');
    if(owner.ownerId===harness.identity && harness.owner!==true) return result('human-needed','self-authorization-denied');
    if(!ownerCovers(owner,action,acceptedPolicy,effects)) return result('human-needed','owner-authorization-required');
    return policy.workflow?.autopilot===false ? result('delegate','autopilot-disabled') : result('continue','authorized-owner-decision');
  }
  if(policy.workflow?.autopilot===false) return result('delegate','autopilot-disabled');
  if(policy.workflow?.autopilot!==true) return result('human-needed','autopilot-policy-required');
  return result('continue','authorized-routine');
}
