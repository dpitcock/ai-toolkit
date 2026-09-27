import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';
import {localReviewRoute} from '../scripts/lib/local-review-route.mjs';
import {parseReviewPathPolicy,reviewRouteForPull} from '../scripts/lib/review-paths.mjs';

const source=path.resolve('.');
function fixture(t,repository='dpitcock/ai-toolkit') {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-route-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('config','user.email','test@example.test');git('config','user.name','Test');
  git('remote','add','origin',`https://github.com/${repository}.git`);
  for(const [name,text] of [['policy/review-paths.json',fs.readFileSync(path.join(source,'policy/review-paths.json'),'utf8')],
    ['scripts/check-gate.mjs','export const gate = true;\n'],['tests/old.mjs','old\n']]) {
    fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),text);
  }
  git('add','.');git('commit','-qm','baseline');
  const base=git('rev-parse','HEAD');
  const commit=()=>{git('add','-A');git('commit','-qm','change');return git('rev-parse','HEAD');};
  return {root,git,base,commit};
}

test('local planned and committed authoring paths agree and CLI emits the same route',t=>{
  const {root,base,commit}=fixture(t);
  fs.writeFileSync(path.join(root,'tests/old.mjs'),'new\n');const head=commit();
  const result=localReviewRoute({root,baseRef:base,headRef:head});
  assert.equal(result.route,'authoring');
  assert.deepEqual(result.requiredRoles,['code_reviewer']);
  assert.equal(localReviewRoute({root,baseRef:base,files:['tests/old.mjs']}).route,result.route);
  const cli=spawnSync(process.execPath,[path.join(source,'scripts/review-route.mjs'),'--root',root,'--base',base,'--head',head],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.equal(JSON.parse(cli.stdout).route,'authoring');
});

test('renaming shipped code into tests remains production',t=>{
  const {root,git,base,commit}=fixture(t);
  git('mv','scripts/check-gate.mjs','tests/renamed.mjs');const head=commit();
  const result=localReviewRoute({root,baseRef:base,headRef:head});
  assert.equal(result.route,'production');
  assert.ok(result.productionPaths.includes('scripts/check-gate.mjs'));
  const host=reviewRouteForPull({policy:parseReviewPathPolicy(git('show',`${base}:policy/review-paths.json`)),
    repository:'dpitcock/ai-toolkit',pr:99,changedFiles:1,configuredRoles:[],
    files:[{filename:'tests/renamed.mjs',previous_filename:'scripts/check-gate.mjs',status:'renamed'}]});
  assert.deepEqual(host.requiredRoles,result.requiredRoles);
  assert.equal(host.route,result.route);
});

test('PR validator uses the authoring route before legacy epic gates, without trusting candidate policy',t=>{
  const {root,base,commit}=fixture(t);
  fs.cpSync(path.join(source,'scripts'),path.join(root,'scripts'),{recursive:true});
  fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  fs.writeFileSync(path.join(root,'tests/old.mjs'),'new\n');const head=commit();
  // Establish a new base containing the real shipped scripts; then change only a test.
  fs.writeFileSync(path.join(root,'tests/old.mjs'),'next\n');const next=commit();
  const env={...process.env,BASE_SHA:head,HEAD_SHA:next,HEAD_REF:'epic/EPIC-999'};
  delete env.GITHUB_EVENT_PATH;
  const result=spawnSync(process.execPath,['scripts/check-pr.mjs'],{cwd:root,encoding:'utf8',env});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/authoring.*code_reviewer/i);
  const production=spawnSync(process.execPath,['scripts/check-pr.mjs'],{cwd:root,encoding:'utf8',env:{...env,BASE_SHA:base}});
  assert.notEqual(production.status,0);
  assert.match(production.stderr,/epic|plan|release/i);
});

test('candidate changes cannot remove or weaken trusted routing policy',t=>{
  const {root,base,commit}=fixture(t);
  fs.writeFileSync(path.join(root,'policy/review-paths.json'),'{}');let head=commit();
  assert.equal(localReviewRoute({root,baseRef:base,headRef:head}).route,'production');
  fs.rmSync(path.join(root,'policy/review-paths.json'));head=commit();
  assert.equal(localReviewRoute({root,baseRef:base,headRef:head}).route,'production');
});

test('legacy adopters, grandfathered PRs, and pre-adoption base revisions retain legacy gates',t=>{
  const {root,base,git,commit}=fixture(t);
  assert.equal(localReviewRoute({root,baseRef:base,files:['tests/old.mjs'],prNumber:13}).route,'legacy');
  git('remote','set-url','origin','git@github.com:owner/adopter.git');
  assert.equal(localReviewRoute({root,baseRef:base,files:['tests/old.mjs']}).route,'legacy');
  git('remote','set-url','origin','git@github.com:dpitcock/ai-toolkit.git');
  fs.rmSync(path.join(root,'policy/review-paths.json'));const head=commit();
  assert.equal(localReviewRoute({root,baseRef:head,files:['tests/old.mjs']}).route,'legacy');
});

test('malformed or symlinked trusted policy blocks; invalid base never implies authoring',t=>{
  const {root,base,commit}=fixture(t);
  assert.throws(()=>localReviewRoute({root,baseRef:'missing-ref',files:['tests/old.mjs']}));
  fs.writeFileSync(path.join(root,'policy/review-paths.json'),'{}');const malformed=commit();
  assert.throws(()=>localReviewRoute({root,baseRef:malformed,files:['tests/old.mjs']}));
  fs.rmSync(path.join(root,'policy/review-paths.json'));fs.symlinkSync('../tests/old.mjs',path.join(root,'policy/review-paths.json'));
  const linked=commit();
  assert.throws(()=>localReviewRoute({root,baseRef:linked,files:['tests/old.mjs']}),/regular file/);
  assert.throws(()=>localReviewRoute({root,baseRef:base,files:[]}));
});
