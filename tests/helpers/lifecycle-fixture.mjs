import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {workspaceConfigDigest,workspaceTierDefinition} from '../../scripts/lib/workspace-config.mjs';

const repositoryRoot=path.resolve('.');
export function git(root,args) {return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();}
// Test-only Git/transport fixture. Actors, verdicts and activation below are
// controlled data; they never represent a live host or harness approval.
export function fixture(t,{adopterRoot}={}) {
 const root=adopterRoot??fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'epic-finalization-')));
 if(!adopterRoot) {
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.cpSync(path.join(repositoryRoot,'scripts'),path.join(root,'scripts'),{recursive:true});
 fs.cpSync(path.join(repositoryRoot,'policy'),path.join(root,'policy'),{recursive:true});
 fs.symlinkSync(path.join(repositoryRoot,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\n.host/\n');
 fs.mkdirSync(path.join(root,'config'));fs.writeFileSync(path.join(root,'config/policy'),'accepted policy\n');
 const config={workspace:{repository:'repo',environment:'test',provider:'codex',slack_channel_name:'ws-repo-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'},task_tier:'tier_1',tier_overrides:{direct_merge:false},workflow:{autopilot:true}};
 const digest=workspaceConfigDigest(config),definition=workspaceTierDefinition(config);
 fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(config));fs.mkdirSync(path.join(root,'project'));
 fs.writeFileSync(path.join(root,'project/workspace-config-history.jsonl'),[JSON.stringify({kind:'proposal',digest,revision:1,date:'2026-09-26',config,reasons:{fixture:'test'},definition}),JSON.stringify({kind:'acceptance',digest,revision:1,date:'2026-09-26',by:'owner',reason:'test',changes:[],definition})].join('\n')+'\n');
 git(root,['init','--initial-branch=main']);git(root,['config','user.name','Tests']);git(root,['config','user.email','tests@example.test']);
 }
 const observedPolicy=execFileSync(process.execPath,['--input-type=module','-e',`
  import fs from 'node:fs';
  import {parseWorkspaceConfig,workspaceConfigDigest,workspaceTierDefinition} from './scripts/lib/workspace-config.mjs';
  import {resolveTierDefaults} from './scripts/lib/tier-defaults.mjs';
  const config=parseWorkspaceConfig(fs.readFileSync('config/workspace-config.yaml','utf8'));
  console.log(JSON.stringify({digest:workspaceConfigDigest(config),definition:workspaceTierDefinition(config)??resolveTierDefaults({tier:1,overrides:{direct_merge:config.task_tiers?.tier_1_direct_merge},templateRepository:true}).definition}));
 `],{cwd:root,encoding:'utf8'});
 const {digest,definition}=JSON.parse(observedPolicy);
 const acceptance=JSON.parse(fs.readFileSync(path.join(root,'project/workspace-config-history.jsonl'),'utf8').trim().split('\n').at(-1));
 fs.writeFileSync(path.join(root,'source.mjs'),'export const stable = true;\n');
 fs.appendFileSync(path.join(root,'.git/info/exclude'),'\n.host/\n');
 git(root,['remote','add','origin','https://github.com/example/repo.git']);git(root,['add','.']);git(root,['commit','-m','Implementation']);
 const reviewed=git(root,['rev-parse','HEAD']);
 const approval={by:'independent',date:'2026-09-26',notes:'Reviewed fixture',revision:1,commit:reviewed};
 const base={owner:'developer',revision:1,approvals:{principal_engineer:approval,appsec:'not-required',qa_lead:approval,code_review:approval,appsec_review:approval,accessibility:null,accessibility_review:null}};
 const security={auth:false,data:false,external:false,concerns:[],rationale:'Fixture scope'},accessibility={ui:false,rationale:'No UI'};
 const docs={
  'project/project-plan.md':{...structuredClone(base),kind:'project',id:'PROJECT',status:'approved'},
  'epics/EPIC-999/epic.md':{...structuredClone(base),kind:'epic',id:'EPIC-999',status:'in-progress',parent:'../../project/project-plan.md',parent_revision:1,security,accessibility,qa_requirements:['unit tests']},
  'epics/EPIC-999/epic-plan.md':{...structuredClone(base),kind:'epic-plan',id:'EPIC-999-PLAN',status:'ready-for-pr',parent:'epic.md',parent_revision:1,security,accessibility,touches_concerns:[],tasks:['tasks/TASK-001.md'],review_comments:[],review_commit:reviewed,pr_url:'https://github.com/example/repo/pull/7'},
  'epics/EPIC-999/tasks/TASK-001.md':{...structuredClone(base),kind:'task',id:'TASK-001',status:'done',parent:'../epic-plan.md',parent_revision:1,depends_on:[],evidence:{red:'Observed failure',green:'Passing tests',qa:'Passing QA',commit:reviewed}},
 };
 const save=()=>{for(const [name,data] of Object.entries(docs)) {fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),`---\n${YAML.stringify(data,{aliasDuplicateObjects:false})}---\nUnchanged body\n`);}};
 save();git(root,['add','.']);git(root,['commit','-m','Final review evidence']);const submitted=git(root,['rev-parse','HEAD']);
 git(root,['commit','--allow-empty','-m','Squash integration fixture']);const merged=git(root,['rev-parse','HEAD']);
 const hostDirectory=path.join(root,'.host');fs.mkdirSync(hostDirectory);const hostFile=path.join(hostDirectory,'state.json');
 fs.writeFileSync(path.join(hostDirectory,'package.json'),JSON.stringify({type:'commonjs'}));
 const host={root,submitted,merged,main:merged,mergedState:true,reviews:true,checks:true};
 const saveHost=()=>fs.writeFileSync(hostFile,JSON.stringify(host));saveHost();
 const gh=path.join(hostDirectory,'gh');fs.writeFileSync(gh,`#!${process.execPath}\n`+mockGh);fs.chmodSync(gh,0o755);
 const env={...process.env,PATH:`${hostDirectory}:${process.env.PATH}`,FIXTURE_HOST:hostFile};
 const run=(script,args=[],extra={})=>spawnSync(process.execPath,[path.join(root,'scripts',script),...args],{cwd:root,encoding:'utf8',env:{...env,...extra}});
 const script=code=>spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',env});
 const finalize=()=>{docs['epics/EPIC-999/epic-plan.md'].status='merged';docs['epics/EPIC-999/epic.md'].status='merged';save();git(root,['add','.']);git(root,['commit','-m','Record merged epic']);return git(root,['rev-parse','HEAD']);};
 return {root,docs,save,host,saveHost,run,script,finalize,submitted,merged,digest,definition,acceptance};
}

const mockGh=String.raw`
const fs=require('node:fs'),cp=require('node:child_process');
const h=JSON.parse(fs.readFileSync(process.env.FIXTURE_HOST,'utf8'));
const endpoint=process.argv.at(-1),git=args=>cp.execFileSync('git',['-C',h.root,...args],{encoding:'utf8'}).trim();
let value;
const pull={number:7,state:h.mergedState?'closed':'open',merged:h.mergedState,merge_commit_sha:h.merged,head:{sha:h.submitted,ref:'epic/EPIC-999',repo:{full_name:'example/repo'}},base:{ref:'main',repo:{full_name:h.repository??'example/repo'}}};
if(endpoint.endsWith('/pulls/7')) value=pull;
else if(endpoint.endsWith('/pulls/8')) value={...pull,number:8,state:h.publication.state,merged:h.publication.state==='closed',merge_commit_sha:h.publication.state==='closed'?h.main:null,head:{...pull.head,sha:h.publication.head,ref:h.publication.branch??pull.head.ref,repo:{full_name:h.publication.repository??'example/repo'}}};
else if(endpoint.includes('/actions/variables/')) value={value:JSON.stringify(Object.fromEntries(['code_reviewer','appsec'].map(role=>[role,{actor:role,kind:'human',roleEvidence:true,provenance:{source:'owner-managed',id:role}}])))};
else if(endpoint.includes('/reviews?')) value=[h.reviews?['code_reviewer','appsec'].map((role,i)=>({id:i+1,user:{login:role,type:'User'},state:h.reviewState??'APPROVED',commit_id:h.reviewHead??(endpoint.includes('/pulls/8/')?h.publication.head:h.submitted),submitted_at:'2026-09-26T12:00:00Z'})):[]];
else if(endpoint.includes('/check-runs?')) {const sha=endpoint.split('/commits/')[1].split('/')[0];const suite=sha===h.submitted?1:sha===h.merged?2:3;value=[{check_runs:[{id:suite,name:'gates',head_sha:sha,status:h.checkStatus??'completed',conclusion:h.checks?'success':'failure',app:{id:15368,slug:'github-actions'},check_suite:{id:suite}}]}];}
else if(endpoint.includes('/actions/runs?')) {const suite=Number(new URL('https://example/'+endpoint).searchParams.get('check_suite_id'));value=[{workflow_runs:[{check_suite_id:suite,path:'.github/workflows/workflow.yml',repository:{full_name:'example/repo'},event:'push',status:'completed',conclusion:'success',head_sha:suite===1?h.submitted:suite===2?h.merged:h.publication?.head??h.main}]}];}
else if(endpoint.endsWith('/git/ref/heads/main')) {h.mainReads=(h.mainReads??0)+1;fs.writeFileSync(process.env.FIXTURE_HOST,JSON.stringify(h));value={object:{sha:h.race&&h.mainReads>1?h.submitted:h.main}};}
else if(endpoint.includes('/git/trees/')) {const sha=endpoint.split('/git/trees/')[1].split('?')[0];const entries=git(['ls-tree','-r',sha]).split('\n').filter(Boolean).map(line=>{const [info,...names]=line.split('\t');const [mode,type,sha]=info.split(' ');return {mode,type,sha,path:names.join('\t')};});value={truncated:false,tree:entries};}
else if(endpoint.includes('/contents/')) {const [file,ref]=endpoint.split('/contents/')[1].split('?ref=');value={encoding:'base64',content:Buffer.from(git(['show',ref+':'+decodeURIComponent(file)])+'\n').toString('base64')};}
else if(endpoint.includes('/compare/')) {const [base,head]=endpoint.split('/compare/')[1].split('...');let ancestor=true;try{git(['merge-base','--is-ancestor',base,head]);}catch{ancestor=false;}value={status:base===head?'identical':ancestor?'ahead':'diverged',base_commit:{sha:base},merge_base_commit:{sha:git(['merge-base',base,head])}};}
else if(endpoint.includes('/commits/')&&endpoint.includes('/pulls?')) value=[h.publication?.state==='closed'?[{number:8}]:[]];
else if(endpoint.includes('/pulls?')) value=[[]];
else throw new Error('Unexpected gh endpoint '+endpoint);
process.stdout.write(JSON.stringify(value));
`;


export function exerciseLifecycle(f) {
 git(f.root,['checkout','-b','epic/EPIC-999',f.submitted]);f.host.mergedState=false;f.saveHost();
 const provenance={digest:f.digest,definition:f.definition,rootAcceptance:`workspace:${f.acceptance.revision}:${f.digest}`,worktreeAcceptance:`workspace:${f.acceptance.revision}:${f.digest}`};
 const setup=f.script(`import {withWorkflowState} from './scripts/lib/workflow-state.mjs';withWorkflowState('.',state=>{state.authorizations.test={id:'test',repository:'example/repo',branch:'epic/EPIC-999',scope:['epics/EPIC-999'],allowedActions:['review.ready','merge.eligible','epic.complete'],completionCriteria:['fixture'],policy:${JSON.stringify(provenance)},authorizedBy:'fixture-owner'};state.epics['EPIC-999']={active:true};});`);
 assert.equal(setup.status,0,setup.stderr);
 const invoke=(type,pr=7,extra={})=>f.script(`
  import {handleWorkflowEvent} from './scripts/workflow-event.mjs';
  import {githubJSON,hostPages} from './scripts/lib/epic-finalization.mjs';
  import {observeEpicIntegration} from './scripts/lib/epic-integration.mjs';
  const repository='example/repo',pr=${pr},prefix='repos/'+repository;
  const observers={pullRequest:()=>{const p=githubJSON(prefix+'/pulls/'+pr);return {repository:p.head.repo.full_name,pr:p.number,head:p.head.sha,state:p.state,base:p.base.ref,headBranch:p.head.ref};},reviewAuthority:()=>({identities:JSON.parse(githubJSON(prefix+'/actions/variables/GOVERNANCE_REVIEW_IDENTITIES').value),api:{pull:()=>githubJSON(prefix+'/pulls/'+pr).head.sha,reviews:()=>hostPages(githubJSON(prefix+'/pulls/'+pr+'/reviews?per_page=100',{paginate:true})),checks:(_r,head)=>hostPages(githubJSON(prefix+'/commits/'+head+'/check-runs?per_page=100',{paginate:true}),'check_runs')}}),integration:observeEpicIntegration,completion:()=>(${JSON.stringify(extra.evidence??null)})};
  console.log(JSON.stringify(handleWorkflowEvent({root:process.cwd(),event:${JSON.stringify({id:`${type}-${pr}`,type,epic:'EPIC-999',authorizationId:'test',completionCriterion:'fixture',...(type==='epic.complete'?{completionId:'test-completion'}:{})})},actor:{harness:{authenticated:true,sessionId:'fixture',identity:'fixture-controller'}},observers})));
 `);
 for(const type of ['review.ready','merge.eligible']) {const result=invoke(type);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).decision,'continue',result.stdout);}
 f.host.mergedState=true;f.saveHost();git(f.root,['merge','--ff-only',f.merged]);
 for(const file of ['epic-plan.md','epic.md']) {const result=f.run('check-gate.mjs',[`epics/EPIC-999/${file}`,'merged','--write']);assert.equal(result.status,0,result.stderr);}
 git(f.root,['add','.']);git(f.root,['commit','-m','Actual CLI finalization markers']);const integrated=git(f.root,['rev-parse','HEAD']);
 const admission=f.run('check-pr.mjs',[],{BASE_SHA:f.merged,HEAD_SHA:integrated,HEAD_REF:'epic/EPIC-999'});assert.equal(admission.status,0,admission.stderr);
 f.host.publication={head:integrated,state:'open'};f.saveHost();
 const publication=invoke('review.ready',8);assert.equal(publication.status,0,publication.stderr);
 const verdict=JSON.parse(publication.stdout);assert.equal(verdict.review.originalPr,7);assert.equal(verdict.review.pr,8);assert.equal(verdict.review.claims.length,2);
 assert.equal(invoke('review.ready',7).status,1);
 for(const mutation of [{branch:'epic/OTHER'},{repository:'peer/repo'},{head:f.submitted}]) {f.host.publication={head:integrated,state:'open',...mutation};f.saveHost();assert.equal(invoke('review.ready',8).status,1);}
 f.host.publication={head:integrated,state:'open'};f.saveHost();
 const eligible=invoke('merge.eligible',8);assert.equal(eligible.status,0,eligible.stderr);assert.equal(JSON.parse(eligible.stdout).decision,'continue',eligible.stdout);
 f.host.publication.state='closed';f.saveHost();assert.equal(invoke('review.ready',8).status,1);
 f.host.main=integrated;f.saveHost();
 const check={id:'3',name:'gates',status:'completed',conclusion:'success',head:integrated},observedAt=new Date().toISOString();
 const evidence={repository:'example/repo',epic:'EPIC-999',pullRequest:7,submittedHead:f.submitted,integrationSha:integrated,host:{source:'authenticated-github-api',observedAt,merged:true,mergeCommit:f.merged,finalization:{from:f.merged,to:integrated,paths:['epics/EPIC-999/epic-plan.md','epics/EPIC-999/epic.md']},checks:[check],smoke:{revision:integrated,result:'passed'}},policy:{digest:f.digest,loadedRevision:1},findings:{unresolved:[]},documentation:{revision:integrated,current:true},activation:{source:'session-harness',observedAt,active:true,agentPath:'fixture',resourceIds:['fixture-session']},cleanup:{source:'session-harness',observedAt,revalidated:true,worktrees:[],branches:[],processes:[]},correctivePullRequests:[]};
 const completed=invoke('epic.complete',7,{evidence});assert.equal(completed.status,0,completed.stderr);assert.equal(JSON.parse(completed.stdout).decision,'continue',completed.stdout);
 const next=f.script(`import {reserveEpicProvisioning} from './scripts/lib/workflow-admission.mjs';import {observeEpicIntegration} from './scripts/lib/epic-integration.mjs';console.log(JSON.stringify(reserveEpicProvisioning({root:process.cwd(),epic:'EPIC-1000',observeIntegration:observeEpicIntegration})));`);
 assert.equal(next.status,0,next.stderr);assert.equal(JSON.parse(next.stdout).admitted,true);
 return {submitted:f.submitted,merged:f.merged,integrated};
}
