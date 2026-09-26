#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createTaskAssessment,formatTaskAssessment} from './lib/task-assessment.mjs';

const MAX_INPUT_BYTES=64*1024;

function parseArguments(args) {
  const options={};
  const names=new Map([
    ['--id','id'],['--coordination-root','coordinationRoot'],['--worktree-root','worktreeRoot'],
  ]);
  for(let index=0;index<args.length;index+=1) {
    const flag=args[index],name=names.get(flag),value=args[index+1];
    if(!name) throw new Error(`Unknown argument: ${flag}`);
    if(Object.hasOwn(options,name)) throw new Error(`Duplicate argument: ${flag}`);
    if(!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[name]=name==='id'?value:path.resolve(value);
    index+=1;
  }
  for(const name of ['id','coordinationRoot','worktreeRoot']) if(!Object.hasOwn(options,name)) throw new Error(`Missing required option --${name.replace(/[A-Z]/g,char=>`-${char.toLowerCase()}`)}`);
  return options;
}

async function readInput() {
  const chunks=[];
  let size=0;
  for await(const chunk of process.stdin) {
    size+=chunk.length;
    if(size>MAX_INPUT_BYTES) throw new Error(`Assessment JSON exceeds ${MAX_INPUT_BYTES} bytes`);
    chunks.push(chunk);
  }
  if(!size) throw new Error('Provide one assessment JSON object on stdin');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch(error) { throw new Error(`Invalid assessment JSON: ${error.message}`); }
}

export async function runPreflight(args=process.argv.slice(2)) {
  const options=parseArguments(args);
  const answers=await readInput();
  const result=createTaskAssessment({...options,answers});
  process.stdout.write(`${formatTaskAssessment(result)}\n`);
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  runPreflight().catch(error=>{
    process.stderr.write(`preflight: ${error.message}\n`);
    process.exitCode=1;
  });
}
