#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition} from './lib/workspace-config.mjs';
import {assertAcceptedWorkspaceConfig} from './lib/workspace-history.mjs';
import {resolveTierDefaults} from './lib/tier-defaults.mjs';
import {decideAction} from './lib/workflow-authorization.mjs';
import {withWorkflowState} from './lib/workflow-state.mjs';

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
 const worktreeAcceptance=assertAcceptedWorkspaceConfig(worktree,config);
 // Legacy accepted policies inherit the immutable Tier 1 shared definition;
 // their old direct-merge knob remains only a compatibility override.
 const definition=workspaceTierDefinition(config) ?? resolveTierDefaults({tier:1,overrides:{direct_merge:config.task_tiers?.tier_1_direct_merge},templateRepository:true}).definition;
 const branch=git(worktree,['symbolic-ref','--quiet','--short','HEAD']);
 if(!/^epic\/EPIC-\d+$/.test(branch)) fail('workflow event requires an epic worktree branch');
 return {worktree,policy:{...config,provenance:{digest:workspaceConfigDigest(config),definition,rootAcceptance:`workspace:${rootAcceptance.revision}:${rootAcceptance.digest}`,worktreeAcceptance:`workspace:${worktreeAcceptance.revision}:${worktreeAcceptance.digest}`}},branch};
}
function trustedActor(actor) {
 const harness=actor?.harness;
 if(!object(harness) || harness.authenticated!==true || typeof harness.sessionId!=='string' || !harness.sessionId.trim() || typeof harness.identity!=='string' || !harness.identity.trim()) fail('trusted harness actor is required');
 return actor;
}
function validateEvent(event,identity) {
 const allowed=['id','type','epic','authorizationId','completionCriterion','repository','branch','scope','completionId'];
 if(!object(event) || Object.keys(event).some(key=>!allowed.includes(key))) fail('is malformed or claims actor authority');
 const id=text(event.id,'delivery ID'),type=text(event.type,'type');if(!TYPES.has(type)) fail('type is unsupported');
 const epic=text(event.epic,'epic');if(!/^EPIC-\d+$/.test(epic)) fail('epic is malformed');
 const authorizationId=text(event.authorizationId,'authorization ID'),completionCriterion=text(event.completionCriterion,'completion criterion');
 if(event.repository!==undefined && event.repository!==identity.repository) fail('repository does not match accepted policy');
 if(event.branch!==undefined && event.branch!==identity.branch) fail('branch does not match registered worktree');
 const scope=`epics/${epic}`;
 if(event.scope!==undefined && event.scope!==scope) fail('scope does not match epic');
 if(type==='epic.complete' && typeof event.completionId!=='string') fail('completion ID is required');
 if(type!=='epic.complete' && event.completionId!==undefined) fail('completion ID is only valid for epic completion');
 return {id,type,epic,authorizationId,completionCriterion,scope,completionId:event.completionId};
}

/**
 * Handles data supplied by the adapter. The adapter must pass actor from its
 * authenticated session; event JSON can only reference stored authority.
 */
export function handleWorkflowEvent({root,event,actor}={}) {
 trustedActor(actor);
 const resolved=acceptedPolicy(root),identity={repository:resolved.policy.workspace.repository,branch:resolved.branch};
 const input=validateEvent(event,identity);
 return withWorkflowState(resolved.worktree,state=>{
  const existing=state.dispatches[input.id];
  if(existing) {
   if(JSON.stringify(existing.event)!==JSON.stringify(input)) fail('duplicate delivery ID has different event data');
   return existing.output;
  }
  const authorization=state.authorizations[input.authorizationId];
  if(!authorization) fail('referenced authorization is absent');
  if(input.type==='epic.start') {
   const current=state.epics[input.epic];
   if(current?.active===true) fail('epic is already active');
  }
  if(input.type==='epic.complete') {
   const completion=state.epics[input.epic]?.completion;
   if(!completion || completion.id!==input.completionId) fail('completion evidence is absent or does not match');
  }
  const decision=decideAction({authorization,policy:resolved.policy,actor,action:{repository:identity.repository,branch:identity.branch,scope:input.scope,name:input.type,completionCriterion:input.completionCriterion}});
  const output={deliveryId:input.id,decision:decision.decision,reason:decision.reason,action:{type:input.type,repository:identity.repository,branch:identity.branch,scope:input.scope,epic:input.epic,authorizationId:input.authorizationId}};
  state.dispatches[input.id]={event:input,output};
  if(input.type==='epic.start') state.epics[input.epic]={...(state.epics[input.epic]??{}),active:true,repository:identity.repository,branch:identity.branch};
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
function harnessActorFromEnvironment() {
 const raw=process.env.WORKFLOW_HARNESS_ACTOR;
 if(!raw) fail('trusted harness actor is required');
 try { return JSON.parse(raw); } catch { fail('trusted harness actor is invalid'); }
}
export async function runWorkflowEvent(args=process.argv.slice(2)) {
 const options=argumentsFor(args),event=await stdinEvent();
 if(event?.type!==options.type) fail('event type must match the requested entrypoint');
 const output=handleWorkflowEvent({root:options.root,event,actor:harnessActorFromEnvironment()});
 process.stdout.write(`${JSON.stringify(output)}\n`);
 return output;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) runWorkflowEvent().catch(error=>{process.stderr.write(`workflow-event: ${error.message}\n`);process.exitCode=1;});
