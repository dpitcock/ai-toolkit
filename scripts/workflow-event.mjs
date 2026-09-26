#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseWorkspaceConfig,resolveWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition} from './lib/workspace-config.mjs';
import {assertAcceptedWorkspaceConfig} from './lib/workspace-history.mjs';
import {resolveTierDefaults} from './lib/tier-defaults.mjs';
import {decideAction} from './lib/workflow-authorization.mjs';
import {withWorkflowState} from './lib/workflow-state.mjs';
import {check,readDocument,checkWorkflowReadiness} from './check-gate.mjs';
import {applyReviewEvent} from './lib/review-scheduling.mjs';
import {evaluateHostReviewGate} from './check-host-reviews.mjs';
import {evaluateCompletion,admitEpic} from './lib/epic-completion.mjs';
import {validateEpicAdmission} from './lib/workflow-admission.mjs';

const MAX_INPUT_BYTES=64*1024;
const TYPES=new Set(['epic.start','task.dispatch','review.ready','merge.eligible','epic.complete']);
function fail(message) { throw new Error(`Workflow event ${message}`); }
function text(value,label) { if(typeof value!=='string' || !value.trim()) fail(`${label} must be a non-empty string`);return value.trim(); }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function git(root,args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim(); }

function canonicalRoot(root) {
 const result=fs.realpathSync(root);
 if(fs.realpathSync(git(result,['rev-parse','--show-toplevel']))!==result) fail('root must be a registered worktree root');
 const worktrees=git(result,['worktree','list','--porcelain']).split('\n').filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
 if(!worktrees.includes(result)) fail('root is not a registered worktree');
 return {root:result,coordinationRoot:worktrees[0]};
}
function acceptedPolicy(root) {
 const {root:worktree,coordinationRoot}=canonicalRoot(root);
 const {config}=resolveWorkspaceConfig({coordinationRoot,worktreeRoot:worktree});
 const rootAcceptance=assertAcceptedWorkspaceConfig(coordinationRoot,resolveWorkspaceConfig({coordinationRoot}).config);
 const worktreeAcceptance=assertAcceptedWorkspaceConfig(worktree,parseWorkspaceConfig(fs.readFileSync(path.join(worktree,'config/workspace-config.yaml'),'utf8')));
 // Legacy accepted policies inherit the immutable Tier 1 shared definition;
 // their old direct-merge knob remains only a compatibility override.
 const definition=workspaceTierDefinition(config) ?? resolveTierDefaults({tier:1,overrides:{direct_merge:config.task_tiers?.tier_1_direct_merge},templateRepository:true}).definition;
 const branch=git(worktree,['symbolic-ref','--quiet','--short','HEAD']);
 if(!/^epic\/EPIC-\d+$/.test(branch)) fail('workflow event requires an epic worktree branch');
 const origin=git(coordinationRoot,['remote','get-url','origin']);
 const match=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
 if(!match) fail('repository origin must identify a canonical GitHub repository');
 return {worktree,coordinationRoot,repository:match[1],policy:{...config,provenance:{digest:workspaceConfigDigest(config),definition,rootAcceptance:`workspace:${rootAcceptance.revision}:${rootAcceptance.digest}`,worktreeAcceptance:`workspace:${worktreeAcceptance.revision}:${worktreeAcceptance.digest}`}},branch};
}
function trustedActor(actor) {
 const harness=actor?.harness;
 if(!object(harness) || harness.authenticated!==true || typeof harness.sessionId!=='string' || !harness.sessionId.trim() || typeof harness.identity!=='string' || !harness.identity.trim()) fail('trusted harness actor is required');
 return actor;
}
function validateEvent(event,identity) {
 const allowed=['id','type','epic','authorizationId','completionCriterion','repository','branch','scope','completionId','task'];
 if(!object(event) || Object.keys(event).some(key=>!allowed.includes(key))) fail('is malformed or claims actor authority');
 const id=text(event.id,'delivery ID'),type=text(event.type,'type');if(!TYPES.has(type)) fail('type is unsupported');
 const epic=text(event.epic,'epic');if(!/^EPIC-\d+$/.test(epic)) fail('epic is malformed');
 if(identity.branch!==`epic/${epic}`) fail('epic does not match registered branch');
 const authorizationId=text(event.authorizationId,'authorization ID'),completionCriterion=text(event.completionCriterion,'completion criterion');
 if(event.repository!==undefined && event.repository!==identity.repository) fail('repository does not match accepted policy');
 if(event.branch!==undefined && event.branch!==identity.branch) fail('branch does not match registered worktree');
 const scope=`epics/${epic}`;
 if(event.scope!==undefined && event.scope!==scope) fail('scope does not match epic');
 if(type==='epic.complete' && typeof event.completionId!=='string') fail('completion ID is required');
 if(type!=='epic.complete' && event.completionId!==undefined) fail('completion ID is only valid for epic completion');
 if(type==='task.dispatch' && !/^TASK-\d+$/.test(event.task??'')) fail('task identifier is required');
 if(type!=='task.dispatch' && event.task!==undefined) fail('task is only valid for task dispatch');
 return {id,type,epic,authorizationId,completionCriterion,scope,completionId:event.completionId,task:event.task};
}

function canonicalPlan(root,epic) {
 const file=path.join(root,'epics',epic,'epic-plan.md');
 if(!fs.realpathSync(file).startsWith(`${root}${path.sep}`)) fail('canonical plan escapes checkout');
 const {data}=readDocument(file);
 if(data.kind!=='epic-plan' || data.parent!=='epic.md') fail('canonical epic plan is invalid');
 const epicFile=path.join(root,'epics',epic,'epic.md');
 if(readDocument(epicFile).data.id!==epic) fail('canonical epic ID does not match');
 return {file,data};
}
function observed(observers,name,context) {
 if(typeof observers?.[name]!=='function') fail(`${name} trusted controller observation is required`);
 const value=observers[name](context);
 if(value && typeof value.then==='function') fail('controller observations must be synchronous under the state lock');
 return value;
}
function pullRequest(plan,repository) {
 const match=plan.pr_url?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)$/);
 if(!match || match[1]!==repository) fail('canonical PR URL must match the repository');
 return Number(match[2]);
}
function lifecycle(state,input,resolved,identity,observers) {
 const root=resolved.worktree,{file,data:plan}=canonicalPlan(root,input.epic),head=git(root,['rev-parse','HEAD']);
 const context={root,repository:identity.repository,epic:input.epic,head};
 if(input.type==='task.dispatch') return checkWorkflowReadiness(file,{root,task:`tasks/${input.task}.md`});
 if(input.type==='review.ready') {
  const {roles}=checkWorkflowReadiness(file,{root});
  if(!plan.pr_url) return {review:{stage:'local',head,roles}};
  const pr=pullRequest(plan,identity.repository);
  const current=observed(observers,'pullRequest',{...context,pr});
  if(current?.repository!==identity.repository || current?.pr!==pr || current?.head!==head) fail('review readiness requires the live current PR head');
  const pushed=applyReviewEvent(state,{type:'push',repository:identity.repository,pr,head});
  state.reviews=applyReviewEvent(pushed.state,{type:'ready',repository:identity.repository,pr,head,roles}).state.reviews;
  return {review:{stage:'host',pr,head,roles,claims:Object.values(state.reviews).filter(record=>record.pr===pr && record.repository===identity.repository && record.head===head && roles.includes(record.role)).map(record=>record.claim)}};
 }
 if(input.type==='merge.eligible') {
  check(file,'pr',{root});
  const pr=pullRequest(plan,identity.repository),requiredRoles=plan.accessibility.ui?['code_reviewer','appsec','accessibility_reviewer']:['code_reviewer','appsec'];
  const trusted=observed(observers,'reviewAuthority',{...context,pr});
  const hostEvidence=evaluateHostReviewGate({repository:identity.repository,pr,head,stage:'final',requiredRoles,identities:trusted.identities,requiredChecks:['gates'],api:trusted.api});
  check(file,'merged',{root,head,hostEvidence});return {hostEvidence};
 }
 if(input.type==='epic.complete') {
  if(plan.status!=='merged') fail('completion requires canonical merged plan');
  const evidence=observed(observers,'completion',{...context,completionId:input.completionId});
  if(evidence?.repository!==identity.repository || evidence?.epic!==input.epic || evidence?.pullRequest!==pullRequest(plan,identity.repository) || evidence?.policy?.digest!==resolved.policy.provenance.digest) fail('completion does not bind canonical epic, PR, and accepted policy');
  const {receipt}=evaluateCompletion(evidence);
  admitEpic({completion:receipt,activeEpics:[],hostObservation:observed(observers,'integration',receipt)},{id:input.epic});
  state.epics[input.epic]={...state.epics[input.epic],completion:{id:input.completionId,receipt}};
  return {completion:receipt};
 }
 return {};
}

/**
 * Handles data supplied by the adapter. The adapter must pass actor from its
 * authenticated session; event JSON can only reference stored authority.
 */
export function handleWorkflowEvent({root,event,actor,observers}={}) {
 trustedActor(actor);
 const resolved=acceptedPolicy(root),identity={repository:resolved.repository,branch:resolved.branch};
 const input=validateEvent(event,identity);
 return withWorkflowState(resolved.worktree,state=>{
  const existing=state.dispatches[input.id];
  if(existing) {
   if(JSON.stringify(existing.event)!==JSON.stringify(input)) fail('duplicate delivery ID has different event data');
  }
  const authorization=state.authorizations[input.authorizationId];
  if(!authorization) fail('referenced authorization is absent');
  const decision=decideAction({authorization,policy:resolved.policy,actor,action:{repository:identity.repository,branch:identity.branch,scope:input.scope,name:input.type,completionCriterion:input.completionCriterion}});
  const output={deliveryId:input.id,decision:decision.decision,reason:decision.reason,action:{type:input.type,repository:identity.repository,branch:identity.branch,scope:input.scope,epic:input.epic,authorizationId:input.authorizationId}};
  if(decision.decision==='human-needed') return output;
  if(existing && input.type==='epic.start') return {...existing.output,decision:decision.decision,reason:decision.reason};
  if(input.type==='epic.start') {
   const current=state.epics[input.epic];
   if(current?.active===true) fail('epic is already active');
   validateEpicAdmission({root:resolved.worktree,epic:input.epic,state,observeIntegration:observers?.integration});
  }
  Object.assign(output,lifecycle(state,input,resolved,identity,observers));
  state.dispatches[input.id]={event:input,output};
  if(input.type==='epic.start') state.epics[input.epic]={...(state.epics[input.epic]??{}),active:true,provisioning:false,repository:identity.repository,branch:identity.branch};
  if(input.type==='epic.complete' && decision.decision!=='human-needed') state.epics[input.epic]={...state.epics[input.epic],active:false,completed:true};
  return output;
 });
}

async function stdinEvent() {
 const chunks=[];let size=0;
 for await(const chunk of process.stdin) { size+=chunk.length;if(size>MAX_INPUT_BYTES) fail(`JSON exceeds ${MAX_INPUT_BYTES} bytes`);chunks.push(chunk); }
 if(!size) fail('requires one JSON event on stdin');
 try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch(error) { fail(`JSON is invalid: ${error.message}`); }
}
function argumentsFor(args) {
 if(args.length!==3 || args[1]!=='--root') fail('usage: workflow-event.mjs EVENT --root PATH');
 return {type:args[0],root:path.resolve(args[2])};
}
export async function runWorkflowEvent(args=process.argv.slice(2),controller={}) {
 const options=argumentsFor(args),event=await stdinEvent();
 if(event?.type!==options.type) fail('event type must match the requested entrypoint');
 // Only an embedding controller can supply observed session context. Environment
 // JSON is caller data, not authentication. The standalone CLI fails closed.
 const output=handleWorkflowEvent({root:options.root,event,actor:controller.actor,observers:controller.observers});
 process.stdout.write(`${JSON.stringify(output)}\n`);
 if(output.decision==='human-needed') process.exitCode=1;
 return output;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) runWorkflowEvent().catch(error=>{process.stdout.write(`${JSON.stringify({decision:'human-needed',reason:error.message})}\n`);process.exitCode=1;});
