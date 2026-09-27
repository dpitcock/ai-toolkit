#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {localReviewRoute} from './lib/local-review-route.mjs';

export function runReviewRoute(args=process.argv.slice(2)) {
  const options={};
  const names={'--root':'root','--base':'baseRef','--head':'headRef','--pr':'prNumber'};
  for(let index=0;index<args.length;index+=2) {
    const name=args[index];
    if(name==='--files') {options.files=args.slice(index+1);break;}
    if(!Object.hasOwn(names,name) || !args[index+1] || args[index+1].startsWith('--') || Object.hasOwn(options,names[name])) throw new Error('Usage: review-route.mjs --base REF [--root PATH] [--pr NUMBER] [--head REF | --files PATH ...]');
    options[names[name]]=name==='--pr'?Number(args[index+1]):args[index+1];
  }
  if(!options.baseRef || (options.files && options.headRef)) throw new Error('Supply --base and either --head or --files');
  const result=localReviewRoute(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {runReviewRoute();} catch(error) {process.stderr.write(`${error.message}\n`);process.exitCode=1;}
}
