import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';

const source=path.resolve(import.meta.dirname,'..');

test('generated workspace config supplies Slack routing without a template descriptor',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-config-slack-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const item of ['scripts','config']) fs.cpSync(path.join(source,item),path.join(root,item),{recursive:true});
  fs.mkdirSync(path.join(root,'project'));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'example-repository'}));
  fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  const legacy=path.join(root,'config/slack-workspace.example.yml');
  assert.equal(fs.existsSync(legacy),false);
  const cli=path.join(root,'scripts/init-workspace.mjs');
  const run=(...args)=>execFileSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const proposal=JSON.parse(run('propose'));
  const config=YAML.parse(fs.readFileSync(path.join(root,'config/workspace-config.yaml'),'utf8'));
  assert.equal(config.workspace.slack_channel_name,'ws-example-repository-codex');
  assert.equal(config.daily_summary.local_time,'09:00');
  assert.equal(Object.hasOwn(config.workspace,'channel_id'),false);
  assert.equal(Object.hasOwn(config.workspace,'session_id'),false);
  assert.equal(Object.hasOwn(config.workspace,'credential'),false);
  assert.throws(()=>run('status'));
  assert.equal(JSON.parse(run('accept','--by','Dennis','--reason','Reviewed workspace policy','--digest',proposal.digest)).status,'accepted');
});
