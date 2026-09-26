import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {resolveTierDefaults} from '../scripts/lib/tier-defaults.mjs';

function resolve(input) {
  return resolveTierDefaults(input);
}

test('resolves every tier with its immutable governance floors',()=>{
  const tier1=resolve({tier:1,overrides:{},templateRepository:false});
  const tier2=resolve({tier:2,overrides:{},templateRepository:false});
  const tier3=resolve({tier:3,overrides:{},templateRepository:false});

  assert.deepEqual(tier1.rules,{
    pull_request:false,
    independent_final_review:false,
    isolation:false,
    direct_merge:false,
  });
  assert.deepEqual(tier2.rules,{
    pull_request:true,
    independent_final_review:true,
    isolation:false,
    direct_merge:false,
  });
  assert.deepEqual(tier3.rules,{
    pull_request:true,
    independent_final_review:true,
    isolation:true,
    direct_merge:false,
  });
  assert.equal(tier1.definition.version,1);
  assert.match(tier1.definition.digest,/^[a-f0-9]{64}$/);
  assert.deepEqual(tier3.sources,{
    pull_request:'definition',
    independent_final_review:'definition',
    isolation:'definition',
    direct_merge:'definition',
  });
});

test('allows only a true Tier 1 direct-merge override for eligible adopters',()=>{
  const resolved=resolve({tier:1,overrides:{direct_merge:true},templateRepository:false});

  assert.equal(resolved.rules.direct_merge,true);
  assert.equal(resolved.sources.direct_merge,'override');
});

test('keeps direct merge disabled for templates and higher-tier floors',()=>{
  for(const input of [
    {tier:1,overrides:{direct_merge:true},templateRepository:true},
    {tier:2,overrides:{direct_merge:true},templateRepository:false},
    {tier:3,overrides:{direct_merge:true},templateRepository:false},
  ]) {
    const resolved=resolve(input);
    assert.equal(resolved.rules.direct_merge,false);
    assert.equal(resolved.sources.direct_merge,'floor');
  }
});

test('applies an explicit false direct-merge override at every selected tier',()=>{
  for(const tier of [1,2,3]) {
    const resolved=resolve({tier,overrides:{direct_merge:false},templateRepository:false});
    assert.equal(resolved.rules.direct_merge,false);
    assert.equal(resolved.sources.direct_merge,'override');
  }
});

test('rejects unknown tiers, override keys, and non-boolean override values',()=>{
  assert.throws(()=>resolve({tier:4,overrides:{},templateRepository:false}),/tier/i);
  assert.throws(()=>resolve({tier:1,overrides:{reviewers:true},templateRepository:false}),/override.*allowed/i);
  assert.throws(()=>resolve({tier:1,overrides:{direct_merge:'true'},templateRepository:false}),/direct_merge.*boolean/i);
  assert.throws(()=>resolve({tier:1,overrides:null,templateRepository:false}),/overrides.*mapping/i);
  assert.throws(()=>resolve({tier:1,overrides:{},templateRepository:'false'}),/templateRepository.*boolean/i);
});

test('changes definition provenance when the reviewed policy definition changes',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'tier-defaults-'));
  const definitionPath=path.join(directory,'task-tier-defaults.yaml');
  const original=readFileSync(path.resolve('policy/task-tier-defaults.yaml'),'utf8');
  writeFileSync(definitionPath,original);
  const first=resolveTierDefaults({tier:1,overrides:{},templateRepository:false,definitionPath});
  writeFileSync(definitionPath,original.replace('version: 1','version: 2'));
  const changed=resolveTierDefaults({tier:1,overrides:{},templateRepository:false,definitionPath});

  assert.equal(first.definition.version,1);
  assert.equal(changed.definition.version,2);
  assert.notEqual(first.definition.digest,changed.definition.digest);
});
