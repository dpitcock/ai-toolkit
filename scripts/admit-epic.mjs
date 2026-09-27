#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {reserveEpicProvisioning} from './lib/workflow-admission.mjs';
import {observeEpicIntegration} from './lib/epic-integration.mjs';

export function runEpicAdmission(args=process.argv.slice(2),controller={}) {
 if(args.length!==3 || args[1]!=='--root') throw new Error('Usage: admit-epic.mjs EPIC-ID --root PATH');
 const result=reserveEpicProvisioning({root:path.resolve(args[2]),epic:args[0],observeIntegration:controller.integration??observeEpicIntegration});
 process.stdout.write(`${JSON.stringify(result)}\n`);
 return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {runEpicAdmission();} catch(error) {process.stderr.write(`${error.message}\n`);process.exitCode=1;}
}
