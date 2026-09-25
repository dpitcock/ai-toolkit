#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {parseWorkspaceConfig,resolveWorkspaceConfig,workspaceConfigDigest} from './lib/workspace-config.mjs';
import {appendWorkspaceHistory,readWorkspaceHistory,assertAcceptedWorkspaceConfig} from './lib/workspace-history.mjs';

function options(args) {
  const result={};
  for(let index=0;index<args.length;index+=2) {
    const flag=args[index];
    if(!['--root','--by','--reason','--digest'].includes(flag) || index+1>=args.length || Object.hasOwn(result,flag)) {
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

function propose(root) {
  const file=configPath(root);
  const history=readWorkspaceHistory(root);
  if(fs.existsSync(file)) {
    const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
    const digest=workspaceConfigDigest(config);
    const latest=history.at(-1);
    if(latest && ['acceptance','change'].includes(latest.kind)) {
      assertAcceptedWorkspaceConfig(root,config);
      return {status:'accepted',digest,revision:latest.revision};
    }
    if(latest && latest.kind!=='proposal') throw new Error('Unknown workspace history state');
    const reasons=latest?.reasons ?? Object.fromEntries(
      ['principal','qa','appsec','accessibility_reviewer','ui_designer'].map(role=>[role,'Existing value requires human review.'])
    );
    if(!latest) appendWorkspaceHistory(root,{kind:'proposal',digest,revision:1,date:new Date().toISOString().slice(0,10),config,reasons});
    return {status:'pending',digest,reasons};
  }
  if(history.length) throw new Error('Workspace config is missing but history exists');
  const {config,reasons}=proposalFor(root);
  const digest=workspaceConfigDigest(config);
  fs.writeFileSync(file,YAML.stringify(config),{flag:'wx',mode:0o600});
  appendWorkspaceHistory(root,{kind:'proposal',digest,revision:1,date:new Date().toISOString().slice(0,10),config,reasons});
  return {status:'pending',digest,reasons};
}

function accept(root,args) {
  const by=args['--by']?.trim(),reason=args['--reason']?.trim(),expected=args['--digest'];
  if(!by || !reason || !/^[a-f0-9]{64}$/.test(expected ?? '')) {
    throw new Error('Acceptance requires --by, --reason, and --digest');
  }
  const file=configPath(root);
  const config=parseWorkspaceConfig(fs.readFileSync(file,'utf8'));
  const digest=workspaceConfigDigest(config);
  if(expected!==digest) throw new Error('Config digest differs from the reviewed proposal');
  const proposal=readWorkspaceHistory(root).at(-1);
  if(!proposal || proposal.kind!=='proposal') {
    throw new Error('A pending proposal is required before acceptance');
  }
  const record={
    kind:'acceptance',digest,revision:proposal.revision,
    date:new Date().toISOString().slice(0,10),by,reason,
    changes:changedFields(proposal.config,config),
  };
  appendWorkspaceHistory(root,record);
  return {status:'accepted',digest,revision:record.revision};
}

function status(root) {
  const {config}=resolveWorkspaceConfig({coordinationRoot:root});
  const record=assertAcceptedWorkspaceConfig(root,config);
  return {status:'accepted',digest:record.digest,revision:record.revision};
}

try {
  const [action,...rest]=process.argv.slice(2);
  const args=options(rest);
  const root=fs.realpathSync(args['--root'] ?? process.cwd());
  if(!['propose','accept','status'].includes(action)) {
    throw new Error('Usage: init-workspace.mjs propose|accept|status [options]');
  }
  if(action!=='accept' && ['--by','--reason','--digest'].some(key=>Object.hasOwn(args,key))) {
    throw new Error('Approval options are only valid with accept');
  }
  const result=action==='propose' ? propose(root) : action==='accept' ? accept(root,args) : status(root);
  console.log(JSON.stringify(result));
} catch(error) {
  console.error(`GATE BLOCKED: ${error.message}`);
  process.exitCode=1;
}
