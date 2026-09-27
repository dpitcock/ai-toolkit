import fs from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {isDeepStrictEqual} from 'node:util';

// Explicitly installed only by tests. Production keeps its actual gh reader,
// JSON parsing, bounds and error handling; no PATH shim or global NODE_OPTIONS.
export function installControlledHost({respond,profile='observation'}) {
 if(!['observation','publisher'].includes(profile)) throw new Error('unknown controlled host profile');
 const original=childProcess.execFileSync;
 childProcess.execFileSync=function(command,args,options) {
  if(command!=='gh') return original.call(this,command,args,options);
  const paginate=Array.isArray(args) && args.length===4 && args[1]==='--paginate' && args[2]==='--slurp';
  const post=profile==='publisher' && Array.isArray(args) && args.length===10
   && /^repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/statuses\/[a-f0-9]{40}$/.test(args[1])
   && args[2]==='--method' && args[3]==='POST' && [4,6,8].every(index=>args[index]==='-f')
   && /^state=(pending|success|failure)$/.test(args[5]) && args[7]==='context=host-review-gate'
   && ['Current-head host review gate','Integrated publisher verification (diagnostic)'].some(label=>args[9]===`description=${label}: ${args[5].slice(6)}`);
  const endpoint=Array.isArray(args)?(post?args[1]:args.at(-1)):undefined;
  if(!Array.isArray(args) || args[0]!=='api' || !(args.length===2 || paginate || post)
   || typeof endpoint!=='string' || !/^repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s]+)?$/.test(endpoint)) {
   throw new Error('controlled host rejected gh argv');
  }
  const expected={encoding:'utf8',stdio:['ignore','pipe','pipe'],...(profile==='observation'?{timeout:30000,maxBuffer:8*1024*1024}:{})};
  if(!isDeepStrictEqual(options,expected)) {
   throw new Error('controlled host rejected gh options');
  }
  const result=respond(endpoint,{paginate,args});
  if(typeof result!=='string' || Buffer.byteLength(result)>(options.maxBuffer??1024*1024)) throw new Error('controlled host invalid or oversized response');
  return result;
 };
 syncBuiltinESMExports();
 return ()=>{childProcess.execFileSync=original;syncBuiltinESMExports();};
}

export function responseMap(stateFile,endpoint) {
 const responses=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 if(!Object.hasOwn(responses,endpoint)) throw new Error('unknown controlled endpoint '+endpoint);
 return JSON.stringify(responses[endpoint]);
}

export function controlledHostArgs({stateFile,responderURL,profile='observation'}={}) {
 const code=`import {installControlledHost,responseMap} from ${JSON.stringify(import.meta.url)};
 ${responderURL?`import {respond} from ${JSON.stringify(String(responderURL))};`:''}
 installControlledHost({profile:${JSON.stringify(profile)},respond:(endpoint,options)=>${responderURL?'respond':'responseMap'}(${JSON.stringify(stateFile)},endpoint,options)});`;
 return ['--import',`data:text/javascript,${encodeURIComponent(code)}`];
}

// A local Git fixture may materialize an unadvertised historical commit. Only
// that exact canonical fetch is redirected; all Git operations remain real.
export function withFixtureFetch({root,canonicalURL,fixtureURL,revision},run) {
 const original=childProcess.execFileSync;
 const expected=['--no-replace-objects','-C',root,'fetch','--no-tags','--no-recurse-submodules','--no-write-fetch-head',canonicalURL,revision];
 childProcess.execFileSync=function(command,args,options) {
  if(command==='git' && Array.isArray(args) && args.includes('fetch')) {
   if(!isDeepStrictEqual(args,expected)) throw new Error('controlled fixture rejected unexpected fetch');
   args=[...args.slice(0,7),fixtureURL,revision];
  }
  return original.call(this,command,args,options);
 };
 syncBuiltinESMExports();
 try {return run();} finally {childProcess.execFileSync=original;syncBuiltinESMExports();}
}
