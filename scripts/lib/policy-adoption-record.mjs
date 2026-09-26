// Schema checks only; observed authority and live Git/host proof belong to the controller.
const SHA=/^[a-f0-9]{40}$/,DIGEST=/^[a-f0-9]{64}$/;
function fail(message) {throw new Error(`Policy adoption record ${message}`);}
function object(value) {return value && typeof value==='object' && !Array.isArray(value);}
function keys(value,expected) {if(!object(value) || Object.keys(value).sort().join(',')!==[...expected].sort().join(',')) fail('schema is malformed');}
function text(value) {if(typeof value!=='string' || !value.trim() || value.length>2048) fail('text is malformed');}
function time(value) {text(value);if(!Number.isFinite(Date.parse(value))) fail('observation time is malformed');}
function sha(value) {if(!SHA.test(value??'')) fail('SHA is malformed');}
function digest(value) {if(!DIGEST.test(value??'')) fail('digest is malformed');}
function positive(value) {if(!Number.isSafeInteger(value) || value<1) fail('identity is malformed');}
function identity(value) {text(value);return value.trim().toLowerCase();}
export function validateAdoptionRelation(proof) {
 keys(proof,['kind','version','epic','repository','branch','original','finalization','assessment','plan','candidate','policy','adoption']);
 if(proof.kind!=='epic-policy-adoption' || proof.version!==1 || proof.epic!=='EPIC-006' || proof.repository!=='dpitcock/ai-toolkit' || proof.branch!=='epic/EPIC-006') fail('identity is outside the bounded route');
 keys(proof.original,['pr','submittedHead','mergeCommit']);positive(proof.original.pr);sha(proof.original.submittedHead);sha(proof.original.mergeCommit);
 keys(proof.finalization,['pr','from','to','paths']);positive(proof.finalization.pr);sha(proof.finalization.to);
 if(proof.finalization.from!==proof.original.mergeCommit || proof.finalization.pr===proof.original.pr || proof.finalization.to===proof.original.mergeCommit
  || !Array.isArray(proof.finalization.paths) || !proof.finalization.paths.length || new Set(proof.finalization.paths).size!==proof.finalization.paths.length || proof.finalization.paths.some(name=>!['epics/EPIC-006/epic-plan.md','epics/EPIC-006/epic.md'].includes(name))) fail('finalization binding is invalid');
 keys(proof.assessment,['path','commit','digest']);sha(proof.assessment.commit);digest(proof.assessment.digest);
 if(proof.assessment.path!=='project/task-assessments/governance-activation.yaml' || proof.assessment.commit!=='2a51c8fe0a35ebe224840d702ef5ae30f271407e') fail('assessment identity differs');
 keys(proof.plan,['id','revision']);if(proof.plan.id!=='EPIC-006-PLAN' || proof.plan.revision!==1) fail('plan identity differs');
 keys(proof.candidate,['path','blob','digest','definition']);sha(proof.candidate.blob);digest(proof.candidate.digest);
 if(proof.candidate.path!=='project/EPIC-006-root-migration.yaml' || proof.candidate.digest!=='7911a503ec901d38f0696ebaf333cdfa552f01482dbd393ac142eb41c46398fd') fail('candidate identity differs');
 keys(proof.candidate.definition,['version','digest']);positive(proof.candidate.definition.version);digest(proof.candidate.definition.digest);
 keys(proof.policy,['root','raw','canonical','definition','historyPrefix','history','acceptedBy']);
 for(const [key,revision] of [['root',1],['raw',2],['canonical',3]]) {keys(proof.policy[key],['digest','revision']);digest(proof.policy[key].digest);if(proof.policy[key].revision!==revision) fail('policy revision differs');}
 if(proof.policy.canonical.digest!==proof.candidate.digest || JSON.stringify(proof.policy.definition)!==JSON.stringify(proof.candidate.definition)) fail('canonical provenance differs');
 digest(proof.policy.historyPrefix);digest(proof.policy.history);text(proof.policy.acceptedBy);
 keys(proof.adoption,['base','head','pr','integrationSha']);sha(proof.adoption.head);
 if(proof.adoption.base!==proof.finalization.to) fail('adoption base differs');
 if(proof.adoption.pr!==null) {positive(proof.adoption.pr);if([proof.original.pr,proof.finalization.pr].includes(proof.adoption.pr)) fail('PR identity is reused');}
 if(proof.adoption.integrationSha!==null) {sha(proof.adoption.integrationSha);if(proof.adoption.pr===null) fail('integration lacks PR');}
 return proof;
}
export function validateAdoptionRecord(record) {
 keys(record,['version','phase','proof','owner','developer','developerSession','reviews','lastReview','publishedPr','observedAt']);
 if(record.version!==1 || !['prepared','locally-reviewed','published','integrated'].includes(record.phase)) fail('phase or schema is invalid');
 validateAdoptionRelation(record.proof);text(record.developer);text(record.developerSession);time(record.observedAt);
 keys(record.owner,['id','owner','repository','epic','branch','base','candidateDigest','oldRootDigest','oldRawDigest','rootUpdate','status']);
 text(record.owner.id);text(record.owner.owner);
 const proof=record.proof,owner=record.owner;
 if(identity(owner.owner)===identity(record.developer) || owner.repository!==proof.repository || owner.epic!==proof.epic || owner.branch!==proof.branch || owner.base!==proof.adoption.base || owner.candidateDigest!==proof.candidate.digest
  || owner.oldRootDigest!==proof.policy.root.digest || owner.oldRawDigest!==proof.policy.raw.digest || owner.owner!==proof.policy.acceptedBy || owner.rootUpdate!==true || owner.status!=='active') fail('owner binding is invalid');
 if(!Array.isArray(record.reviews) || record.reviews.length>2) fail('reviews are malformed');
 const seen=new Set([identity(record.developer)]),sessions=new Set([record.developerSession]);
 record.reviews.forEach((review,index)=>{
  keys(review,['role','by','sessionId','head','verdict','evidence','observedAt']);
  for(const name of ['by','sessionId','evidence']) text(review[name]);time(review.observedAt);
  if(review.role!==['code_reviewer','appsec'][index] || review.head!==proof.adoption.head || review.verdict!=='approved' || seen.has(identity(review.by)) || sessions.has(review.sessionId)) fail('independent ordered current-head reviews required');
  if(index && Date.parse(review.observedAt)<Date.parse(record.reviews[index-1].observedAt)) fail('AppSec observation must follow Staff');
  seen.add(identity(review.by));sessions.add(review.sessionId);
 });
 if(record.lastReview!==null) {
  const review=record.lastReview;keys(review,['role','by','sessionId','head','verdict','evidence','observedAt']);
  for(const name of ['by','sessionId','evidence']) text(review[name]);time(review.observedAt);
  if(!['code_reviewer','appsec'].includes(review.role) || !['approved','changes-requested','dismissed'].includes(review.verdict) || review.head!==proof.adoption.head
   || identity(review.by)===identity(record.developer) || review.sessionId===record.developerSession) fail('last review must be an independent observed current-head verdict');
  if(review.verdict!=='approved' && (record.phase!=='prepared' || record.reviews.length)) fail('adverse review must revoke all readiness');
 }
 if(record.phase!=='prepared' && record.reviews.length!==2) fail('both reviews required');
 if(record.publishedPr!==null) positive(record.publishedPr);
 if(['published','integrated'].includes(record.phase) && (record.publishedPr===null || proof.adoption.pr!==record.publishedPr)) fail('published PR binding required');
 if(record.phase==='integrated' && proof.adoption.integrationSha===null) fail('integration proof required');
 if(record.phase!=='integrated' && proof.adoption.integrationSha!==null) fail('premature integration proof');
 return record;
}
