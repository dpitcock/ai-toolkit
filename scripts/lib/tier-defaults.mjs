import {createHash} from 'node:crypto';
import fs from 'node:fs';
import YAML from 'yaml';

const ruleKeys=['pull_request','independent_final_review','isolation','direct_merge'];
const tiers=[1,2,3];
const defaultDefinitionPath=new URL('../../policy/task-tier-defaults.yaml',import.meta.url);

function fail(message) { throw new Error(`Tier defaults ${message}`); }

function mapping(value,label) {
  if(value===null || typeof value!=='object' || Array.isArray(value)) fail(`${label} must be a mapping`);
  return value;
}

function exactKeys(value,keys,label) {
  const data=mapping(value,label);
  for(const key of Object.keys(data)) {
    if(!keys.includes(key)) fail(`${label}.${key} is not allowed`);
  }
  for(const key of keys) {
    if(!Object.hasOwn(data,key)) fail(`${label}.${key} is required`);
  }
  return data;
}

function readDefinition(definitionPath) {
  const file=definitionPath ?? defaultDefinitionPath;
  if(typeof file!=='string' && !(file instanceof URL)) fail('definition path is invalid');
  let raw;
  try { raw=fs.readFileSync(file,'utf8'); }
  catch(error) { fail(`definition cannot be read: ${error.message}`); }
  const document=YAML.parseDocument(raw,{uniqueKeys:true});
  if(document.errors.length) fail(`definition is invalid YAML: ${document.errors.map(error=>error.message).join('; ')}`);
  let parsed;
  try { parsed=document.toJS({maxAliasCount:0}); }
  catch(error) { fail(`definition is invalid YAML: ${error.message}`); }
  const definition=exactKeys(parsed,['version','tiers'],'definition');
  if(!Number.isInteger(definition.version) || definition.version<1) fail('definition.version must be a positive integer');
  const definedTiers=exactKeys(definition.tiers,['1','2','3'],'definition.tiers');
  const normalized={version:definition.version,tiers:{}};
  for(const tier of tiers) {
    const rules=exactKeys(definedTiers[tier],ruleKeys,`definition.tiers.${tier}`);
    for(const key of ruleKeys) {
      if(typeof rules[key]!=='boolean') fail(`definition.tiers.${tier}.${key} must be boolean`);
    }
    normalized.tiers[tier]={};
    for(const key of ruleKeys) normalized.tiers[tier][key]=rules[key];
  }
  if(!normalized.tiers[2].pull_request || !normalized.tiers[3].pull_request) fail('Tier 2 and Tier 3 require pull requests');
  if(!normalized.tiers[3].isolation || !normalized.tiers[3].independent_final_review) {
    fail('Tier 3 requires isolation and independent final review');
  }
  return {
    rules:normalized.tiers,
    definition:{version:normalized.version,digest:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')},
  };
}

function validateInput(input) {
  const value=mapping(input,'input');
  for(const key of Object.keys(value)) {
    if(!['tier','overrides','templateRepository','definitionPath'].includes(key)) fail(`input.${key} is not allowed`);
  }
  for(const key of ['tier','overrides','templateRepository']) {
    if(!Object.hasOwn(value,key)) fail(`input.${key} is required`);
  }
  if(!tiers.includes(value.tier)) fail('tier must be 1, 2, or 3');
  if(typeof value.templateRepository!=='boolean') fail('templateRepository must be boolean');
  const overrides=mapping(value.overrides,'overrides');
  for(const key of Object.keys(overrides)) {
    if(key!=='direct_merge') fail(`override ${key} is not allowed`);
  }
  if(Object.hasOwn(overrides,'direct_merge') && typeof overrides.direct_merge!=='boolean') {
    fail('overrides.direct_merge must be boolean');
  }
  return value;
}

/**
 * Resolves a shared tier definition without mutating its policy source. The
 * result records whether every effective rule came from the definition, a
 * permitted caller override, or an immutable governance floor.
 */
export function resolveTierDefaults(input) {
  const {tier,overrides,templateRepository,definitionPath}=validateInput(input);
  const resolved=readDefinition(definitionPath);
  const rules=structuredClone(resolved.rules[tier]);
  const sources=Object.fromEntries(ruleKeys.map(key=>[key,'definition']));

  if(Object.hasOwn(overrides,'direct_merge')) {
    rules.direct_merge=overrides.direct_merge;
    sources.direct_merge='override';
  }
  if(rules.direct_merge && (templateRepository || tier>1)) {
    rules.direct_merge=false;
    sources.direct_merge='floor';
  }
  return {tier,rules,definition:resolved.definition,sources};
}
