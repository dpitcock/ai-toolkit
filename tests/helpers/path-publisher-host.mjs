import fs from 'node:fs';

export function respond(stateFile,route,{args}) {
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const callsFile=`${stateFile}.calls`;
  const calls=fs.existsSync(callsFile)?JSON.parse(fs.readFileSync(callsFile,'utf8')):[];
  calls.push(args);fs.writeFileSync(callsFile,JSON.stringify(calls));
  const prefix='repos/dpitcock/ai-toolkit';
  let result;
  if(args.includes('POST')) result={};
  else if(route===`${prefix}/pulls/${state.pr}`) {
    const count=calls.filter(call=>call.at(-1)===route).length;
    result={number:state.pr,state:'open',head:{sha:state.headRace && count>1?'e'.repeat(40):state.head},
      base:{ref:'main',sha:state.baseRace && count>1?'f'.repeat(40):state.base,repo:{full_name:'dpitcock/ai-toolkit'}},
      changed_files:state.changedFiles,user:{login:'developer',type:'User'}};
  } else if(route===prefix) result={default_branch:'main'};
  else if(route===`${prefix}/contents/policy/review-paths.json?ref=${state.base}`) {
    result={type:'file',path:'policy/review-paths.json',encoding:'base64',content:Buffer.from(state.policy).toString('base64')};
  } else if(route===`${prefix}/pulls/${state.pr}/files?per_page=100`) result=state.files;
  else if(route===`${prefix}/pulls/${state.pr}/reviews?per_page=100`) result=[state.reviews];
  else if(route===`${prefix}/commits/${state.head}/check-runs?per_page=100`) result=[{check_runs:[
    {id:1,name:'gates',head_sha:state.head,app:{id:15368,slug:'github-actions'},status:'completed',conclusion:'success',check_suite:{id:42}},
  ]}];
  else if(route===`${prefix}/actions/runs?check_suite_id=42&per_page=100`) result=[{workflow_runs:[
    {id:1,check_suite_id:42,path:'.github/workflows/workflow.yml',head_sha:state.head,event:'pull_request',status:'completed',conclusion:'success',repository:{full_name:'dpitcock/ai-toolkit'}},
  ]}];
  else if(new RegExp(`^${prefix}/contents/\\.github/workflows/(workflow|review-gates)\\.yml\\?ref=(main|[a-f0-9]{40})$`).test(route)) result={sha:'trusted-workflow'};
  else throw new Error(`Unexpected endpoint ${route}`);
  return JSON.stringify(result);
}
