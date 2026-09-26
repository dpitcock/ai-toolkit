import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {localSnapshot} from './epic-finalization.mjs';
import {ACTIVATION_REPORT,ACTIVATION_DOCUMENT,validateActivationReport,replaceActivationBlock,activationBlockBounds} from './activation-report.mjs';

export const ACTIVATION_PATHS=[ACTIVATION_DOCUMENT,ACTIVATION_REPORT];
function fail(message) {throw new Error(`Activation history ${message}`);}
function git(root,args) {return execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'utf8',stdio:'pipe',maxBuffer:16*1024*1024}).trim();}
function regular(snapshot,name) {
 const entry=snapshot.tree.get(name);
 if(entry?.mode!=='100644' || entry.type!=='blob') fail(`${name} must be a regular non-executable file`);
 return snapshot.read(name);
}
/** One snapshot boundary, also used for staged and uncommitted proposals. */
export function assertActivationSnapshot({before,after,base,digest,empty=false}) {
 const paths=[...new Set([...before.tree.keys(),...after.tree.keys()])].filter(name=>!equal(before.tree.get(name),after.tree.get(name))).sort();
 if(empty && paths.length===0) {activationBlockBounds(regular(before,ACTIVATION_DOCUMENT));return {paths,report:null};}
 if(!equal(paths,ACTIVATION_PATHS)) fail('diff must change exactly the two deliverable paths');
 const report=validateActivationReport(regular(after,ACTIVATION_REPORT));
 if(report.activationBase!==base || report.loadedRevision!==base || report.policyDigest!==digest) fail('report base, loaded revision or policy differs from verified I');
 const expected=replaceActivationBlock(regular(before,ACTIVATION_DOCUMENT),report);
 if(regular(after,ACTIVATION_DOCUMENT)!==expected) fail('document must equal the renderer with all outside bytes preserved');
 return {paths,report};
}
/** Every submitted commit and integrated snapshot is checked, including edit/revert history. */
export function assertActivationHistory({root,base,head,digest,integratedHead,empty=false}) {
 if(!/^[a-f0-9]{40}$/.test(base??'') || !/^[a-f0-9]{40}$/.test(head??'')) fail('full revisions required');
 git(root,['merge-base','--is-ancestor',base,head]);
 const before=localSnapshot(root,base),result=assertActivationSnapshot({before,after:localSnapshot(root,head),base,digest,empty});
 const commits=git(root,['rev-list','--reverse',`${base}..${head}`]).split('\n').filter(Boolean),meaningful=[];
 for(const revision of commits) {
  const parents=git(root,['show','-s','--format=%P',revision]).split(' ');
  if(parents.length!==1 && !(revision===head && integratedHead && equal(parents,[base,integratedHead]))) fail('unrelated merge is forbidden');
  const paths=git(root,['diff-tree','--root','-m','--no-commit-id','--no-renames','--name-only','-z','-r',revision]).split('\0').filter(Boolean);
  if(paths.some(name=>!ACTIVATION_PATHS.includes(name))) fail('intermediate commit changes an unauthorized path');
  const snapshot=assertActivationSnapshot({before,after:localSnapshot(root,revision),base,digest});
  if(paths.length && snapshot.report) meaningful.push(revision);
 }
 return {...result,commits,meaningful};
}
