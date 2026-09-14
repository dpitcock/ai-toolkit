import {checkProject} from './check-gate.mjs';
try { checkProject('project/project-plan.md'); }
catch(e) { console.error(`GATE BLOCKED: ${e.message}`); process.exitCode=1; }
