const SHA=/^[a-f0-9]{40}$/i;
const PLAN_ORDER=['principal','appsec','accessibility_reviewer'];
const FINAL_ORDER=['code_reviewer','appsec','accessibility_reviewer'];
const EFFECTIVE_STATES=new Set(['APPROVED','CHANGES_REQUESTED','DISMISSED']);

function fail(message) { throw new Error(`Host review evidence ${message}`); }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function text(value,label) {
  if(typeof value!=='string' || !value.trim()) fail(`${label} must be a non-empty string`);
  return value.trim();
}
function sha(value,label='head') {
  if(typeof value!=='string' || !SHA.test(value)) fail(`${label} must be a full Git SHA`);
  return value.toLowerCase();
}
function canonicalActor(value) { return text(value,'actor').toLowerCase(); }
function reviewId(value) {
  if((typeof value!=='string' && !Number.isInteger(value)) || String(value).trim()==='') fail('review ID is malformed');
  return String(value);
}

function stageOrder(stage) {
  if(stage==='plan') return PLAN_ORDER;
  if(stage==='final') return FINAL_ORDER;
  fail('stage must be plan or final');
}

function identitiesFor(requiredRoles,identities) {
  if(!object(identities)) fail('identities are required');
  const result={};
  for(const role of requiredRoles) {
    const mapping=identities[role];
    if(!object(mapping) || Object.keys(mapping).some(key=>!['actor','kind','provenance','roleEvidence'].includes(key))) fail(`${role} identity mapping is malformed`);
    if(!['human','bot'].includes(mapping.kind)) fail(`${role} must map explicitly to a human or bot identity`);
    if(!object(mapping.provenance) || typeof mapping.provenance.source!=='string' || !mapping.provenance.source.trim()
      || typeof mapping.provenance.id!=='string' || !mapping.provenance.id.trim()) fail(`${role} identity provenance is required`);
    result[role]={actor:canonicalActor(mapping.actor),kind:mapping.kind,provenance:{source:mapping.provenance.source.trim(),id:mapping.provenance.id.trim()},roleEvidence:mapping.roleEvidence===true};
  }
  for(let index=0;index<requiredRoles.length;index+=1) {
    for(let other=index+1;other<requiredRoles.length;other+=1) {
      const left=result[requiredRoles[index]],right=result[requiredRoles[other]];
      if(left.actor===right.actor && (!left.roleEvidence || !right.roleEvidence)) {
        fail('actor reused across distinct roles without explicit role evidence');
      }
    }
  }
  return result;
}

function normalizedReviews(reviews,currentHead) {
  if(!Array.isArray(reviews)) fail('reviews must be a complete paginated array');
  if(reviews.some(Array.isArray) && !reviews.every(Array.isArray)) fail('review pages cannot mix arrays and reviews');
  const flattened=reviews.every(Array.isArray)?reviews.flat():reviews;
  const seen=new Set();
  return flattened.map(raw=>{
    if(!object(raw) || !object(raw.user)) fail('review is malformed');
    const id=reviewId(raw.id),actor=canonicalActor(raw.user.login),actorType=text(raw.user.type,'review actor type');
    if(seen.has(id)) fail(`review ID ${id} appears more than once`);
    seen.add(id);
    const state=text(raw.state,'review state').toUpperCase();
    const commit=sha(raw.commit_id,'review commit');
    const submitted=typeof raw.submitted_at==='string' && Number.isFinite(Date.parse(raw.submitted_at)) ? Date.parse(raw.submitted_at) : 0;
    return {id,actor,actorType,state,commit,submitted,current:commit===currentHead};
  });
}

function latestEffective(reviews,actor,currentHead) {
  const matching=reviews.filter(review=>review.actor===actor && review.current && EFFECTIVE_STATES.has(review.state));
  matching.sort((left,right)=>left.submitted-right.submitted || left.id.localeCompare(right.id,undefined,{numeric:true}));
  return matching.at(-1)??null;
}

function planBinding(plan,currentHead) {
  if(!object(plan) || Object.keys(plan).some(key=>!['id','revision','reviewedSha','unresolvedRequests','initialApprovalCycle'].includes(key))) {
    fail('plan receipt binding is required');
  }
  const id=text(plan.id,'plan ID');
  if(!Number.isInteger(plan.revision) || plan.revision<1) fail('plan revision is malformed');
  const reviewedSha=sha(plan.reviewedSha,'plan reviewed SHA');
  if(reviewedSha!==currentHead) fail('plan reviewed SHA is not the current head');
  if(!Array.isArray(plan.unresolvedRequests) || plan.unresolvedRequests.some(value=>typeof value!=='string' || !value.trim())) fail('plan unresolved requests are malformed');
  if(plan.unresolvedRequests.length) fail('plan has unresolved requests for changes');
  if(plan.initialApprovalCycle!==undefined && plan.initialApprovalCycle!==true && plan.initialApprovalCycle!==false) fail('plan initial approval cycle is malformed');
  return {id,revision:plan.revision,reviewedSha,initialApprovalCycle:plan.initialApprovalCycle===true};
}

/**
 * Evaluates a complete host-review snapshot. It is deliberately pure: a
 * caller-provided snapshot is diagnostic/test data only. The trusted CLI
 * obtains that snapshot with authenticated gh api before using this result.
 */
export function evaluateReviews({stage,head,requiredRoles,identities,reviews,plan}={}) {
  const currentHead=sha(head);
  const order=stageOrder(stage);
  if(!Array.isArray(requiredRoles) || !requiredRoles.length || requiredRoles.some(role=>typeof role!=='string') || new Set(requiredRoles).size!==requiredRoles.length) fail('required roles are malformed');
  if(requiredRoles.some(role=>!order.includes(role))) fail('required roles are invalid for this stage');
  if(requiredRoles.some((role,index)=>order.indexOf(role)!==index && requiredRoles.slice(0,index).some(previous=>order.indexOf(previous)>order.indexOf(role)))) fail('required roles violate stage order');
  const mappings=identitiesFor(requiredRoles,identities);
  const normalized=normalizedReviews(reviews,currentHead);
  const planReceipt=stage==='plan'?planBinding(plan,currentHead):null;
  const receipts=[];
  for(const role of requiredRoles) {
    const mapping=mappings[role],verdict=latestEffective(normalized,mapping.actor,currentHead);
    if(!verdict) fail(`${role} has no effective approval on the current head`);
    if(verdict.actorType!==(mapping.kind==='human'?'User':'Bot')) fail(`${role} approval must be from the mapped ${mapping.kind} actor`);
    if(verdict.state==='CHANGES_REQUESTED') fail(`${role} has unresolved changes requested`);
    if(verdict.state==='DISMISSED') fail(`${role} approval is dismissed`);
    if(verdict.state!=='APPROVED') fail(`${role} has no approving verdict`);
    const receipt={stage,role,actor:mapping.actor,actorRoleProvenance:mapping.provenance,reviewId:verdict.id,reviewedSha:currentHead,verdict:verdict.state,dismissed:false};
    if(planReceipt) Object.assign(receipt,{planId:planReceipt.id,planRevision:planReceipt.revision,unresolvedRequests:false,initialApprovalCycle:planReceipt.initialApprovalCycle});
    receipts.push(receipt);
  }
  return {approved:true,stage,head:currentHead,receipts};
}

export function assertSameHead(observed,expected) {
  if(sha(observed,'observed head')!==sha(expected,'expected head')) fail('head changed during host review verification');
  return true;
}

/** Current check-run records are host evidence too; pending or failed runs
 * cannot be carried forward as an approval for a later merge. */
export function evaluateChecks({head,checks}={}) {
  const currentHead=sha(head);
  if(!Array.isArray(checks)) fail('checks must be a complete paginated array');
  return checks.map(check=>{
    if(!object(check) || (typeof check.id!=='string' && !Number.isInteger(check.id)) || typeof check.name!=='string' || !check.name.trim()
      || typeof check.status!=='string') fail('check record is malformed');
    if(check.status.toLowerCase()!=='completed') fail(`check ${check.name} is pending`);
    const conclusion=typeof check.conclusion==='string'?check.conclusion.toLowerCase():'';
    if(!['success','neutral','skipped'].includes(conclusion)) fail(`check ${check.name} did not pass`);
    return {id:String(check.id),name:check.name,status:'completed',conclusion,head:currentHead};
  });
}
