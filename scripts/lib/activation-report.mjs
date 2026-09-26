// Pure untrusted-data boundary. No file reads, fetches, commands or authority.
export const ACTIVATION_REPORT='project/EPIC-006-activation-evidence.json';
export const ACTIVATION_DOCUMENT='docs/verification.md';
export const ACTIVATION_START='<!-- EPIC-006 ACTIVATION EVIDENCE START -->';
export const ACTIVATION_END='<!-- EPIC-006 ACTIVATION EVIDENCE END -->';
const KINDS=new Set(['activation','smoke','restart','admission','routine-action','readiness','claim','ack','reconciliation','host-review','host-check']);
const SHA=/^[a-f0-9]{40}$/;
function fail(message) {throw new Error(`Activation report ${message}`);}
function exact(value,keys) {
 if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join(',')!==[...keys].sort().join(',')) fail('schema has missing or unknown fields');
}
export function validateActivationReport(input) {
 const raw=typeof input==='string'?input:JSON.stringify(input);
 if(typeof raw!=='string' || Buffer.byteLength(raw)>32768) fail('exceeds bounded size');
 let value;try {value=JSON.parse(raw);} catch {fail('JSON is malformed');}
 exact(value,['version','epic','repository','activationBase','loadedRevision','policyDigest','observations']);
 if(value.version!==1 || value.epic!=='EPIC-006' || value.repository!=='dpitcock/ai-toolkit') fail('identity is outside the finite release');
 if(!SHA.test(value.activationBase) || !SHA.test(value.loadedRevision) || !/^[a-f0-9]{64}$/.test(value.policyDigest)) fail('revision or policy digest is malformed');
 if(!Array.isArray(value.observations) || !value.observations.length || value.observations.length>128) fail('observations exceed bound');
 for(const item of value.observations) {
  exact(item,['kind','status','at','head','references']);
  if(!KINDS.has(item.kind) || !['observed','pending','not-exercised'].includes(item.status)) fail('observation kind or status is unsupported');
  if(!Array.isArray(item.references) || item.references.length>8) fail('reference bound exceeded');
  if(item.status==='observed') {
   if(typeof item.at!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.at) || !Number.isFinite(Date.parse(item.at)) || new Date(item.at).toISOString()!==item.at || !SHA.test(item.head) || !item.references.length) fail('observed fact requires time, head and references');
  } else if(item.at!==null || item.head!==null || item.references.length) fail('unobserved facts cannot carry observed receipts');
  for(const reference of item.references) {
   exact(reference,['type','id']);
   if(!['session','git','host','runtime'].includes(reference.type) || typeof reference.id!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,199}$/.test(reference.id)) fail('reference must be a bounded opaque identifier, not a path or executable content');
  }
 }
 return value;
}
export function activationBlockBounds(document) {
 if(typeof document!=='string' || Buffer.byteLength(document)>1024*1024) fail('document exceeds bound');
 const start=document.indexOf(ACTIVATION_START),end=document.indexOf(ACTIVATION_END);
 if(start<0 || end<start || document.indexOf(ACTIVATION_START,start+1)!==-1 || document.indexOf(ACTIVATION_END,end+1)!==-1
  || (start>0 && document[start-1]!=='\n') || !['\n','\r'].includes(document[start+ACTIVATION_START.length])
  || document[end-1]!=='\n' || (document[end+ACTIVATION_END.length]!==undefined && !['\n','\r'].includes(document[end+ACTIVATION_END.length]))) fail('fixed markers must occur exactly once on separate lines');
 return {start,end:end+ACTIVATION_END.length};
}
export function renderActivationBlock(input) {
 const report=validateActivationReport(input);
 return [ACTIVATION_START,'','EPIC-006 activation observations are recorded in [the bounded release report](../project/EPIC-006-activation-evidence.json).',
  'Report claims are evidence for independent review; current-head release authority remains in the authenticated host and runtime.',
  '',`Activation base: \`${report.activationBase}\`. Loaded revision: \`${report.loadedRevision}\`.`,
  `Effective policy: \`${report.policyDigest}\`.`,
  '','| Kind | Status | Observed at | Head | Evidence identifiers |','| --- | --- | --- | --- | --- |',
  ...report.observations.map(item=>`| ${item.kind} | ${item.status} | ${item.at??'—'} | ${item.head??'—'} | ${item.references.map(ref=>`${ref.type}:${ref.id}`).join(', ')||'—'} |`),
  '',ACTIVATION_END].join('\n');
}
export function replaceActivationBlock(document,report) {
 const {start,end}=activationBlockBounds(document);
 return document.slice(0,start)+renderActivationBlock(report)+document.slice(end);
}
