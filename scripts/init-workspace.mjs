#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {parseWorkspaceConfig,resolveWorkspaceConfig,workspaceConfigDigest} from './lib/workspace-config.mjs';
import {appendWorkspaceHistory,readWorkspaceHistory,parseWorkspaceHistory,assertAcceptedWorkspaceConfig,withWorkspaceHistoryLock} from './lib/workspace-history.mjs';

function options(args) {
  const result={};
  for(let index=0;index<args.length;index+=2) {
    const flag=args[index];
    if(!['--root','--candidate','--by','--reason','--digest','--base-digest'].includes(flag) || index+1>=args.length || Object.hasOwn(result,flag)) {
      throw new Error(`Invalid option ${flag ?? ''}`);
    }
    result[flag]=args[index+1];
  }
  return result;
}

function configPath(root) {
  const directory=path.join(root,'config');
  fs.mkdirSync(directory,{recursive:true});
  if(fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory)!==directory) {
    throw new Error('Config directory must be inside the repository, not a symlink');
  }
  const file=path.join(directory,'workspace-config.yaml');
  if(fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile())) {
    throw new Error('Workspace config must be a regular file');
  }
  return file;
}

function transactionPath(root) {
  const base=fs.realpathSync(root),directory=path.join(base,'project');
  fs.mkdirSync(directory,{recursive:true});
  const actual=fs.realpathSync(directory);
  if(fs.lstatSync(directory).isSymbolicLink() || !actual.startsWith(base+path.sep)) {
    throw new Error('Workspace transaction directory must be inside the repository');
  }
  const file=path.join(directory,'workspace-config-transaction.json');
  if(fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile())) {
    throw new Error('Workspace transaction must be a regular file');
  }
  return file;
}

function syncDirectory(directory) {
  const descriptor=fs.openSync(directory,'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeAtomic(file,contents) {
  const temporary=`${file}.${process.pid}.${Date.now()}.tmp`;
  const descriptor=fs.openSync(temporary,'wx',0o600);
  try { fs.writeFileSync(descriptor,contents,'utf8');fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
  try { fs.renameSync(temporary,file);syncDirectory(path.dirname(file)); }
  finally { if(fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function writeTransaction(journal,entry) {
  writeAtomic(journal,JSON.stringify(entry));
}

function removeTransaction(journal) {
  fs.unlinkSync(journal);
  syncDirectory(path.dirname(journal));
}

function pauseForTest(checkpoint) {
  if(process.env.WORKSPACE_INIT_TEST_PAUSE_AFTER===checkpoint) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60_000);
  }
}

function restoreTransactionPair(root,config,history,entry) {
  writeAtomic(config,entry.oldConfig);
  writeAtomic(history,entry.oldHistory);
  assertAcceptedWorkspaceConfig(root,parseWorkspaceConfig(entry.oldConfig));
}

function validateTransactionEntry(entry) {
  if(!entry || !['prepared','config-replaced','history-appended','committed'].includes(entry.phase) ||
    ![entry.oldConfig,entry.oldHistory,entry.newConfig].every(value=>typeof value==='string') ||
    !Number.isSafeInteger(entry.oldHistoryLength) || entry.oldHistoryLength<0 ||
    !/^[a-f0-9]{64}$/.test(entry.newDigest ?? '') || !entry.record) {
    throw new Error('Workspace transaction is malformed');
  }
  if(Buffer.byteLength(entry.oldHistory)!==entry.oldHistoryLength) throw new Error('Workspace transaction history length is inconsistent');
  const oldConfig=parseWorkspaceConfig(entry.oldConfig);
  const oldRecords=parseWorkspaceHistory(entry.oldHistory);
  const oldRecord=oldRecords.at(-1);
  if(!oldRecord || !['acceptance','change'].includes(oldRecord.kind) || oldRecord.digest!==workspaceConfigDigest(oldConfig)) {
    throw new Error('Workspace transaction old state is inconsistent');
  }
  const newConfig=parseWorkspaceConfig(entry.newConfig);
  if(workspaceConfigDigest(newConfig)!==entry.newDigest || entry.record.digest!==entry.newDigest) {
    throw new Error('Workspace transaction new state is inconsistent');
  }
  const newHistory=`${entry.oldHistory}${JSON.stringify(entry.record)}\n`;
  const newRecords=parseWorkspaceHistory(newHistory);
  if(JSON.stringify(newRecords.at(-1))!==JSON.stringify(entry.record)) throw new Error('Workspace transaction record is inconsistent');
  return {...entry,newHistory};
}

function recoverWorkspaceTransaction(root) {
  const journal=transactionPath(root);
  if(!fs.existsSync(journal)) return;
  let entry;
  try { entry=JSON.parse(fs.readFileSync(journal,'utf8')); }
  catch { throw new Error('Workspace transaction is malformed'); }
  entry=validateTransactionEntry(entry);
  const config=configPath(root),history=path.join(root,'project','workspace-config-history.jsonl');
  if(fs.lstatSync(history).isSymbolicLink() || !fs.statSync(history).isFile()) throw new Error('Workspace history must be a regular file');
  const currentConfig=fs.readFileSync(config,'utf8'),currentHistory=fs.readFileSync(history,'utf8');
  const configKnown=[entry.oldConfig,entry.newConfig].includes(currentConfig);
  const historyKnown=[entry.oldHistory,entry.newHistory].includes(currentHistory);
  if(!configKnown || !historyKnown) throw new Error('Workspace transaction state is inconsistent');
  if(entry.phase==='committed') {
    const current=parseWorkspaceConfig(currentConfig);
    const latest=readWorkspaceHistory(root).at(-1);
    if(currentConfig!==entry.newConfig || currentHistory!==entry.newHistory ||
      workspaceConfigDigest(current)!==entry.newDigest ||
      JSON.stringify(latest)!==JSON.stringify(entry.record)) throw new Error('Workspace transaction committed state is inconsistent');
  } else if(currentConfig!==entry.oldConfig || currentHistory!==entry.oldHistory) {
    restoreTransactionPair(root,config,history,entry);
  }
  removeTransaction(journal);
}

function coordinationRoot(root) {
  try {
    const worktrees=execFileSync('git',['-C',root,'worktree','list','--porcelain'],{encoding:'utf8'})
      .split('\n').filter(line=>line.startsWith('worktree '));
    return worktrees.length ? fs.realpathSync(worktrees[0].slice(9)) : root;
  } catch { return root; }
}

function existingConfig(root) {
  const file=configPath(root);
  if(!fs.existsSync(file)) throw new Error('Workspace config is missing');
  return parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
}

function candidateConfig(root,candidate) {
  if(!candidate) throw new Error('Policy change requires --candidate');
  const requested=path.resolve(root,candidate);
  const stat=fs.lstatSync(requested);
  const file=fs.realpathSync(requested);
  if(!file.startsWith(root+path.sep) || !stat.isFile() || stat.isSymbolicLink() || stat.size>1024*1024) {
    throw new Error('Candidate config must be a regular file inside the repository under 1 MB');
  }
  return parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
}

function readLegacy(root) {
  const file=path.join(root,'config','slack-workspace.example.yml');
  let stat;
  try { stat=fs.lstatSync(file); }
  catch(error) {
    if(error.code==='ENOENT') return null;
    throw error;
  }
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>1024*1024 || fs.realpathSync(file)!==file) {
    throw new Error('Legacy Slack descriptor must be a regular file inside config under 1 MB');
  }
  const descriptor=fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let raw,opened;
  try {
    opened=fs.fstatSync(descriptor);
    if(!opened.isFile() || opened.size>1024*1024) {
      throw new Error('Legacy Slack descriptor must be a regular file under 1 MB');
    }
    raw=fs.readFileSync(descriptor,'utf8');
  } finally { fs.closeSync(descriptor); }
  if(Buffer.byteLength(raw,'utf8')>1024*1024) {
    throw new Error('Legacy Slack descriptor must be under 1 MB');
  }
  const current=fs.lstatSync(file);
  if(!current.isFile() || current.dev!==opened.dev || current.ino!==opened.ino) {
    throw new Error('Legacy Slack descriptor changed while reading');
  }
  const document=YAML.parseDocument(raw,{uniqueKeys:true});
  if(document.errors.length) {
    throw new Error(`Invalid legacy Slack YAML: ${document.errors.map(error=>error.message).join('; ')}`);
  }
  let value;
  try { value=document.toJS({maxAliasCount:0}); }
  catch(error) { throw new Error(`Invalid legacy Slack YAML: ${error.message}`); }
  const allowed=(object,keys,required,label)=>{
    if(!object || typeof object!=='object' || Array.isArray(object)) throw new Error(`${label} must be a mapping`);
    for(const key of Object.keys(object)) if(!keys.includes(key)) throw new Error(`${label}.${key} is not allowed`);
    for(const key of required) if(!Object.hasOwn(object,key)) throw new Error(`${label}.${key} is required`);
    return object;
  };
  const sections=allowed(value,['workspace','daily_summary'],['workspace','daily_summary'],'legacy');
  const names=['repository','environment','provider','channel_name','timezone'];
  const workspace=allowed(sections.workspace,names,names,'legacy.workspace');
  const summary=allowed(sections.daily_summary,['local_time'],['local_time'],'legacy.daily_summary');
  const values={
    workspace:{
      repository:workspace.repository,environment:workspace.environment,provider:workspace.provider,
      slack_channel_name:workspace.channel_name,timezone:workspace.timezone,
    },
    daily_summary:{local_time:summary.local_time},
  };
  return {file,digest:createHash('sha256').update(raw).digest('hex'),values,device:opened.dev,inode:opened.ino};
}

function assertLegacyMatches(config,legacy) {
  for(const [section,entries] of Object.entries(legacy.values)) {
    for(const [key,value] of Object.entries(entries)) {
      if(config[section]?.[key]!==value) throw new Error(`Legacy Slack conflict at ${section}.${key}`);
    }
  }
}

function assertLegacySource(record,legacy,config) {
  if(record.legacyDigest && !legacy) throw new Error('Legacy Slack descriptor disappeared after proposal');
  if(legacy && !record.legacyDigest) throw new Error('Legacy Slack descriptor appeared after proposal');
  if(legacy && record.legacyDigest!==legacy.digest) throw new Error('Legacy Slack descriptor changed after proposal');
  if(legacy) assertLegacyMatches(config,legacy);
}

function retireLegacy(root,reviewed) {
  const current=readLegacy(root);
  if(!current || current.digest!==reviewed.digest || current.device!==reviewed.device || current.inode!==reviewed.inode) {
    throw new Error('Legacy Slack descriptor changed before retirement');
  }
  fs.unlinkSync(reviewed.file);
}

function readPackage(root) {
  const file=path.join(root,'package.json');
  if(!fs.existsSync(file)) return {};
  if(fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile() || fs.statSync(file).size>1024*1024) {
    throw new Error('package.json must be a regular file under 1 MB');
  }
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!value || typeof value!=='object' || Array.isArray(value)) {
    throw new Error('package.json must contain an object');
  }
  return value;
}

function repositoryName(root,pkg) {
  const raw=(typeof pkg.name==='string' ? pkg.name.split('/').at(-1) : path.basename(root)).toLowerCase();
  return raw.replace(/[^a-z0-9._-]+/g,'-').replace(/^[^a-z0-9]+|[^a-z0-9]+$/g,'') || 'project';
}

function proposalFor(root) {
  const pkg=readPackage(root);
  const dependencies={...pkg.dependencies,...pkg.devDependencies};
  const hasUI=['react','next','vue','svelte','@angular/core','astro'].some(name=>Object.hasOwn(dependencies,name)) ||
    ['index.html','src/App.tsx','app/page.tsx'].some(name=>fs.existsSync(path.join(root,name)));
  const hasTests=fs.existsSync(path.join(root,'tests')) || fs.existsSync(path.join(root,'.github/workflows'));
  const hasSecuritySurface=['express','next','next-auth','@auth/core','stripe','passport'].some(name=>Object.hasOwn(dependencies,name));
  const repository=repositoryName(root,pkg);
  const config={
    workspace:{
      repository,environment:'local',provider:'codex',
      slack_channel_name:`ws-${repository}-codex`,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    approvals_required:{
      principal:true,qa:true,appsec:true,
      accessibility_reviewer:hasUI,ui_designer:hasUI,
    },
    approvals_overrides:hasUI ? {exempt:[]} : {
      reason:'No user interface detected in this repository',
      exempt:['accessibility_reviewer','ui_designer'],
    },
    daily_summary:{local_time:'09:00'},
  };
  const reasons={
    principal:'Tier 3 architectural and interface changes need Principal review.',
    qa:hasTests ? 'Tests or CI detected; QA review protects the existing bar.' : 'No tests or CI detected; QA review is proposed to establish a bar.',
    appsec:hasSecuritySurface ? 'Security-relevant dependencies detected; AppSec review is proposed.' : 'No security dependency signal detected; AppSec review is proposed conservatively for policy and external boundaries.',
    accessibility_reviewer:hasUI ? 'A user interface was detected.' : 'No user interface was detected; proposed structural exemption requires human acceptance.',
    ui_designer:hasUI ? 'A user interface was detected.' : 'No user interface was detected; proposed structural exemption requires human acceptance.',
  };
  return {config:parseWorkspaceConfig(YAML.stringify(config)),reasons};
}

function assertCurrentUiPolicy(root,config) {
  const pkg=readPackage(root);
  const dependencies={...pkg.dependencies,...pkg.devDependencies};
  const hasUI=['react','next','vue','svelte','@angular/core','astro'].some(name=>Object.hasOwn(dependencies,name)) ||
    ['index.html','src/App.tsx','app/page.tsx'].some(name=>fs.existsSync(path.join(root,name)));
  if(!hasUI) return;
  if(config.approvals_required.accessibility_reviewer!==true || config.approvals_required.ui_designer!==true ||
    config.approvals_overrides.exempt.includes('accessibility_reviewer') || config.approvals_overrides.exempt.includes('ui_designer')) {
    throw new Error('UI work requires current accessibility and UI design review; stale exemptions are not effective');
  }
}

function changedFields(before,after,prefix='') {
  const keys=new Set([...Object.keys(before ?? {}),...Object.keys(after ?? {})]);
  const changed=[];
  for(const key of keys) {
    const name=prefix ? `${prefix}.${key}` : key;
    const left=before?.[key],right=after?.[key];
    if(left && right && typeof left==='object' && typeof right==='object' && !Array.isArray(left) && !Array.isArray(right)) {
      changed.push(...changedFields(left,right,name));
    } else if(JSON.stringify(left)!==JSON.stringify(right)) changed.push(name);
  }
  return changed.sort();
}

function acceptedConfig(root) {
  const file=configPath(root);
  const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
  const record=assertAcceptedWorkspaceConfig(root,config);
  return {file,config,record};
}

function proposeChange(root,args) {
  return withWorkspaceHistoryLock(root,()=>{
    const {config,record}=acceptedConfig(root);
    const candidate=candidateConfig(root,args['--candidate']);
    assertCurrentUiPolicy(root,candidate);
    return {status:'pending-change',digest:workspaceConfigDigest(candidate),base_digest:record.digest,changes:changedFields(config,candidate)};
  },{beforeRead:()=>recoverWorkspaceTransaction(root)});
}

function applyChange(root,args) {
  const by=args['--by']?.trim(),reason=args['--reason']?.trim(),expected=args['--digest'],base=args['--base-digest'];
  if(!by || !reason || !/^[a-f0-9]{64}$/.test(expected ?? '') || !/^[a-f0-9]{64}$/.test(base ?? '')) {
    throw new Error('Policy change requires --by, --reason, --digest, and --base-digest');
  }
  const candidate=candidateConfig(root,args['--candidate']);
  assertCurrentUiPolicy(root,candidate);
  const digest=workspaceConfigDigest(candidate);
  if(expected!==digest) throw new Error('Candidate digest differs from the reviewed policy change');
  return withWorkspaceHistoryLock(root,({append})=>{
    const {file,config,record:current}=acceptedConfig(root);
    if(base!==current.digest) throw new Error('Accepted policy changed after the reviewed base');
    const record={kind:'change',digest,revision:current.revision+1,date:new Date().toISOString().slice(0,10),by,reason,
      changes:changedFields(config,candidate)};
    const previous=fs.readFileSync(file,'utf8');
    const historyFile=path.join(root,'project','workspace-config-history.jsonl');
    const journal=transactionPath(root);
    const next=YAML.stringify(candidate);
    const oldHistory=fs.readFileSync(historyFile,'utf8');
    const entry={phase:'prepared',oldConfig:previous,oldHistory,oldHistoryLength:Buffer.byteLength(oldHistory),newConfig:next,newDigest:digest,record};
    writeTransaction(journal,entry);
    pauseForTest('prepared');
    let committed=false;
    try {
      writeAtomic(file,next);
      entry.phase='config-replaced';writeTransaction(journal,entry);
      if(process.env.WORKSPACE_INIT_TEST_FAULT==='history-append') throw new Error('Injected history append failure');
      append(record);
      entry.phase='history-appended';writeTransaction(journal,entry);
      assertAcceptedWorkspaceConfig(root,candidate);
      entry.phase='committed';writeTransaction(journal,entry);
      committed=true;
      if(process.env.WORKSPACE_INIT_TEST_FAULT==='journal-cleanup') throw new Error('Injected journal cleanup failure');
      removeTransaction(journal);
    } catch(error) {
      if(committed) throw error;
      try {
        restoreTransactionPair(root,file,historyFile,entry);
        if(fs.existsSync(journal)) removeTransaction(journal);
      } catch(rollbackError) {
        throw new Error(`Policy change failed and rollback could not be verified: ${rollbackError.message}`);
      }
      throw error;
    }
    return {status:'accepted',digest,revision:record.revision};
  },{beforeRead:()=>recoverWorkspaceTransaction(root)});
}

function proposeLocked(root,history,append) {
  const file=configPath(root);
  const legacy=readLegacy(root);
  if(fs.existsSync(file)) {
    const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
    const digest=workspaceConfigDigest(config);
    const latest=history.at(-1);
    if(legacy) assertLegacyMatches(config,legacy);
    if(latest && ['acceptance','change'].includes(latest.kind)) {
      assertAcceptedWorkspaceConfig(root,config);
      if(legacy) throw new Error('Legacy Slack descriptor remains after acceptance; retry accept to retire it');
      return {status:'accepted',digest,revision:latest.revision};
    }
    if(latest && latest.kind!=='proposal') throw new Error('Unknown workspace history state');
    if(latest) assertLegacySource(latest,legacy,config);
    const reasons=latest?.reasons ?? Object.fromEntries(
      ['principal','qa','appsec','accessibility_reviewer','ui_designer'].map(role=>[role,'Existing value requires human review.'])
    );
    if(!latest) append({
      kind:'proposal',digest,revision:1,date:new Date().toISOString().slice(0,10),config,reasons,
      ...(legacy ? {legacyDigest:legacy.digest} : {}),
    });
    return {status:'pending',digest,reasons};
  }
  if(history.length) throw new Error('Workspace config is missing but history exists');
  const {config:defaults,reasons}=proposalFor(root);
  const config=legacy ? parseWorkspaceConfig(YAML.stringify({
    ...defaults,workspace:legacy.values.workspace,daily_summary:legacy.values.daily_summary,
  })) : defaults;
  const digest=workspaceConfigDigest(config);
  fs.writeFileSync(file,YAML.stringify(config),{flag:'wx',mode:0o600});
  append({
    kind:'proposal',digest,revision:1,date:new Date().toISOString().slice(0,10),config,reasons,
    ...(legacy ? {legacyDigest:legacy.digest} : {}),
  });
  return {status:'pending',digest,reasons};
}

function propose(root) {
  return withWorkspaceHistoryLock(root,({records,append})=>{
    return proposeLocked(root,records,append);
  },{beforeRead:()=>recoverWorkspaceTransaction(root)});
}

function accept(root,args) {
  const by=args['--by']?.trim(),reason=args['--reason']?.trim(),expected=args['--digest'];
  if(!by || !reason || !/^[a-f0-9]{64}$/.test(expected ?? '')) {
    throw new Error('Acceptance requires --by, --reason, and --digest');
  }
  return withWorkspaceHistoryLock(root,({records,append})=>{
    const file=configPath(root);
    const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
    const digest=workspaceConfigDigest(config);
    if(expected!==digest) throw new Error('Config digest differs from the reviewed proposal');
    assertCurrentUiPolicy(root,config);
    const proposal=records.at(-1);
    const legacy=readLegacy(root);
    if(proposal && ['acceptance','change'].includes(proposal.kind)) {
      assertAcceptedWorkspaceConfig(root,config);
      if(legacy) { assertLegacySource(proposal,legacy,config);retireLegacy(root,legacy); }
      return {status:'accepted',digest,revision:proposal.revision};
    }
    if(!proposal || proposal.kind!=='proposal') throw new Error('A pending proposal is required before acceptance');
    assertLegacySource(proposal,legacy,config);
    const record={kind:'acceptance',digest,revision:proposal.revision,date:new Date().toISOString().slice(0,10),by,reason,
      changes:changedFields(proposal.config,config),...(legacy ? {legacyDigest:legacy.digest} : {})};
    append(record);if(legacy) retireLegacy(root,legacy);
    return {status:'accepted',digest,revision:record.revision};
  },{beforeRead:()=>recoverWorkspaceTransaction(root)});
}

function status(root) {
  return withWorkspaceHistoryLock(root,()=>{
    const coordination=coordinationRoot(root);
    const {config,sources}=resolveWorkspaceConfig({coordinationRoot:coordination,worktreeRoot:root});
    let record=assertAcceptedWorkspaceConfig(coordination,existingConfig(coordination));
    if(root!==coordination) record=assertAcceptedWorkspaceConfig(root,existingConfig(root));
    assertCurrentUiPolicy(root,config);
    return {status:'accepted',digest:workspaceConfigDigest(config),revision:record.revision,sources};
  },{beforeRead:()=>recoverWorkspaceTransaction(root)});
}

try {
  const [action,...rest]=process.argv.slice(2);
  const args=options(rest);
  const root=fs.realpathSync(args['--root'] ?? process.cwd());
  if(!['propose','accept','status','propose-change','apply-change'].includes(action)) {
    throw new Error('Usage: init-workspace.mjs propose|accept|status|propose-change|apply-change [options]');
  }
  if(!['accept','apply-change'].includes(action) && ['--by','--reason','--digest','--base-digest'].some(key=>Object.hasOwn(args,key))) {
    throw new Error('Approval options are only valid with accept');
  }
  if(!['propose-change','apply-change'].includes(action) && Object.hasOwn(args,'--candidate')) {
    throw new Error('Candidate config is only valid with policy changes');
  }
  const result=action==='propose' ? propose(root) : action==='accept' ? accept(root,args) : action==='status' ? status(root) :
    action==='propose-change' ? proposeChange(root,args) : applyChange(root,args);
  console.log(JSON.stringify(result));
} catch(error) {
  console.error(`GATE BLOCKED: ${error.message}`);
  process.exitCode=1;
}
