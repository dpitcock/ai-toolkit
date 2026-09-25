import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import YAML from 'yaml';
import {parseWorkspaceConfig,workspaceConfigDigest} from '../scripts/lib/workspace-config.mjs';
import {readWorkspaceHistory,assertAcceptedWorkspaceConfig} from '../scripts/lib/workspace-history.mjs';

const source=path.resolve(import.meta.dirname,'..');
const cli=path.join(source,'scripts/init-workspace.mjs');
const legacy=`workspace:
  repository: legacy-repo
  environment: staging
  provider: codex
  channel_name: ws-legacy-repo-codex
  timezone: UTC
daily_summary:
  local_time: "10:30"
`;

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

function runWithEnv(root,env,...args) {
  return execFileSync(process.execPath,[cli,...args,'--root',root],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...env},
  });
}

function runAsync(root,...args) {
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[cli,...args,'--root',root],{stdio:['ignore','pipe','pipe']});
    let output='',error='';
    child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{error+=chunk;});
    child.on('close',code=>resolve({code,output,error}));
  });
}

function spawnWithEnv(root,env,...args) {
  return spawn(process.execPath,[cli,...args,'--root',root],{stdio:['ignore','pipe','pipe'],env:{...process.env,...env}});
}

async function waitForFile(file) {
  for(let attempt=0;attempt<100;attempt+=1) {
    if(fs.existsSync(file)) return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function waitFor(check,message) {
  for(let attempt=0;attempt<100;attempt+=1) {
    if(check()) return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error(message);
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

test('concurrent proposal bootstrap creates exactly one initial proposal',async t=>{
  const root=fixture(t);
  const calls=await Promise.all(Array.from({length:8},()=>runAsync(root,'propose')));
  assert.equal(calls.filter(call=>call.code===0).length,8,calls.filter(call=>call.code!==0).map(call=>call.error).join('\n'));
  const history=readWorkspaceHistory(root);
  assert.equal(history.length,1);
  assert.equal(history[0].kind,'proposal');
  assert.equal(history[0].revision,1);
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

test('legacy Slack values survive proposal and descriptor retires after acceptance',t=>{
  const root=fixture(t,'different-package-name');
  const old=path.join(root,'config/slack-workspace.example.yml');
  const unrelated=path.join(root,'project/existing-notes.md');
  fs.writeFileSync(old,legacy);
  fs.writeFileSync(unrelated,'Keep this user text.\n');
  const proposal=JSON.parse(run(root,'propose'));
  const config=parseWorkspaceConfig(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  assert.equal(config.workspace.repository,'legacy-repo');
  assert.equal(config.workspace.environment,'staging');
  assert.equal(config.workspace.slack_channel_name,'ws-legacy-repo-codex');
  assert.equal(config.workspace.timezone,'UTC');
  assert.equal(config.daily_summary.local_time,'10:30');
  assert.equal(fs.readFileSync(old,'utf8'),legacy);
  assert.equal(fs.readFileSync(unrelated,'utf8'),'Keep this user text.\n');
  assert.equal(JSON.parse(run(root,'accept','--by','Dennis','--reason','Approved migration','--digest',proposal.digest)).status,'accepted');
  assert.equal(fs.existsSync(old),false);
  assert.equal(fs.readFileSync(unrelated,'utf8'),'Keep this user text.\n');
  assert.equal(JSON.parse(run(root,'propose')).status,'accepted');
  assert.equal(JSON.parse(run(root,'accept','--by','Dennis','--reason','Retry','--digest',proposal.digest)).status,'accepted');
  assert.equal(readWorkspaceHistory(root).length,2);
});

test('matching unified and legacy values do not overwrite either file',t=>{
  const root=fixture(t);
  const old=path.join(root,'config/slack-workspace.example.yml');
  fs.writeFileSync(old,legacy);
  const config={
    workspace:{repository:'legacy-repo',environment:'staging',provider:'codex',slack_channel_name:'ws-legacy-repo-codex',timezone:'UTC'},
    approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},
    approvals_overrides:{reason:'Headless project',exempt:['accessibility_reviewer','ui_designer']},
    daily_summary:{local_time:'10:30'},
  };
  const file=path.join(root,'config/workspace-config.yaml');
  fs.writeFileSync(file,YAML.stringify(config));
  const before=fs.readFileSync(file,'utf8');
  const proposal=JSON.parse(run(root,'propose'));
  assert.equal(proposal.status,'pending');
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.equal(fs.readFileSync(old,'utf8'),legacy);
  assert.equal(readWorkspaceHistory(root).at(-1).legacyDigest.length,64);
});

test('legacy conflicts and secret fields fail before changing sources',t=>{
  const root=fixture(t,'new-repo');
  run(root,'propose');
  const current=path.join(root,'config/workspace-config.yaml');
  const before=fs.readFileSync(current,'utf8');
  const old=path.join(root,'config/slack-workspace.example.yml');
  fs.writeFileSync(old,legacy);
  assert.throws(()=>run(root,'propose'));
  assert.equal(fs.readFileSync(current,'utf8'),before);
  assert.equal(fs.readFileSync(old,'utf8'),legacy);
  assert.equal(readWorkspaceHistory(root).length,1);
  fs.unlinkSync(old);
  fs.writeFileSync(old,legacy.replace('  timezone: UTC','  timezone: UTC\n  token: secret'));
  assert.throws(()=>run(root,'propose'));
  assert.equal(fs.readFileSync(current,'utf8'),before);
});

test('legacy symlink and post-proposal drift block migration',t=>{
  const root=fixture(t);
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-legacy-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const target=path.join(outside,'descriptor.yml');
  fs.writeFileSync(target,legacy);
  const old=path.join(root,'config/slack-workspace.example.yml');
  fs.symlinkSync(target,old);
  assert.throws(()=>run(root,'propose'));
  assert.equal(fs.existsSync(path.join(root,'config/workspace-config.yaml')),false);
  fs.unlinkSync(old);
  fs.writeFileSync(old,legacy);
  const proposal=JSON.parse(run(root,'propose'));
  fs.writeFileSync(old,legacy.replace('staging','production'));
  assert.throws(()=>run(root,'accept','--by','Dennis','--reason','Approved migration','--digest',proposal.digest));
  assert.equal(fs.existsSync(old),true);
  assert.equal(readWorkspaceHistory(root).at(-1).kind,'proposal');
});

test('policy changes stay read-only until matching human approval is applied',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const current=path.join(root,'config/workspace-config.yaml');
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(current,'utf8'));
  changed.approvals_required.qa=false;
  fs.writeFileSync(candidate,YAML.stringify(changed));
  const before=fs.readFileSync(current,'utf8');
  const proposed=JSON.parse(run(root,'propose-change','--candidate',candidate));
  assert.equal(proposed.status,'pending-change');
  assert.match(proposed.base_digest,/^[a-f0-9]{64}$/);
  assert.ok(proposed.changes.includes('approvals_required.qa'));
  assert.equal(fs.readFileSync(current,'utf8'),before);
  assert.equal(readWorkspaceHistory(root).length,2);
  assert.throws(()=>run(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','QA policy reviewed','--digest','0'.repeat(64),'--base-digest',proposed.base_digest));
  assert.equal(fs.readFileSync(current,'utf8'),before);
  assert.throws(()=>run(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','QA policy reviewed','--digest',proposed.digest));
  const applied=JSON.parse(run(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','QA policy reviewed','--digest',proposed.digest,'--base-digest',proposed.base_digest));
  assert.equal(applied.status,'accepted');
  assert.equal(applied.revision,2);
  assert.equal(readWorkspaceHistory(root).at(-1).kind,'change');
  assert.equal(JSON.parse(run(root,'status')).revision,2);
});

test('concurrent policy changes from one reviewed base leave one accepted revision',async t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  const calls=await Promise.all(Array.from({length:12},(_,index)=>runAsync(root,'apply-change','--candidate',candidate,
    '--by',`Reviewer-${index}`,'--reason','Concurrent review','--digest',change.digest,'--base-digest',change.base_digest)));
  assert.equal(calls.filter(call=>call.code===0).length,1);
  const history=readWorkspaceHistory(root);
  assert.equal(history.length,3);assert.equal(history.at(-1).revision,2);
  assert.equal(JSON.parse(run(root,'status')).status,'accepted');
});

test('a failed history append restores the accepted config and history pair',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const configFile=path.join(root,'config/workspace-config.yaml');
  const historyFile=path.join(root,'project/workspace-config-history.jsonl');
  const oldConfig=fs.readFileSync(configFile,'utf8');
  const oldHistory=fs.readFileSync(historyFile,'utf8');
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(oldConfig);changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  assert.throws(()=>runWithEnv(root,{WORKSPACE_INIT_TEST_FAULT:'history-append'},'apply-change','--candidate',candidate,
    '--by','Dennis','--reason','Injected append failure','--digest',change.digest,'--base-digest',change.base_digest));
  assert.equal(fs.readFileSync(configFile,'utf8'),oldConfig);
  assert.equal(fs.readFileSync(historyFile,'utf8'),oldHistory);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),false);
  assert.equal(JSON.parse(run(root,'status')).revision,1);
});

test('a committed transaction remains accepted when journal cleanup fails',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  assert.throws(()=>runWithEnv(root,{WORKSPACE_INIT_TEST_FAULT:'journal-cleanup'},'apply-change','--candidate',candidate,
    '--by','Dennis','--reason','Injected cleanup failure','--digest',change.digest,'--base-digest',change.base_digest));
  assert.equal(readWorkspaceHistory(root).at(-1).revision,2);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),true);
  assert.equal(JSON.parse(run(root,'status')).revision,2);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),false);
});

test('status recovers a killed prepared transaction and retains its advisory lock file',async t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  const child=spawnWithEnv(root,{WORKSPACE_INIT_TEST_PAUSE_AFTER:'prepared'},'apply-change','--candidate',candidate,
    '--by','Dennis','--reason','Interrupted change','--digest',change.digest,'--base-digest',change.base_digest);
  await waitForFile(path.join(root,'project/workspace-config-transaction.json'));
  child.kill('SIGKILL');
  const exited=await new Promise(resolve=>child.on('close',(code,signal)=>resolve({code,signal})));
  assert.equal(exited.signal,'SIGKILL');
  assert.equal(JSON.parse(run(root,'status')).revision,1);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),false);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-history.jsonl.lock')),true);
});

test('status resolves killed transactions at every post-prepare checkpoint',async t=>{
  for(const [checkpoint,revision] of [['config-replaced',1],['history-appended',1],['committed',2]]) {
    const root=fixture(t,`killed-${checkpoint}`);
    const proposal=JSON.parse(run(root,'propose'));
    run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
    const candidate=path.join(root,'candidate.yaml');
    const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
    changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
    const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
    const journal=path.join(root,'project/workspace-config-transaction.json');
    const child=spawnWithEnv(root,{WORKSPACE_INIT_TEST_PAUSE_AFTER:checkpoint},'apply-change','--candidate',candidate,
      '--by','Dennis','--reason',`Interrupted ${checkpoint}`,'--digest',change.digest,'--base-digest',change.base_digest);
    await waitFor(()=>{
      try { return JSON.parse(fs.readFileSync(journal,'utf8')).phase===checkpoint; }
      catch { return false; }
    },`Timed out waiting for ${checkpoint}`);
    child.kill('SIGKILL');
    const exited=await new Promise(resolve=>child.on('close',(code,signal)=>resolve({code,signal})));
    assert.equal(exited.signal,'SIGKILL');
    assert.equal(JSON.parse(run(root,'status')).revision,revision);
    assert.equal(fs.existsSync(journal),false);
  }
});

test('concurrent accepts are idempotent and create one acceptance record',async t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  const calls=await Promise.all(Array.from({length:8},(_,index)=>runAsync(root,'accept','--by',`Reviewer-${index}`,
    '--reason','Concurrent acceptance','--digest',proposal.digest)));
  assert.equal(calls.filter(call=>call.code===0).length,8,calls.filter(call=>call.code!==0).map(call=>call.error).join('\n'));
  const history=readWorkspaceHistory(root);
  assert.equal(history.length,2);assert.equal(history[1].kind,'acceptance');
  assert.equal(JSON.parse(run(root,'status')).status,'accepted');
});

test('an idempotent acceptance cannot interleave an invalid policy change',async t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  const [accepted,applied]=await Promise.all([
    runAsync(root,'accept','--by','Dennis','--reason','Idempotent acceptance','--digest',proposal.digest),
    runAsync(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','Reviewed change','--digest',change.digest,'--base-digest',change.base_digest),
  ]);
  assert.equal(accepted.code,0,accepted.error);
  assert.equal(applied.code,0,applied.error);
  const history=readWorkspaceHistory(root);
  assert.deepEqual(history.map(record=>record.kind),['proposal','acceptance','change']);
  assert.equal(JSON.parse(run(root,'status')).revision,2);
});

test('status recovers an interrupted policy change to its accepted pair',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const configFile=path.join(root,'config/workspace-config.yaml');
  const historyFile=path.join(root,'project/workspace-config-history.jsonl');
  const oldConfig=fs.readFileSync(configFile,'utf8');
  const oldHistory=fs.readFileSync(historyFile,'utf8');
  const candidate=YAML.parse(oldConfig);candidate.approvals_required.qa=false;
  const newConfig=YAML.stringify(candidate);
  const record={kind:'change',digest:workspaceConfigDigest(parseWorkspaceConfig(newConfig)),revision:2,date:'2026-09-25',by:'Dennis',reason:'Interrupted change',changes:['approvals_required.qa']};
  fs.writeFileSync(configFile,newConfig);
  fs.writeFileSync(path.join(root,'project/workspace-config-transaction.json'),JSON.stringify({
    phase:'config-replaced',oldConfig,oldHistory,oldHistoryLength:Buffer.byteLength(oldHistory),newConfig,
    newDigest:record.digest,record,
  }));
  const status=JSON.parse(run(root,'status'));
  assert.equal(status.status,'accepted');assert.equal(status.revision,1);
  assert.equal(fs.readFileSync(configFile,'utf8'),oldConfig);
  assert.equal(fs.readFileSync(historyFile,'utf8'),oldHistory);
  assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),false);
});

test('status resolves every durable transaction phase to its valid pair',t=>{
  for(const phase of ['prepared','config-replaced','history-appended','committed']) {
    const root=fixture(t,`phase-${phase}`);
    const proposal=JSON.parse(run(root,'propose'));
    run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
    const configFile=path.join(root,'config/workspace-config.yaml');
    const historyFile=path.join(root,'project/workspace-config-history.jsonl');
    const oldConfig=fs.readFileSync(configFile,'utf8');
    const oldHistory=fs.readFileSync(historyFile,'utf8');
    const candidate=YAML.parse(oldConfig);candidate.approvals_required.qa=false;
    const newConfig=YAML.stringify(candidate);
    const record={kind:'change',digest:workspaceConfigDigest(parseWorkspaceConfig(newConfig)),revision:2,date:'2026-09-25',by:'Dennis',reason:'Interrupted change',changes:['approvals_required.qa']};
    const newHistory=`${oldHistory}${JSON.stringify(record)}\n`;
    if(phase!=='prepared') fs.writeFileSync(configFile,newConfig);
    if(['history-appended','committed'].includes(phase)) fs.writeFileSync(historyFile,newHistory);
    fs.writeFileSync(path.join(root,'project/workspace-config-transaction.json'),JSON.stringify({
      phase,oldConfig,oldHistory,oldHistoryLength:Buffer.byteLength(oldHistory),newConfig,newDigest:record.digest,record,
    }));
    const status=JSON.parse(run(root,'status'));
    assert.equal(status.revision,phase==='committed' ? 2 : 1);
    assert.equal(fs.readFileSync(configFile,'utf8'),phase==='committed' ? newConfig : oldConfig);
    assert.equal(fs.readFileSync(historyFile,'utf8'),phase==='committed' ? newHistory : oldHistory);
    assert.equal(fs.existsSync(path.join(root,'project/workspace-config-transaction.json')),false);
  }
});

test('accept rereads history after recovering an uncommitted appended change',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const configFile=path.join(root,'config/workspace-config.yaml');
  const historyFile=path.join(root,'project/workspace-config-history.jsonl');
  const oldConfig=fs.readFileSync(configFile,'utf8');
  const oldHistory=fs.readFileSync(historyFile,'utf8');
  const candidate=YAML.parse(oldConfig);candidate.approvals_required.qa=false;
  const newConfig=YAML.stringify(candidate);
  const record={kind:'change',digest:workspaceConfigDigest(parseWorkspaceConfig(newConfig)),revision:2,date:'2026-09-25',by:'Dennis',reason:'Interrupted change',changes:['approvals_required.qa']};
  fs.writeFileSync(configFile,newConfig);
  fs.writeFileSync(historyFile,`${oldHistory}${JSON.stringify(record)}\n`);
  fs.writeFileSync(path.join(root,'project/workspace-config-transaction.json'),JSON.stringify({
    phase:'history-appended',oldConfig,oldHistory,oldHistoryLength:Buffer.byteLength(oldHistory),newConfig,newDigest:record.digest,record,
  }));
  const accepted=JSON.parse(run(root,'accept','--by','Dennis','--reason','Retry accepted policy','--digest',proposal.digest));
  assert.equal(accepted.revision,1);
  assert.equal(readWorkspaceHistory(root).at(-1).revision,1);
});

test('status rejects a transaction journal without its byte length and new digest',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const configFile=path.join(root,'config/workspace-config.yaml');
  const historyFile=path.join(root,'project/workspace-config-history.jsonl');
  const oldConfig=fs.readFileSync(configFile,'utf8');
  const oldHistory=fs.readFileSync(historyFile,'utf8');
  const candidate=YAML.parse(oldConfig);candidate.approvals_required.qa=false;
  const newConfig=YAML.stringify(candidate);
  const record={kind:'change',digest:workspaceConfigDigest(parseWorkspaceConfig(newConfig)),revision:2,date:'2026-09-25',by:'Dennis',reason:'Interrupted change',changes:['approvals_required.qa']};
  fs.writeFileSync(path.join(root,'project/workspace-config-transaction.json'),JSON.stringify({phase:'prepared',oldConfig,oldHistory,newConfig,record}));
  assert.throws(()=>run(root,'status'));
  assert.equal(fs.readFileSync(configFile,'utf8'),oldConfig);
  assert.equal(fs.readFileSync(historyFile,'utf8'),oldHistory);
});

test('a legacy dead lock-owner sidecar cannot interfere with a policy change',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  changed.approvals_required.qa=false;fs.writeFileSync(candidate,YAML.stringify(changed));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  const lock=path.join(root,'project/workspace-config-history.jsonl.lock');
  const owner=`${lock}.99999999.dead.owner`;
  fs.writeFileSync(owner,JSON.stringify({pid:99999999,nonce:'0'.repeat(32)}));
  assert.equal(JSON.parse(run(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','Ignored sidecar',
    '--digest',change.digest,'--base-digest',change.base_digest)).status,'accepted');
  assert.equal(fs.existsSync(lock),true);assert.equal(fs.existsSync(owner),true);
});

test('a persistent advisory lock file remains usable after a legacy sidecar is left behind',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
  const lock=path.join(root,'project/workspace-config-history.jsonl.lock');
  const owner=`${lock}.99999999.dead.owner`;
  fs.writeFileSync(owner,JSON.stringify({pid:99999999,nonce:'0'.repeat(32)}));
  assert.equal(JSON.parse(run(root,'status')).revision,1);
  assert.equal(fs.existsSync(lock),true);assert.equal(fs.existsSync(owner),true);
});

test('two waiters recover after an advisory-lock holder dies without deleting its lock path',async t=>{
 const root=fixture(t);
 const proposal=JSON.parse(run(root,'propose'));
 run(root,'accept','--by','Dennis','--reason','Initial policy','--digest',proposal.digest);
 const lock=path.join(root,'project/workspace-config-history.jsonl.lock');
 const extension=JSON.stringify(path.join(source,'node_modules','fs-ext'));
 const holder=spawn(process.execPath,['-e',`const fs=require('node:fs'),ext=require(${extension});const fd=fs.openSync(process.argv[1],'a');ext.flockSync(fd,'ex');console.log('ready');setInterval(()=>{},1000);`,lock],{cwd:root,stdio:['ignore','pipe','pipe']});
 let ready='';holder.stdout.on('data',chunk=>{ready+=chunk;});
 await waitFor(()=>ready.includes('ready'),'Timed out waiting for advisory-lock holder');
 let firstDone=false,secondDone=false;
 const first=runAsync(root,'status').then(result=>{firstDone=true;return result;});
 const second=runAsync(root,'status').then(result=>{secondDone=true;return result;});
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(firstDone,false);assert.equal(secondDone,false);
 holder.kill('SIGKILL');
 const exited=await new Promise(resolve=>holder.on('close',(code,signal)=>resolve({code,signal})));
 assert.equal(exited.signal,'SIGKILL');
 for(const result of await Promise.all([first,second])) {
   assert.equal(result.code,0,result.error);assert.equal(JSON.parse(result.output).revision,1);
 }
 assert.ok(fs.existsSync(lock));
});

test('stale no-UI exemptions and UI policy waivers are refused',t=>{
  const root=fixture(t,'web-app',{react:'19.0.0'});
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial UI policy','--digest',proposal.digest);
  const candidate=path.join(root,'candidate.yaml');
  const waiver=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  waiver.approvals_required.accessibility_reviewer=false;
  waiver.approvals_required.ui_designer=false;
  waiver.approvals_overrides={reason:'No UI',exempt:['accessibility_reviewer','ui_designer']};
  fs.writeFileSync(candidate,YAML.stringify(waiver));
  assert.throws(()=>run(root,'propose-change','--candidate',candidate),/accessibility/);
  const headless=fixture(t);
  const headlessProposal=JSON.parse(run(headless,'propose'));
  run(headless,'accept','--by','Dennis','--reason','Initial headless policy','--digest',headlessProposal.digest);
  fs.mkdirSync(path.join(headless,'src'));
  fs.writeFileSync(path.join(headless,'src/App.tsx'),'export default function App() { return null; }\n');
  assert.throws(()=>run(headless,'status'),/stale|accessibility/i);
});

test('a stale accepted policy can be corrected but cannot be newly accepted for UI work',t=>{
  const root=fixture(t);
  const proposal=JSON.parse(run(root,'propose'));
  run(root,'accept','--by','Dennis','--reason','Initial headless policy','--digest',proposal.digest);
  fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src/App.tsx'),'export default function App() { return null; }\n');
  const candidate=path.join(root,'candidate.yaml');
  const corrected=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  corrected.approvals_required.accessibility_reviewer=true;
  corrected.approvals_required.ui_designer=true;
  corrected.approvals_overrides={exempt:[]};
  fs.writeFileSync(candidate,YAML.stringify(corrected));
  const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
  assert.equal(JSON.parse(run(root,'apply-change','--candidate',candidate,'--by','Dennis','--reason','UI policy restored','--digest',change.digest,'--base-digest',change.base_digest)).status,'accepted');
  assert.equal(JSON.parse(run(root,'status')).status,'accepted');
  const pending=fixture(t);
  const pendingProposal=JSON.parse(run(pending,'propose'));
  fs.mkdirSync(path.join(pending,'src'));
  fs.writeFileSync(path.join(pending,'src/App.tsx'),'export default function App() { return null; }\n');
  assert.throws(()=>run(pending,'accept','--by','Dennis','--reason','Stale policy','--digest',pendingProposal.digest),/accessibility/i);
});

test('linked status requires accepted root and overlay policy with provenance',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-linked-status-'));
  const linked=path.join(os.tmpdir(),`workspace-linked-status-${path.basename(root)}`);
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'project'));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'linked-status'}));
  const rootConfig={workspace:{repository:'linked-status',environment:'local',provider:'codex',slack_channel_name:'ws-linked-status-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'}};
  fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(rootConfig));
  execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.email','qa@example.test'],{cwd:root});execFileSync('git',['config','user.name','QA'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-qm','fixture'],{cwd:root});execFileSync('git',['worktree','add','-q','-b','linked-status',linked],{cwd:root});
  const rootProposal=JSON.parse(run(root,'propose'));run(root,'accept','--by','Dennis','--reason','Root policy','--digest',rootProposal.digest);
  const overlay=YAML.parse(fs.readFileSync(path.join(linked,'config/workspace-config.yaml'),'utf8'));overlay.approvals_required.qa=false;overlay.worktree_overrides=['approvals_required.qa'];fs.writeFileSync(path.join(linked,'config/workspace-config.yaml'),YAML.stringify(overlay));
  assert.throws(()=>run(linked,'status'));
  const overlayProposal=JSON.parse(run(linked,'propose'));run(linked,'accept','--by','Dennis','--reason','Overlay policy','--digest',overlayProposal.digest);
  const status=JSON.parse(run(linked,'status'));
  assert.equal(status.status,'accepted');assert.equal(status.sources['approvals_required.qa'],'worktree');assert.equal(status.sources['workspace.provider'],'root');
});

test('linked status waits for and recovers a paused coordination-root transaction',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-linked-transaction-'));
 const linked=path.join(os.tmpdir(),`workspace-linked-transaction-${path.basename(root)}`);
 t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(linked,{recursive:true,force:true});});
 fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'project'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'linked-transaction'}));
 const config={workspace:{repository:'linked-transaction',environment:'local',provider:'codex',slack_channel_name:'ws-linked-transaction-codex',timezone:'UTC'},approvals_required:{principal:true,qa:true,appsec:true,accessibility_reviewer:false,ui_designer:false},approvals_overrides:{reason:'No UI',exempt:['accessibility_reviewer','ui_designer']},daily_summary:{local_time:'09:00'}};
 fs.writeFileSync(path.join(root,'config/workspace-config.yaml'),YAML.stringify(config));
 execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['config','user.email','qa@example.test'],{cwd:root});execFileSync('git',['config','user.name','QA'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-qm','fixture'],{cwd:root});execFileSync('git',['worktree','add','-q','-b','linked-transaction',linked],{cwd:root});
 const rootProposal=JSON.parse(run(root,'propose'));run(root,'accept','--by','Dennis','--reason','Root policy','--digest',rootProposal.digest);
 const overlay=YAML.parse(fs.readFileSync(path.join(linked,'config/workspace-config.yaml'),'utf8'));overlay.approvals_required.qa=false;overlay.worktree_overrides=['approvals_required.qa'];fs.writeFileSync(path.join(linked,'config/workspace-config.yaml'),YAML.stringify(overlay));
 const overlayProposal=JSON.parse(run(linked,'propose'));run(linked,'accept','--by','Dennis','--reason','Overlay policy','--digest',overlayProposal.digest);
 const before=JSON.parse(run(linked,'status'));
 const candidate=path.join(root,'candidate.yaml');const changed=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));changed.workspace.timezone='America/New_York';fs.writeFileSync(candidate,YAML.stringify(changed));
 const change=JSON.parse(run(root,'propose-change','--candidate',candidate));
 const writer=spawnWithEnv(root,{WORKSPACE_INIT_TEST_PAUSE_AFTER:'history-appended'},'apply-change','--candidate',candidate,'--by','Dennis','--reason','Paused root change','--digest',change.digest,'--base-digest',change.base_digest);
 await waitForFile(path.join(root,'project/workspace-config-transaction.json'));
 await waitFor(()=>JSON.parse(fs.readFileSync(path.join(root,'project/workspace-config-transaction.json'),'utf8')).phase==='history-appended','Timed out waiting for root history append');
 let complete=false;const pending=runAsync(linked,'status').then(result=>{complete=true;return result;});
 await new Promise(resolve=>setTimeout(resolve,100));assert.equal(complete,false);
 writer.kill('SIGKILL');
 const exited=await new Promise(resolve=>writer.on('close',(code,signal)=>resolve({code,signal})));assert.equal(exited.signal,'SIGKILL');
 const recovered=await pending;assert.equal(recovered.code,0,recovered.error);
 assert.equal(JSON.parse(recovered.output).digest,before.digest);assert.equal(JSON.parse(recovered.output).revision,1);
});
