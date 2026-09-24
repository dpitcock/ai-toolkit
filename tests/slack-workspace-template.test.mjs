import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const source=path.resolve(import.meta.dirname,'..');
const descriptor=path.join(source,'config','slack-workspace.example.yml');

test('workspace descriptor enables the Codex workspace without mutable Slack state',()=>{
 const value=YAML.parse(fs.readFileSync(descriptor,'utf8'));
 assert.deepEqual(value.workspace,{
  repository:'example-repository', environment:'production', provider:'codex',
  channel_name:'ws-example-repository-codex', timezone:'America/New_York'
 });
 assert.deepEqual(value.daily_summary,{local_time:'09:00'});
 assert.equal(Object.hasOwn(value.workspace,'channel_id'),false);
 assert.equal(Object.hasOwn(value.workspace,'session_id'),false);
 assert.equal(Object.hasOwn(value.workspace,'credential'),false);
});
