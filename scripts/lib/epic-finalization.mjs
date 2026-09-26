import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import YAML from 'yaml';
import {evaluateHostReviewGate} from '../check-host-reviews.mjs';

function fail(message) {throw new Error(`Epic finalization ${message}`);}
function git(root,args) {return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function sha(value) {if(!/^[a-f0-9]{40}$/.test(value??'')) fail('requires full commit identities');return value;}
export function canonicalRepository(root) {
 const origin=git(root,['remote','get-url','origin']);
 const match=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
 if(!match) fail('requires canonical GitHub origin');return match[1];
}
export function githubJSON(endpoint,{paginate=false}={}) {
 try {return JSON.parse(execFileSync('gh',['api',...(paginate?['--paginate','--slurp']:[]),endpoint],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:8*1024*1024}));}
 catch {fail('authenticated GitHub observation unavailable');}
}
export function hostPages(value,field) {
 if(!Array.isArray(value) || value.some(page=>!Array.isArray(field?page?.[field]:page))) fail('paginated host response is malformed');
 return value.flatMap(page=>field?page[field]:page);
}
function document(raw) {
 const match=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!match) fail('document frontmatter is missing');
 const parsed=YAML.parseDocument(match[1],{uniqueKeys:true});if(parsed.errors.length) fail('document frontmatter is invalid');
 const data=parsed.toJS({maxAliasCount:0}),invariant=parsed.clone();
 invariant.delete('status');invariant.delete('pr_url');
 return {data,syntax:invariant.toString(),body:raw.slice(match[0].length)};
}
export function assertFinalizationSnapshots({epic,repository,pr,before,after}={}) {
 if(!/^EPIC-\d+$/.test(epic??'')) fail('epic ID is malformed');
 const allowed=new Set([`epics/${epic}/epic-plan.md`,`epics/${epic}/epic.md`]);
 const changed=[...new Set([...before.tree.keys(),...after.tree.keys()])].filter(name=>!isDeepStrictEqual(before.tree.get(name),after.tree.get(name)));
 if(changed.some(name=>!allowed.has(name))) fail('only same-epic status and PR markers may change; source and policy must remain unchanged');
 for(const name of changed) {
  const left=before.tree.get(name),right=after.tree.get(name);
  if(!left || !right || left.mode!=='100644' || right.mode!=='100644' || left.type!=='blob' || right.type!=='blob') fail('markers must preserve regular files');
  const old=document(before.read(name)),next=document(after.read(name));
  const plan=name.endsWith('/epic-plan.md'),kind=plan?'epic-plan':'epic';
  if(old.data.kind!==kind || next.data.kind!==kind || ![plan?'ready-for-pr':'in-progress','merged'].includes(old.data.status) || ![old.data.status,'merged'].includes(next.data.status)) fail('marker status transition is invalid');
  if(!plan && old.data.id!==epic) fail('epic identity changed');
  const url=`https://github.com/${repository}/pull/${pr}`;
  if((old.data.pr_url && old.data.pr_url!==url) || (next.data.pr_url && next.data.pr_url!==url) || (old.data.pr_url && !next.data.pr_url)) fail('PR marker must name the original canonical merged PR');
  delete old.data.status;delete next.data.status;delete old.data.pr_url;delete next.data.pr_url;
  if(old.body!==next.body || old.syntax!==next.syntax || !isDeepStrictEqual(old.data,next.data)) fail('reviewed body, scope, approvals and evidence must remain unchanged');
 }
 return {changed};
}
export function hostSnapshot(api,repository,revision) {
 sha(revision);const prefix=`repos/${repository}`;
 const value=api(`${prefix}/git/trees/${revision}?recursive=1`);
 if(value?.truncated!==false || !Array.isArray(value.tree)) fail('complete host tree is required');
 const tree=new Map();
 for(const entry of value.tree.filter(item=>item.type!=='tree')) {
  if(typeof entry.path!=='string' || tree.has(entry.path) || typeof entry.mode!=='string' || !/^[a-f0-9]{40}$/.test(entry.sha??'')) fail('host tree is malformed');
  tree.set(entry.path,{sha:entry.sha,mode:entry.mode,type:entry.type});
 }
 return {tree,read:name=>{
  const content=api(`${prefix}/contents/${name.split('/').map(encodeURIComponent).join('/')}?ref=${revision}`);
  if(content?.encoding!=='base64' || typeof content.content!=='string') fail('host document content is unavailable');
  return Buffer.from(content.content,'base64').toString('utf8');
 }};
}
export function localSnapshot(root,revision='HEAD',{working=false}={}) {
 const raw=execFileSync('git',['-C',root,'ls-tree','-rz',revision],{encoding:'utf8'}),tree=new Map();
 for(const entry of raw.split('\0').filter(Boolean)) {
  const match=entry.match(/^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/);if(!match) fail('local tree is malformed');
  tree.set(match[4],{mode:match[1],type:match[2],sha:match[3]});
 }
 if(working) {
  if(git(root,['ls-files','--others','--exclude-standard'])) fail('untracked files are not finalization markers');
  const changes=execFileSync('git',['-C',root,'diff','--name-only','-z',revision],{encoding:'utf8'}).split('\0').filter(Boolean);
  for(const name of changes) {
   const file=path.join(root,name);
   if(!fs.existsSync(file)) {tree.delete(name);continue;}
   const stat=fs.lstatSync(file);if(!stat.isFile() || stat.isSymbolicLink()) fail('working markers must be regular files');
   tree.set(name,{mode:stat.mode&0o111?'100755':'100644',type:'blob',sha:git(root,['hash-object','--',name])});
  }
 }
 return {tree,read:name=>working?fs.readFileSync(path.join(root,name),'utf8'):execFileSync('git',['-C',root,'show',`${revision}:${name}`],{encoding:'utf8'})};
}
export function assertHostFinalization({api=githubJSON,repository,epic,pr,from,to,ancestry=true}={}) {
 sha(from);sha(to);
 if(ancestry && from!==to) {
  const comparison=api(`repos/${repository}/compare/${from}...${to}`);
  if(comparison?.status!=='ahead' || comparison.base_commit?.sha!==from || comparison.merge_base_commit?.sha!==from) fail('integration must descend from the confirmed merge');
  const associated=hostPages(api(`repos/${repository}/commits/${to}/pulls?per_page=100`,{paginate:true}));
  const candidates=[];
  for(const item of associated) {
   if(!Number.isSafeInteger(item?.number) || item.number<1 || item.number===pr) continue;
   const pull=api(`repos/${repository}/pulls/${item.number}`);
   if(pull?.state==='closed' && pull.merged===true && pull.merge_commit_sha===to && pull.base?.ref==='main' && pull.base?.repo?.full_name===repository) candidates.push(pull);
  }
  if(candidates.length!==1) fail('advanced main must be the actual merged finalization PR result');
  assertFinalizationSnapshots({epic,repository,pr,before:hostSnapshot(api,repository,from),after:hostSnapshot(api,repository,sha(candidates[0].head?.sha))});
 }
 return assertFinalizationSnapshots({epic,repository,pr,before:hostSnapshot(api,repository,from),after:hostSnapshot(api,repository,to)});
}
function hostChecks(api,repository,head) {
 const checks=hostPages(api(`repos/${repository}/commits/${head}/check-runs?per_page=100`,{paginate:true}),'check_runs');
 const latest=checks.filter(check=>check.name==='gates').sort((a,b)=>a.id-b.id).at(-1);
 if(!Number.isSafeInteger(latest?.check_suite?.id)) fail('required check suite provenance is missing');
 const runs=hostPages(api(`repos/${repository}/actions/runs?check_suite_id=${latest.check_suite.id}&per_page=100`,{paginate:true}),'workflow_runs').filter(run=>run.check_suite_id===latest.check_suite.id);
 if(runs.length!==1 || runs[0].path!=='.github/workflows/workflow.yml' || runs[0].repository?.full_name!==repository || runs[0].head_sha!==head || !['push','pull_request'].includes(runs[0].event) || runs[0].status!=='completed' || runs[0].conclusion!=='success') fail('required check workflow provenance is invalid');
 return checks;
}
export function observeMergedEpic({root,epic,plan,api=githubJSON,reviews=true,working=true,revision='HEAD'}={}) {
 const repository=canonicalRepository(root),match=plan.pr_url?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)$/);
 if(!match || match[1]!==repository) fail('PR URL does not match canonical origin');
 const pr=Number(match[2]),prefix=`repos/${repository}`;
 const pull=api(`${prefix}/pulls/${pr}`);
 if(pull?.merged!==true || pull.state!=='closed' || pull.base?.ref!=='main' || pull.base?.repo?.full_name!==repository) fail('original PR is not confirmed merged into canonical main');
 const submittedHead=sha(pull.head?.sha),mergeCommit=sha(pull.merge_commit_sha),integrationSha=sha(api(`${prefix}/git/ref/heads/main`)?.object?.sha);
 assertHostFinalization({api,repository,epic,pr,from:submittedHead,to:mergeCommit,ancestry:false});
 assertHostFinalization({api,repository,epic,pr,from:mergeCommit,to:integrationSha});
 const local=localSnapshot(root,revision,{working});
 assertFinalizationSnapshots({epic,repository,pr,before:hostSnapshot(api,repository,mergeCommit),after:local});
 const localChanges=assertFinalizationSnapshots({epic,repository,pr,before:hostSnapshot(api,repository,integrationSha),after:local}).changed;
 let hostEvidence;
 if(reviews) {
  const mapping=api(`${prefix}/actions/variables/GOVERNANCE_REVIEW_IDENTITIES`);
  let identities;try {identities=JSON.parse(mapping.value);} catch {fail('owner-managed reviewer identities are unavailable');}
  const requiredRoles=plan.accessibility?.ui?['code_reviewer','appsec','accessibility_reviewer']:['code_reviewer','appsec'];
  hostEvidence=evaluateHostReviewGate({repository,pr,head:submittedHead,stage:'final',requiredRoles,identities,requiredChecks:['gates'],api:{pull:()=>api(`${prefix}/pulls/${pr}`).head?.sha,reviews:()=>hostPages(api(`${prefix}/pulls/${pr}/reviews?per_page=100`,{paginate:true})),checks:()=>hostChecks(api,repository,submittedHead)}});
 }
 const latest=api(`${prefix}/pulls/${pr}`);
 if(latest?.merged!==true || latest.head?.sha!==submittedHead || latest.merge_commit_sha!==mergeCommit || api(`${prefix}/git/ref/heads/main`)?.object?.sha!==integrationSha) fail('merged host state changed during observation');
 return {source:'authenticated-github-api',repository,pr,submittedHead,mergeCommit,integrationSha,hostEvidence,localChanges};
}
