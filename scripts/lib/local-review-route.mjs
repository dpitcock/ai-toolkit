import {execFileSync} from 'node:child_process';
import {classifyReviewPaths,parseReviewPathPolicy,REVIEW_POLICY_PATH,TOOLKIT_REPOSITORY} from './review-paths.mjs';

function git(root,args) { return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
function revision(root,ref) {
  if(typeof ref!=='string' || !ref || ref.startsWith('-')) throw new Error('Review route requires a valid base/head ref');
  return git(root,['rev-parse','--verify','--end-of-options',`${ref}^{commit}`]).trim();
}

// Local classification is a planning/CI aid, never a host approval receipt.
// Only committed policy from the supplied trusted base can relax local routing.
export function localReviewRoute({root=process.cwd(),baseRef,headRef='HEAD',files,prNumber,configuredRoles=[]}={}) {
  let origin;
  try { origin=git(root,['remote','get-url','origin']).trim(); } catch { return {route:'legacy'}; }
  const repository=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1];
  if(repository!==TOOLKIT_REPOSITORY) return {route:'legacy'};
  const base=revision(root,baseRef);
  const entry=git(root,['ls-tree',base,'--',REVIEW_POLICY_PATH]).trim();
  if(!entry) return {route:'legacy'}; // Before adoption, keep existing gates.
  if(!/^100644 blob [a-f0-9]{40}\tpolicy\/review-paths\.json$/.test(entry)) throw new Error('Review policy must be a regular file');
  const policy=parseReviewPathPolicy(git(root,['show',`${base}:${REVIEW_POLICY_PATH}`]));
  if(prNumber!==undefined) {
    if(!Number.isSafeInteger(prNumber) || prNumber<1) throw new Error('Invalid PR number');
    if(prNumber<=policy.grandfatheredThroughPr) return {route:'legacy'};
  }
  const head=files===undefined?revision(root,headRef):null;
  // --no-renames reports old and new paths as deletion/addition.
  const changed=files??git(root,['diff','--no-renames','--name-only','-z',`${base}...${head}`]).split('\0').filter(Boolean);
  return {...classifyReviewPaths(policy,changed,configuredRoles),repository,base,head};
}
