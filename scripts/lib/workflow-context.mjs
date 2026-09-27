import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {parseWorkspaceConfig,resolveWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition} from './workspace-config.mjs';
import {assertAcceptedWorkspaceConfig} from './workspace-history.mjs';
import {resolveTierDefaults} from './tier-defaults.mjs';
function fail(message) {throw new Error(`Workflow event ${message}`);}
function git(root,args) {return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8'}).trim();}
export function trustedActor(actor) {
 const harness=actor?.harness;
 if(!harness || typeof harness!=='object' || Array.isArray(harness) || harness.authenticated!==true || typeof harness.sessionId!=='string' || !harness.sessionId.trim() || typeof harness.identity!=='string' || !harness.identity.trim()) fail('trusted harness actor is required');
 return actor;
}
export function acceptedPolicy(root) {
 const worktree=fs.realpathSync(root);
 if(fs.realpathSync(git(worktree,['rev-parse','--show-toplevel']))!==worktree) fail('root must be a registered worktree root');
 const worktrees=git(worktree,['worktree','list','--porcelain']).split('\n').filter(line=>line.startsWith('worktree ')).map(line=>fs.realpathSync(line.slice(9)));
 if(!worktrees.includes(worktree)) fail('root is not a registered worktree');
 const coordinationRoot=worktrees[0],{config}=resolveWorkspaceConfig({coordinationRoot,worktreeRoot:worktree});
 const rootAcceptance=assertAcceptedWorkspaceConfig(coordinationRoot,resolveWorkspaceConfig({coordinationRoot}).config);
 const worktreeAcceptance=assertAcceptedWorkspaceConfig(worktree,parseWorkspaceConfig(fs.readFileSync(path.join(worktree,'config/workspace-config.yaml'),'utf8')));
 const definition=workspaceTierDefinition(config) ?? resolveTierDefaults({tier:1,overrides:{direct_merge:config.task_tiers?.tier_1_direct_merge},templateRepository:true}).definition;
 const branch=git(worktree,['symbolic-ref','--quiet','--short','HEAD']);
 if(!/^epic\/EPIC-\d+$/.test(branch)) fail('workflow event requires an epic worktree branch');
 const origin=git(coordinationRoot,['remote','get-url','origin']),match=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
 if(!match) fail('repository origin must identify a canonical GitHub repository');
 return {worktree,coordinationRoot,repository:match[1],policy:{...config,provenance:{digest:workspaceConfigDigest(config),definition,rootAcceptance:`workspace:${rootAcceptance.revision}:${rootAcceptance.digest}`,worktreeAcceptance:`workspace:${worktreeAcceptance.revision}:${worktreeAcceptance.digest}`}},branch};
}
