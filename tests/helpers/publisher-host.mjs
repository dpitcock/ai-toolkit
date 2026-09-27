import fs from 'node:fs';
import path from 'node:path';

export function respond(stateFile,route,{args}) {
 const root=path.dirname(stateFile),f=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 if(!process.env.GH_TOKEN&&!f.keychain) throw new Error('controlled host unauthenticated');
 fs.appendFileSync(path.join(root,'calls'),JSON.stringify(args)+'\n');
 const count=name=>{
  const file=path.join(root,name),n=Number(fs.existsSync(file)?fs.readFileSync(file):0)+1;
  fs.writeFileSync(file,String(n));return n;
 };
 let out;
 if(args.includes('POST')) {
  if(route!==`repos/owner/repo/statuses/${f.head}`) throw new Error('Unexpected gh endpoint '+route);
  out={};
 }
 else if(/^repos\/owner\/repo\/contents\/\.github\/workflows\/(workflow|review-gates)\.yml\?ref=(main|[a-f0-9]{40})$/.test(route)) out={sha:f.changedWorkflow&&route.includes(f.head)?'different':'trusted'};
 else if(/^repos\/owner\/repo\/commits\/[a-f0-9]{40}\/check-runs\?per_page=100$/.test(route)) out=[{check_runs:f.checks}];
 else if(/^repos\/owner\/repo\/actions\/runs\?check_suite_id=4[12]&per_page=100$/.test(route)) out=[{workflow_runs:[{id:9,check_suite_id:route.includes('check_suite_id=41')?41:42,path:f.wrongRun?'.github/workflows/evil.yml':'.github/workflows/workflow.yml',head_sha:f.head,event:'pull_request',status:'completed',conclusion:route.includes('check_suite_id=41')?'failure':'success',repository:{full_name:'owner/repo'}}]}];
 else if(route==='repos/owner/repo/pulls/1/reviews?per_page=100') out=[f.reviews];
 else if(route==='repos/owner/repo/pulls?state=open&base=main&per_page=100') out=[[{number:1}]];
 else if(route==='repos/owner/repo/commits/main') {const n=count('main-count');out={sha:f.mainRace&&n>(Number.isInteger(f.mainRace)?f.mainRace:1)?'e'.repeat(40):f.mainSha};}
 else if(/^repos\/owner\/repo\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}$/.test(route)) out={status:f.comparison,base_commit:{sha:f.mergeSha},merge_base_commit:{sha:f.mergeSha}};
 else if(route==='repos/owner/repo/pulls/1') {
  const n=count('count');
  out={number:1,state:f.closed?'closed':'open',merged:f.merged,merge_commit_sha:f.mergeRace&&n>2?'f'.repeat(40):f.mergeSha,head:{sha:f.race&&n>2?f.changedHead:f.head},base:{ref:f.base,repo:{full_name:f.baseRepository}}};
 } else if(route==='repos/owner/repo') out={default_branch:'main'};
 else throw new Error('Unexpected gh endpoint '+route);
 return JSON.stringify(out);
}
