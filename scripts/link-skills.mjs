import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
function link(source,dest) {
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(fs.existsSync(dest) || fs.lstatSync(dest,{throwIfNoEntry:false})) {
   if(fs.lstatSync(dest).isSymbolicLink() && fs.realpathSync(dest)===fs.realpathSync(source)) return;
   throw new Error(`Refusing to overwrite ${dest}`);
 }
 fs.symlinkSync(path.relative(path.dirname(dest),source),dest,'dir');
}
for(const harness of ['.agents','.claude','.cline']) {
 for(const name of ['appsec-gate','governed-plan','governed-build','governed-ship']) link(path.join(root,'skills',name),path.join(root,harness,'skills',name));
}
// Cline has no native Superpowers plugin: preserve sibling references through symlinks.
const source=path.join(root,'skills/upstream/superpowers/skills');
for(const name of fs.readdirSync(source)) if(fs.existsSync(path.join(source,name,'SKILL.md'))) link(path.join(source,name),path.join(root,'.cline/skills',name));

// The skills CLI currently calls Cline universal; also expose its supported .cline location.
for(const name of fs.readdirSync(path.join(root,'.agents/skills'))) {
 const src=path.join(root,'.agents/skills',name);
 if(fs.existsSync(path.join(src,'SKILL.md'))) link(src,path.join(root,'.cline/skills',name));
}
