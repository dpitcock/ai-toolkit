#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';

const roles = ['principal_engineer', 'appsec', 'qa_lead', 'code_review', 'appsec_review', 'accessibility', 'accessibility_review'];
const graphs = {
  project: {draft:['awaiting-review'], 'awaiting-review':['approved'], approved:['in-progress']},
  epic: {draft:['awaiting-review'], 'awaiting-review':['approved'], approved:['in-progress'], 'in-progress':['merged']},
  'epic-plan': {draft:['awaiting-principal-signoff'], 'awaiting-principal-signoff':['awaiting-appsec-signoff','awaiting-accessibility-signoff','approved'], 'awaiting-appsec-signoff':['awaiting-accessibility-signoff','approved'], 'awaiting-accessibility-signoff':['approved'], approved:['in-progress'], 'in-progress':['in-review'], 'in-review':['in-appsec-review','in-progress'], 'in-appsec-review':['in-accessibility-review','ready-for-pr','in-progress'], 'in-accessibility-review':['ready-for-pr','in-progress'], 'ready-for-pr':['merged','in-progress']},
  task: {draft:['approved'], approved:['in-progress'], 'in-progress':['in-review'], 'in-review':['done','in-progress']},
};
function requireThat(ok, message) { if (!ok) throw new Error(message); }
function meaningful(s) { return typeof s === 'string' && s.trim().length > 0 && !/TODO|TBD|<[^>]+>|\{\{/i.test(s); }
export function readDocument(file) {
  const raw = fs.readFileSync(file,'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  requireThat(match, `${file}: missing YAML frontmatter`);
  const parsed = YAML.parseDocument(match[1], {uniqueKeys:true});
  requireThat(!parsed.errors.length, `${file}: ${parsed.errors.map(e=>e.message).join('; ')}`);
  const data = parsed.toJS({maxAliasCount:0});
  requireThat(data && graphs[data.kind] && (Object.hasOwn(graphs[data.kind],data.status) || (data.kind==='task' ? data.status==='done' : data.status==='merged' && data.kind!=='project')), 'Unknown kind/status');
  requireThat(meaningful(data.id) && meaningful(data.owner), 'id and owner must be filled');
  requireThat(Number.isInteger(data.revision) && data.revision > 0, 'revision must be a positive integer');
  requireThat(data.approvals && roles.every(r=>Object.hasOwn(data.approvals,r)), 'All approval fields required');
  return {data,raw,match,file};
}
function approval(d, role) {
  const a=d.approvals[role];
  requireThat(a && typeof a==='object' && meaningful(a.by) && meaningful(a.notes) && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && !Number.isNaN(Date.parse(a.date)) && new Date(a.date).toISOString().slice(0,10)===a.date && a.revision===d.revision, `Missing, malformed or stale ${role} approval on ${d.id}`);
  requireThat(a.by!==d.owner, `${role} must be independent of owner`);
  return a;
}
function related(ctx, relative, kind) {
  requireThat(typeof relative==='string' && !path.isAbsolute(relative), 'Expected relative parent path');
  const p=path.resolve(path.dirname(ctx.file),relative);
  const root=fs.realpathSync(ctx.root);
  requireThat(fs.realpathSync(p).startsWith(root+path.sep), 'Parent must remain inside repository');
  const doc=readDocument(p); requireThat(doc.data.kind===kind,`Expected ${kind} parent`);
  return {...doc,root:ctx.root};
}
function risks(d) {
  requireThat(d.security && ['auth','data','external'].every(k=>typeof d.security[k]==='boolean'), 'Explicit security boundary booleans required');
  requireThat(Array.isArray(d.security.concerns) && d.security.concerns.every(meaningful), 'security.concerns must be an array of concern IDs');
  requireThat(meaningful(d.security.rationale), 'Security triage rationale required');
  return d.security.auth || d.security.data || d.security.external || d.security.concerns.length>0;
}
export function checkProject(file) {
  const {data}=readDocument(file);
  requireThat(data.kind==='project' && ['approved','in-progress'].includes(data.status),'Project must be approved');
  approval(data,'principal_engineer');
}
function projectApproved(ctx) {
  const p=related(ctx,ctx.data.parent,'project');
  requireThat(['approved','in-progress'].includes(p.data.status),'Project must be approved');
  approval(p.data,'principal_engineer');
  requireThat(ctx.data.parent_revision===p.data.revision,'Project changed: reconcile epic against current revision');
}
function epicApproved(ctx) {
  const e=related(ctx,ctx.data.parent,'epic');
  requireThat(['approved','in-progress'].includes(e.data.status),'Epic must be approved');
  projectApproved(e); approval(e.data,'qa_lead');
  if(risks(e.data)) approval(e.data,'appsec');
  else requireThat(e.data.approvals.appsec==='not-required','Epic AppSec triage must be recorded');
  requireThat(Array.isArray(e.data.qa_requirements) && e.data.qa_requirements.length>0 && e.data.qa_requirements.every(meaningful),'QA requirements required');
  requireThat(ctx.data.parent_revision===e.data.revision,'Epic changed: re-plan against current revision');
  return e;
}
function needsAppsec(ctx,e) {
  const own=risks(ctx.data);
  requireThat(Array.isArray(ctx.data.touches_concerns),'touches_concerns must be explicit');
  requireThat(ctx.data.touches_concerns.every(c=>e.data.security.concerns.includes(c)),'Unknown AppSec concern ID');
  return own || ctx.data.touches_concerns.length>0;
}
function needsAccessibility(ctx) {
  requireThat(ctx.data.accessibility && typeof ctx.data.accessibility.ui==='boolean' && meaningful(ctx.data.accessibility.rationale), 'Explicit UI accessibility assessment required');
  return ctx.data.accessibility.ui;
}
function planApproved(ctx) {
  const e=epicApproved(ctx); approval(ctx.data,'principal_engineer');
  if(needsAppsec(ctx,e)) approval(ctx.data,'appsec');
  else requireThat(ctx.data.approvals.appsec==='not-required','Plan needs explicit AppSec not-required decision');
  if(needsAccessibility(ctx)) approval(ctx.data,'accessibility');
}
function tasks(ctx, complete=false) {
  const d=ctx.data;
  requireThat(Array.isArray(d.tasks) && d.tasks.length>0 && new Set(d.tasks).size===d.tasks.length,'Plan needs unique task paths');
  for(const name of d.tasks) {
    const t=related(ctx,name,'task');
    requireThat(path.resolve(path.dirname(t.file),t.data.parent)===path.resolve(ctx.file),'Task must belong to this plan');
    requireThat(t.data.parent_revision===d.revision,'Task plan revision is stale');
    if(complete) {requireThat(t.data.status==='done','All tasks must be done'); taskEvidence(t.data);}
  }
}
function taskEvidence(d) {
  requireThat(d.evidence && ['red','green','qa'].every(k=>meaningful(d.evidence[k])) && /^[a-f0-9]{7,40}$/.test(d.evidence.commit),'Task needs RED, GREEN, QA evidence and individual commit SHA');
}
function reviewComments(d, reviewer) {
  requireThat(Array.isArray(d.review_comments),'review_comments must be an array');
  requireThat(new Set(d.review_comments.map(c=>c?.id)).size===d.review_comments.length,'Review comment IDs must be unique');
  for(const comment of d.review_comments) {
    requireThat(comment && typeof comment==='object' && meaningful(comment.id),'Each review comment needs an ID');
    requireThat(comment.status==='resolved','All review comments must be resolved');
    requireThat(/^[a-f0-9]{40}$/.test(comment.resolution_commit),'Resolved review comments need a full resolution commit SHA');
    requireThat(comment.verified_by===reviewer.by,'Resolved review comments must be verified by the final code reviewer');
    requireThat(/^\d{4}-\d{2}-\d{2}$/.test(comment.verified_date) && !Number.isNaN(Date.parse(comment.verified_date)) && new Date(comment.verified_date).toISOString().slice(0,10)===comment.verified_date,'Resolved review comments need a valid reviewer verification date');
    requireThat(comment.verified_date<=reviewer.date,'Review comment verification cannot follow final code approval');
    requireThat(comment.verified_commit===d.review_commit,'Resolved review comments must be verified on the final review commit');
  }
}
function writeDocument(ctx, parsed) {
  const lock=fs.openSync(`${ctx.file}.lock`,'wx');
  try {
    requireThat(fs.readFileSync(ctx.file,'utf8')===ctx.raw,'Document changed during validation; retry');
    fs.writeFileSync(ctx.file,`---\n${parsed.toString()}---\n${ctx.raw.slice(ctx.match[0].length)}`);
  } finally {fs.closeSync(lock); fs.unlinkSync(`${ctx.file}.lock`);}
}
export function check(file,target,{root=process.cwd(),write=false}={}) {
  const ctx={...readDocument(file),root}; const d=ctx.data;
  if(target==='draft') {
    requireThat(!['merged','done'].includes(d.status),'Completed documents cannot be reset');
    if(write) {
      const parsed=YAML.parseDocument(ctx.match[1]); parsed.set('status','draft'); parsed.set('revision',d.revision+1);
      for(const role of roles) parsed.setIn(['approvals',role],null);
      if(d.kind==='epic-plan') parsed.set('review_commit',null);
      writeDocument(ctx,parsed);
    }
    return `${d.id}: reset to draft; obtain fresh approvals for new revision`;
  }
  if(target==='pr') {
    requireThat(d.kind==='epic-plan' && d.status==='ready-for-pr','PR requires ready-for-pr epic plan');
  } else requireThat(graphs[d.kind][d.status]?.includes(target),`Illegal transition ${d.kind}: ${d.status} -> ${target}`);
  if(d.kind==='project' && ['approved','in-progress'].includes(target)) approval(d,'principal_engineer');
  if(d.kind==='epic') {
    projectApproved(ctx);
    if(['approved','in-progress','merged'].includes(target)) {
      approval(d,'qa_lead');
      requireThat(Array.isArray(d.qa_requirements) && d.qa_requirements.length>0 && d.qa_requirements.every(meaningful),'QA requirements required');
      if(risks(d)) approval(d,'appsec'); else requireThat(d.approvals.appsec==='not-required','Record epic triage');
      if(needsAccessibility(ctx)) approval(d,'accessibility');
    }
    if(target==='merged') requireThat(related(ctx,'epic-plan.md','epic-plan').data.status==='merged','Merge epic plan first');
  }
  if(d.kind==='epic-plan') {
    const e=epicApproved(ctx); const needed=needsAppsec(ctx,e);
    tasks(ctx);
    const ui=needsAccessibility(ctx);
    if(target==='awaiting-appsec-signoff') {approval(d,'principal_engineer'); requireThat(needed,'AppSec plan signoff is not required');}
    if(target==='awaiting-accessibility-signoff') {
      approval(d,'principal_engineer'); requireThat(ui,'Accessibility review is not required');
      if(needed) {requireThat(d.status==='awaiting-appsec-signoff','AppSec signoff must precede accessibility review'); approval(d,'appsec');}
    }
    if(!['awaiting-principal-signoff','awaiting-appsec-signoff','awaiting-accessibility-signoff'].includes(target)) planApproved(ctx);
    if(target==='approved' && needed && !ui) requireThat(d.status==='awaiting-appsec-signoff','Principal then AppSec signoff required');
    if(target==='approved' && ui) requireThat(d.status==='awaiting-accessibility-signoff','Accessibility signoff required before approval');
    if(['in-review','in-appsec-review','in-accessibility-review','ready-for-pr','pr','merged'].includes(target)) tasks(ctx,true);
    if(['in-appsec-review','in-accessibility-review','ready-for-pr','pr','merged'].includes(target)) {const cr=approval(d,'code_review'); reviewComments(d,cr);}
    if(['in-accessibility-review','ready-for-pr','pr','merged'].includes(target)) approval(d,'appsec_review');
    if(['ready-for-pr','pr','merged'].includes(target)) {
      const cr=approval(d,'code_review'), ar=approval(d,'appsec_review');
      requireThat(ar.date>=cr.date,'Final AppSec review must follow code review');
      requireThat(/^[a-f0-9]{40}$/.test(d.review_commit),'review_commit must be a full commit SHA');
      requireThat(cr.commit===d.review_commit && ar.commit===d.review_commit,'Reviews must cover the same implementation commit');
      if(ui) {
        const aa=approval(d,'accessibility_review');
        requireThat(aa.date>=ar.date,'Accessibility review must follow final AppSec review');
        requireThat(aa.commit===d.review_commit,'Accessibility review must cover the reviewed implementation commit');
      }
    }
    if(target==='pr') {
      const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
      git(['merge-base','--is-ancestor',d.review_commit,'HEAD']);
      requireThat(!git(['diff','--name-only',d.review_commit,'--','.',':(exclude)epics/**',':(exclude)project/**']),'Implementation changed after reviews; repeat both reviews');
      requireThat(!git(['ls-files','--others','--exclude-standard']),'Commit untracked files before PR');
    }
    if(target==='merged') requireThat(meaningful(d.pr_url) && /^https:\/\//.test(d.pr_url),'Record merged PR URL');
  }
  if(d.kind==='task') {
    const p=related(ctx,d.parent,'epic-plan'); planApproved(p);
    requireThat(p.data.tasks.includes(path.relative(path.dirname(p.file),ctx.file)),'Task is not listed in plan');
    requireThat(d.parent_revision===p.data.revision,'Task plan revision is stale');
    requireThat(['approved','in-progress'].includes(p.data.status),'Plan must be approved or in-progress');
    if(target!=='approved') requireThat(p.data.status==='in-progress','Start the epic plan before its tasks');
    requireThat(Array.isArray(d.depends_on),'Task dependencies must be explicit');
    for(const dependency of d.depends_on) {
      requireThat(p.data.tasks.includes(dependency) && dependency!==path.relative(path.dirname(p.file),ctx.file),'Unknown or self task dependency');
      requireThat(related(p,dependency,'task').data.status==='done','Task dependency is not done');
    }
    if(['in-review','done'].includes(target)) taskEvidence(d);
  }
  if(write && target!=='pr') {
    const parsed=YAML.parseDocument(ctx.match[1]); parsed.set('status',target);
    if(target==='in-progress' && ['in-review','in-appsec-review','in-accessibility-review','ready-for-pr'].includes(d.status)) {
      parsed.setIn(['approvals','code_review'],null); parsed.setIn(['approvals','appsec_review'],null); parsed.setIn(['approvals','accessibility_review'],null); parsed.set('review_commit',null);
    }
    writeDocument(ctx,parsed);
  }
  return `${d.id}: ${d.status} -> ${target} permitted`;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [file,target,...flags]=process.argv.slice(2);
    requireThat(file && target && flags.every(f=>f==='--write'),'Usage: node scripts/check-gate.mjs DOCUMENT TARGET [--write]');
    console.log(check(path.resolve(file),target,{write:flags.includes('--write')}));
  } catch(e) {console.error(`GATE BLOCKED: ${e.message}`); process.exitCode=1;}
}
