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

function runAsync(root,...args) {
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[cli,...args,'--root',root],{stdio:['ignore','pipe','pipe']});
    let output='',error='';
    child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{error+=chunk;});
    child.on('close',code=>resolve({code,output,error}));
  });
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
