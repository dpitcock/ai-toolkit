import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'.npm-cache');
const devdir=path.join(root,'.node-gyp');
const env={...process.env,npm_config_cache:cache,npm_config_devdir:devdir,npm_package_config_node_gyp_devdir:devdir};
const run=(args)=>execFileSync('npm',args,{cwd:root,env,stdio:'inherit'});

run(['ci','--ignore-scripts']);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'node_modules','fs-ext','package.json'),'utf8'));
if(manifest.version!=='2.1.1'||manifest.scripts?.install!=='node-gyp configure build'){
 throw new Error('Refusing unreviewed fs-ext lifecycle hook');
}
run(['rebuild','fs-ext','--ignore-scripts=false']);
