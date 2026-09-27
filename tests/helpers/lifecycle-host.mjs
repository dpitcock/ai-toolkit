import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Read on every call: race counters and subsequent fixture mutations must be
// visible inside the same real CLI process, just as with the former gh shim.
export function respond(stateFile,endpoint) {
 const h=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 const git=args=>execFileSync('git',['-C',h.root,...args],{encoding:'utf8'}).trim();
 if(!endpoint.startsWith('repos/example/repo/')) throw new Error('Unexpected gh endpoint '+endpoint);
 let value;
 const pull={number:7,state:h.mergedState?'closed':'open',merged:h.mergedState,merge_commit_sha:h.merged,head:{sha:h.submitted,ref:'epic/EPIC-999',repo:{full_name:'example/repo'}},base:{ref:'main',repo:{full_name:h.repository??'example/repo'}}};
 if(endpoint==='repos/example/repo/pulls/7') value=pull;
 else if(endpoint==='repos/example/repo/pulls/8') value={...pull,number:8,state:h.publication.state,merged:h.publication.state==='closed',merge_commit_sha:h.publication.state==='closed'?h.main:null,head:{...pull.head,sha:h.publication.head,ref:h.publication.branch??pull.head.ref,repo:{full_name:h.publication.repository??'example/repo'}}};
 else if(endpoint==='repos/example/repo/actions/variables/GOVERNANCE_REVIEW_IDENTITIES') value={value:JSON.stringify(Object.fromEntries(['code_reviewer','appsec'].map(role=>[role,{actor:role,kind:'human',roleEvidence:true,provenance:{source:'owner-managed',id:role}}])))};
 else if(/^repos\/example\/repo\/pulls\/[78]\/reviews\?per_page=100$/.test(endpoint)) value=[h.reviews?['code_reviewer','appsec'].map((role,i)=>({id:i+1,user:{login:role,type:'User'},state:h.reviewState??'APPROVED',commit_id:h.reviewHead??(endpoint.includes('/pulls/8/')?h.publication.head:h.submitted),submitted_at:'2026-09-26T12:00:00Z'})):[]];
 else if(/^repos\/example\/repo\/commits\/[a-f0-9]{40}\/check-runs\?per_page=100$/.test(endpoint)) {const sha=endpoint.split('/commits/')[1].split('/')[0];const suite=sha===h.submitted?1:sha===h.merged?2:3;value=[{check_runs:[{id:suite,name:'gates',head_sha:sha,status:h.checkStatus??'completed',conclusion:h.checks?'success':'failure',app:{id:15368,slug:'github-actions'},check_suite:{id:suite}}]}];}
 else if(/^repos\/example\/repo\/actions\/runs\?check_suite_id=[123]&per_page=100$/.test(endpoint)) {const suite=Number(new URL('https://example/'+endpoint).searchParams.get('check_suite_id'));value=[{workflow_runs:[{check_suite_id:suite,path:'.github/workflows/workflow.yml',repository:{full_name:'example/repo'},event:'push',status:'completed',conclusion:'success',head_sha:suite===1?h.submitted:suite===2?h.merged:h.publication?.head??h.main}]}];}
 else if(endpoint==='repos/example/repo/git/ref/heads/main') {h.mainReads=(h.mainReads??0)+1;fs.writeFileSync(stateFile,JSON.stringify(h));value={object:{sha:h.race&&h.mainReads>1?h.submitted:h.main}};}
 else if(/^repos\/example\/repo\/git\/trees\/[a-f0-9]{40}\?recursive=1$/.test(endpoint)) {const sha=endpoint.split('/git/trees/')[1].split('?')[0];const entries=git(['ls-tree','-r',sha]).split('\n').filter(Boolean).map(line=>{const [info,...names]=line.split('\t');const [mode,type,sha]=info.split(' ');return {mode,type,sha,path:names.join('\t')};});value={truncated:false,tree:entries};}
 else if(/^repos\/example\/repo\/contents\/[^?]+\?ref=[a-f0-9]{40}$/.test(endpoint)) {const [file,ref]=endpoint.split('/contents/')[1].split('?ref=');value={encoding:'base64',content:Buffer.from(git(['show',ref+':'+decodeURIComponent(file)])+'\n').toString('base64')};}
 else if(/^repos\/example\/repo\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}$/.test(endpoint)) {const [base,head]=endpoint.split('/compare/')[1].split('...');let ancestor=true;try{git(['merge-base','--is-ancestor',base,head]);}catch{ancestor=false;}value={status:base===head?'identical':ancestor?'ahead':'diverged',base_commit:{sha:base},merge_base_commit:{sha:git(['merge-base',base,head])}};}
 else if(/^repos\/example\/repo\/commits\/[a-f0-9]{40}\/pulls\?per_page=100$/.test(endpoint)) value=[h.publication?.state==='closed'?[{number:8}]:[]];
 else if(endpoint==='repos/example/repo/pulls?state=open&base=main&per_page=100') value=[[]];
 else throw new Error('Unexpected gh endpoint '+endpoint);
 return JSON.stringify(value);
}
