const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^[a-f0-9]{64}$/i;
const AUTHENTICATED_HOST='authenticated-github-api';
const HARNESS='session-harness';

function fail(message) { throw new Error(`Epic completion ${message}`); }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function keys(value,allowed,label) {
 if(!object(value) || Object.keys(value).some(key=>!allowed.includes(key))) fail(`${label} is malformed`);
 return value;
}
function string(value,label) {
 if(typeof value!=='string' || !value.trim()) fail(`${label} must be a non-empty string`);
 return value.trim();
}
function sha(value,label) {
 if(typeof value!=='string' || !SHA.test(value)) fail(`${label} must be a full Git SHA`);
 return value.toLowerCase();
}
function instant(value,label) {
 if(typeof value!=='string' || !Number.isFinite(Date.parse(value))) fail(`${label} must be an observation time`);
 return value;
}
function id(value,label) { return string(value,label); }
function ids(value,label) {
 if(!Array.isArray(value) || !value.length || value.some(item=>typeof item!=='string' || !item.trim()) || new Set(value).size!==value.length) fail(`${label} must be non-empty unique resource IDs`);
 return [...value];
}
function positive(value,label) { if(!Number.isInteger(value) || value<1) fail(`${label} must be a positive integer`);return value; }

function checkReceipts(checks,integrationSha) {
 if(!Array.isArray(checks) || !checks.length) fail('integrated checks are required');
 const known=new Set();
 return checks.map(raw=>{
  keys(raw,['id','name','status','conclusion','head'],'check receipt');
  const receipt={id:id(raw.id,'check ID'),name:string(raw.name,'check name'),status:string(raw.status,'check status').toLowerCase(),conclusion:typeof raw.conclusion==='string'?raw.conclusion.toLowerCase():'',head:sha(raw.head,'check head')};
  if(known.has(receipt.id)) fail('check IDs must be unique');known.add(receipt.id);
  if(receipt.head!==integrationSha) fail('check is not bound to the integration SHA');
  if(receipt.status!=='completed') fail(`check ${receipt.name} is pending`);
  if(!['success','neutral','skipped'].includes(receipt.conclusion)) fail(`check ${receipt.name} did not pass`);
  return receipt;
 });
}

function hostReceipt(value,{repository,epic,pullRequest,integrationSha}={}) {
 keys(value,['source','observedAt','merged','mergeCommit','checks','smoke','finalization'],'host receipt');
 if(value.source!==AUTHENTICATED_HOST) fail('host facts must come from the authenticated host');
 const observedAt=instant(value.observedAt,'host observation');
 if(value.merged!==true) fail('pull request is not merged');
 const mergeCommit=sha(value.mergeCommit,'merge commit');
 let finalization;
 if(mergeCommit!==integrationSha) {
  if(!value.finalization) fail('merge result does not match integration SHA without finalization proof');
  keys(value.finalization,['from','to','paths'],'finalization proof');
  if(value.finalization.from!==mergeCommit || value.finalization.to!==integrationSha || !Array.isArray(value.finalization.paths) || !value.finalization.paths.length || new Set(value.finalization.paths).size!==value.finalization.paths.length || value.finalization.paths.some(name=>![`epics/${epic}/epic.md`,`epics/${epic}/epic-plan.md`].includes(name))) fail('finalization must bind merge and integration SHA through same-epic markers');
  finalization=structuredClone(value.finalization);
 } else if(value.finalization!==undefined) fail('unchanged integration cannot claim finalization advancement');
 const checks=checkReceipts(value.checks,integrationSha);
 keys(value.smoke,['revision','result'],'smoke receipt');
 if(sha(value.smoke.revision,'smoke revision')!==integrationSha || value.smoke.result!=='passed') fail('integrated smoke evidence is incomplete');
 return {source:AUTHENTICATED_HOST,observedAt,repository,pullRequest,mergeCommit,integrationSha,...(finalization?{finalization}:{}),checks,smoke:{revision:integrationSha,result:'passed'}};
}

function activationReceipt(value) {
 keys(value,['source','observedAt','active','agentPath','resourceIds'],'activation receipt');
 if(value.source!==HARNESS || value.active!==true) fail('active session activation evidence is required');
 return {source:HARNESS,observedAt:instant(value.observedAt,'activation observation'),agentPath:string(value.agentPath,'agent path'),resourceIds:ids(value.resourceIds,'activation')};
}

function cleanupReceipt(value,epic) {
 keys(value,['source','observedAt','revalidated','worktrees','branches','processes'],'cleanup receipt');
 if(value.source!==HARNESS || value.revalidated!==true) fail('owned cleanup must be revalidated immediately before execution');
 const registered=new Set();
 const worktrees=collection(value.worktrees,'worktrees').map(raw=>{
  keys(raw,['id','path','owner','contained','clean','root','symlink'],'worktree cleanup');
  const item={id:id(raw.id,'worktree ID'),path:string(raw.path,'worktree path'),owner:string(raw.owner,'worktree owner'),contained:raw.contained===true,clean:raw.clean===true,root:raw.root===true,symlink:raw.symlink===true};
  if(registered.has(item.id)) fail('cleanup resource IDs must be unique');registered.add(item.id);
  if(item.owner!==epic || !item.contained || !item.clean || item.root || item.symlink) fail('worktree cleanup is not safely owned and contained');
  return item;
 });
 const branches=collection(value.branches,'branches').map(raw=>{
  keys(raw,['id','name','owner','pushed'],'branch cleanup');
  const item={id:id(raw.id,'branch ID'),name:string(raw.name,'branch name'),owner:string(raw.owner,'branch owner'),pushed:raw.pushed===true};
  if(registered.has(item.id)) fail('cleanup resource IDs must be unique');registered.add(item.id);
  if(item.owner!==epic || !item.pushed) fail('branch cleanup is not safely owned and pushed'); return item;
 });
 const processes=collection(value.processes,'processes').map(raw=>{
  keys(raw,['id','owner','contained','stopped','forced'],'process cleanup');
  const item={id:id(raw.id,'process ID'),owner:string(raw.owner,'process owner'),contained:raw.contained===true,stopped:raw.stopped===true,forced:raw.forced===true};
  if(registered.has(item.id)) fail('cleanup resource IDs must be unique');registered.add(item.id);
  if(item.owner!==epic || !item.contained || !item.stopped || item.forced) fail('process cleanup is not safely owned and contained'); return item;
 });
 return {source:HARNESS,observedAt:instant(value.observedAt,'cleanup observation'),revalidated:true,worktrees,branches,processes};
}
// An explicitly observed empty inventory is valid; an absent inventory is not.
function collection(value,label) { if(!Array.isArray(value)) fail(`${label} cleanup evidence is required`);return value; }

/** Pure evaluation of typed receipts. Callers must independently fetch the host
 * observation again in admitEpic; a fixture or arbitrary JSON is never enough. */
export function evaluateCompletion(evidence={}) {
 keys(evidence,['repository','epic','pullRequest','submittedHead','integrationSha','host','policy','findings','documentation','activation','cleanup','correctivePullRequests'],'completion evidence');
 const repository=string(evidence.repository,'repository'),epic=string(evidence.epic,'epic'),pullRequest=positive(evidence.pullRequest,'pull request');
 const submittedHead=sha(evidence.submittedHead,'submitted head'),integrationSha=sha(evidence.integrationSha,'integration SHA');
 const host=hostReceipt(evidence.host,{repository,epic,pullRequest,integrationSha});
 keys(evidence.policy,['digest','loadedRevision'],'policy receipt');
 if(typeof evidence.policy.digest!=='string' || !DIGEST.test(evidence.policy.digest)) fail('policy digest is malformed');
 if(!Number.isInteger(evidence.policy.loadedRevision) || evidence.policy.loadedRevision<1) fail('loaded policy revision is malformed');
 keys(evidence.findings,['unresolved'],'findings receipt');
 if(!Array.isArray(evidence.findings.unresolved) || evidence.findings.unresolved.some(value=>typeof value!=='string' || !value.trim())) fail('findings are malformed');
 if(evidence.findings.unresolved.length) fail('epic has unresolved findings');
 keys(evidence.documentation,['revision','current'],'documentation receipt');
 if(sha(evidence.documentation.revision,'documentation revision')!==integrationSha || evidence.documentation.current!==true) fail('documentation is not current on the integrated revision');
 if(!Array.isArray(evidence.correctivePullRequests) || evidence.correctivePullRequests.some(value=>!Number.isInteger(value) || value<1)) fail('corrective pull requests are malformed');
 if(evidence.correctivePullRequests.length) fail('corrective pull requests keep the epic active');
 const receipt={repository,epic,pullRequest,submittedHead,integrationSha,host,policy:{digest:evidence.policy.digest.toLowerCase(),loadedRevision:evidence.policy.loadedRevision},activation:activationReceipt(evidence.activation),cleanup:cleanupReceipt(evidence.cleanup,epic)};
 return {complete:true,receipt};
}

function hostAdmission(value,receipt) {
 keys(value,['source','observedAt','repository','pullRequest','integrationSha','mergeCommit','checks','smoke','finalization'],'admission host observation');
 if(value.repository!==receipt.repository || positive(value.pullRequest,'admission pull request')!==receipt.pullRequest) fail('admission host observation is for a different pull request');
 if(sha(value.integrationSha,'admission integration SHA')!==receipt.integrationSha) fail('integrated state changed since completion');
 if(value.mergeCommit!==(receipt.host.mergeCommit??receipt.integrationSha)) fail('original merge result changed since completion');
 return hostReceipt({source:value.source,observedAt:value.observedAt,merged:true,mergeCommit:value.mergeCommit,checks:value.checks,smoke:value.smoke,...(value.finalization?{finalization:value.finalization}:{})},{repository:receipt.repository,epic:receipt.epic,pullRequest:receipt.pullRequest,integrationSha:receipt.integrationSha});
}

export function admitEpic(state={},nextEpic={}) {
 if(!object(state) || !object(nextEpic)) fail('admission input is malformed');
 const next=id(nextEpic.id,'next epic ID');
 if(state.deleted===true) fail('deleted completion state requires explicit recovery');
 if(state.historical===true) {
  keys(state.historicalBaseline,['epic','integrationSha','recordedAt'],'historical baseline');
  string(state.historicalBaseline.epic,'historical epic');sha(state.historicalBaseline.integrationSha,'historical integration SHA');instant(state.historicalBaseline.recordedAt,'historical baseline observation');
  if(!Array.isArray(state.activeEpics) || state.activeEpics.length) fail('another epic remains active');
  return {admitted:true,epic:next,historical:true};
 }
 if(!object(state.completion)) fail('completion receipt is required');
 const receipt=state.completion;
 // Re-evaluate through a narrow reconstruction to reject forged/malformed receipts.
 const verified=evaluateCompletion({repository:receipt.repository,epic:receipt.epic,pullRequest:receipt.pullRequest,submittedHead:receipt.submittedHead,integrationSha:receipt.integrationSha,host:{source:receipt.host.source,observedAt:receipt.host.observedAt,merged:true,mergeCommit:receipt.host.mergeCommit??receipt.integrationSha,checks:receipt.host.checks,smoke:receipt.host.smoke,...(receipt.host.finalization?{finalization:receipt.host.finalization}:{})},policy:receipt.policy,findings:{unresolved:[]},documentation:{revision:receipt.integrationSha,current:true},activation:{...receipt.activation,active:true},cleanup:receipt.cleanup,correctivePullRequests:[]}).receipt;
 hostAdmission(state.hostObservation,verified);
 if(state.currentIntegrationSha!==undefined && sha(state.currentIntegrationSha,'current integration SHA')!==verified.integrationSha) fail('integrated state changed since completion');
 if(!Array.isArray(state.activeEpics) || state.activeEpics.some(value=>typeof value!=='string')) fail('active epic state is malformed');
 if(state.activeEpics.length) fail('another epic remains active');
 return {admitted:true,epic:next};
}
