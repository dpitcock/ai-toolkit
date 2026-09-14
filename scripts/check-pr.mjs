import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {check,readDocument} from './check-gate.mjs';
const base=process.env.BASE_SHA;
if(!/^[a-f0-9]{40}$/.test(base??'')) throw new Error('BASE_SHA must be a full commit SHA');
const changed=execFileSync('git',['diff','--name-only','-z',`${base}...HEAD`],{encoding:'utf8'}).split('\0').filter(Boolean);
const ids=new Set(changed.map(f=>f.match(/^epics\/(EPIC-\d+)\//)?.[1]).filter(Boolean));
const branch=process.env.HEAD_REF || execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
const branchId=branch.match(/^epic\/(EPIC-\d+)$/)?.[1]; if(branchId) ids.add(branchId);
const templateFile=/^(?:docs\/|project\/|scripts\/|tests\/|skills\/|\.github\/|\.clinerules\/|epics\/EPIC-XXX\/|project\/project-plan\.md\.template$|(?:README\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|skills-lock\.json|\.gitignore)$)/;
if(ids.size===0 && changed.some(f=>!templateFile.test(f))) throw new Error('Application changes require an epic branch or changed epic plan');
for(const id of ids) {
 const file=`epics/${id}/epic-plan.md`;
 if(!fs.existsSync(file)) throw new Error(`Missing epic plan: ${file}`);
 const {data}=readDocument(file);
 // A post-merge metadata-only update may mark the already-merged epic closed.
 const metadataOnly=changed.every(f=>/^(epics|project)\//.test(f));
 if(data.status==='merged' && metadataOnly && /^https:\/\//.test(data.pr_url??'')) continue;
 console.log(check(file,'pr'));
}
