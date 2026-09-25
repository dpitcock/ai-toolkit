import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {parseWorkspaceConfig,workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
import {readWorkspaceHistory,assertAcceptedWorkspaceConfig} from '../scripts/lib/workspace-history.mjs';

const source=path.resolve(import.meta.dirname,'..');
const cli=path.join(source,'scripts/init-workspace.mjs');

function fixture(t,name='headless-tool',dependencies={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-init-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'config'));
  fs.mkdirSync(path.join(root,'project'));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name,dependencies}));
  return root;
}

function run(root,...args) {
  return execFileSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}

test('headless proposal explains roles and stays pending on repeat',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  const file=path.join(root,'config/workspace-config.yaml');
  const first=fs.readFileSync(file,'utf8');
  const config=parseWorkspaceConfig(first);
  assert.equal(proposal.status,'pending');
  assert.equal(proposal.digest,workspaceConfigDigest(config));
  assert.deepEqual(Object.keys(proposal.reasons).sort(),[
    'accessibility_reviewer','appsec','principal','qa','ui_designer',
  ]);
  assert.equal(config.workspace.repository,'headless-tool');
  assert.equal(config.workspace.provider,'codex');
  assert.equal(config.workspace.slack_channel_name,'ws-headless-tool-codex');
  assert.deepEqual(config.approvals_overrides.exempt,['accessibility_reviewer','ui_designer']);
  assert.throws(()=>assertAcceptedWorkspaceConfig(root,config));
  assert.throws(()=>run(root,'status'));
  assert.equal(JSON.parse(run(root,'propose')).status,'pending');
  assert.equal(fs.readFileSync(file,'utf8'),first);
  assert.equal(readWorkspaceHistory(root).length,1);
});

test('frontend proposal requires UI reviews without an exemption',t=>{
  const root=fixture(t,'web-app',{react:'19.0.0'});
  run(root,'propose');
  const config=parseWorkspaceConfig(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  assert.equal(config.approvals_required.accessibility_reviewer,true);
  assert.equal(config.approvals_required.ui_designer,true);
  assert.deepEqual(config.approvals_overrides.exempt,[]);
});

test('edited proposal needs current digest and preserves acceptance evidence',t=>{
  const root=fixture(t);
  run(root,'propose');
  const file=path.join(root,'config/workspace-config.yaml');
  const edited=YAML.parse(fs.readFileSync(file,'utf8'));
  edited.approvals_required.qa=false;
  fs.writeFileSync(file,YAML.stringify(edited));
  const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
  const digest=workspaceConfigDigest(config);
  assert.throws(()=>run(root,'accept','--by','Dennis','--reason','Reviewed project policy','--digest','0'.repeat(64)));
  assert.equal(readWorkspaceHistory(root).length,1);
  const accepted=JSON.parse(run(root,'accept','--by','Dennis','--reason','Reviewed project policy','--digest',digest));
  assert.equal(accepted.status,'accepted');
  assert.equal(accepted.revision,1);
  assert.equal(JSON.parse(run(root,'status')).status,'accepted');
  assert.doesNotThrow(()=>assertAcceptedWorkspaceConfig(root,config));
  const last=readWorkspaceHistory(root).at(-1);
  assert.equal(last.by,'Dennis');
  assert.equal(last.digest,digest);
  assert.ok(last.changes.includes('approvals_required.qa'));
  const acceptedBytes=fs.readFileSync(file,'utf8');
  assert.equal(JSON.parse(run(root,'propose')).status,'accepted');
  assert.equal(fs.readFileSync(file,'utf8'),acceptedBytes);
  edited.approvals_required.appsec=!edited.approvals_required.appsec;
  fs.writeFileSync(file,YAML.stringify(edited));
  assert.throws(()=>run(root,'status'));
});

test('offline bootstrap proposes policy without accepting it',t=>{
  const root=fixture(t,'bootstrap-tool');
  fs.mkdirSync(path.join(root,'scripts'));
  fs.cpSync(path.join(source,'scripts'),path.join(root,'scripts'),{recursive:true});
  fs.cpSync(path.join(source,'project/project-plan.md.template'),path.join(root,'project/project-plan.md.template'));
  fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  execFileSync('bash',['scripts/init-project.sh','--offline'],{cwd:root,stdio:'pipe'});
  const file=path.join(root,'config/workspace-config.yaml');
  assert.ok(fs.existsSync(file));
  assert.throws(()=>assertAcceptedWorkspaceConfig(root,parseWorkspaceConfig(fs.readFileSync(file,'utf8'))));
});

test('normal bootstrap proposes policy after dependency setup',t=>{
  const root=fixture(t,'normal-bootstrap');
  fs.mkdirSync(path.join(root,'scripts'));
  fs.cpSync(path.join(source,'scripts'),path.join(root,'scripts'),{recursive:true});
  fs.cpSync(path.join(source,'project/project-plan.md.template'),path.join(root,'project/project-plan.md.template'));
  fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  fs.writeFileSync(path.join(root,'scripts/install-skills.sh'),'#!/bin/sh\nexit 0\n');
  const bin=path.join(root,'test-bin');fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,'npm'),'#!/bin/sh\nexit 0\n');fs.chmodSync(path.join(bin,'npm'),0o755);
  execFileSync('bash',['scripts/init-project.sh'],{
    cwd:root,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH},stdio:'pipe',
  });
  assert.ok(fs.existsSync(path.join(root,'config/workspace-config.yaml')));
  assert.equal(readWorkspaceHistory(root).at(-1).kind,'proposal');
});

test('proposal rejects a history symlink outside the repository',t=>{
  const root=fixture(t);
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-history-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const target=path.join(outside,'unowned.jsonl');
  fs.symlinkSync(target,path.join(root,'project/workspace-config-history.jsonl'));
  assert.throws(()=>run(root,'propose'));
  assert.equal(fs.existsSync(target),false);
});
