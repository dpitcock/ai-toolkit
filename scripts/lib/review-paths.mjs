// This repository's authoring exception must never become an adopter default.
export const TOOLKIT_REPOSITORY='dpitcock/ai-toolkit';
export const REVIEW_POLICY_PATH='policy/review-paths.json';
export const FINAL_REVIEW_ORDER=['code_reviewer','principal','qa','appsec','accessibility_reviewer','ui_designer'];
const FILE_STATUSES=new Set(['added','removed','modified','renamed','copied','changed','unchanged']);

function fail(message) { throw new Error(`Review path policy: ${message}`); }
function object(value) { return value!==null && typeof value==='object' && !Array.isArray(value); }
function validPath(value) {
  return typeof value==='string' && value.length>0 && !/[\u0000-\u001f\u007f\\]/.test(value)
    && !value.startsWith('/') && !/^[A-Za-z]:/.test(value)
    && !value.split('/').some(part=>!part || part==='.' || part==='..');
}
function paths(value,label) {
  if(!Array.isArray(value) || !value.length || value.some(file=>!validPath(file)) || new Set(value).size!==value.length) fail(`${label} must contain unique repository-relative paths`);
  return value;
}
function roles(value) {
  if(!Array.isArray(value) || value.some(role=>!FINAL_REVIEW_ORDER.includes(role)) || new Set(value).size!==value.length) fail('configured roles are invalid');
  return value;
}

export function parseReviewPathPolicy(raw) {
  let value;
  try { value=JSON.parse(raw); } catch { fail('invalid JSON'); }
  const keys=['version','repository','grandfatheredThroughPr','productionDirectories','productionFiles'];
  if(!object(value) || Object.keys(value).length!==keys.length || keys.some(key=>!Object.hasOwn(value,key))
    || value.version!==1 || value.repository!==TOOLKIT_REPOSITORY
    || !Number.isSafeInteger(value.grandfatheredThroughPr) || value.grandfatheredThroughPr<0) fail('invalid manifest');
  paths(value.productionFiles,'production files');
  if(!Array.isArray(value.productionDirectories) || value.productionDirectories.some(dir=>typeof dir!=='string' || !dir.endsWith('/'))) fail('invalid production directories');
  paths(value.productionDirectories.map(dir=>dir.slice(0,-1)),'production directories');
  return value;
}

export function classifyReviewPaths(policy,files,configuredRoles=[]) {
  const definition=parseReviewPathPolicy(JSON.stringify(policy));
  paths(files,'changed files');
  roles(configuredRoles);
  const productionPaths=files.filter(file=>definition.productionFiles.includes(file)
    || definition.productionDirectories.some(dir=>file===dir.slice(0,-1) || file.startsWith(dir))
    || (!file.startsWith('tests/') && /(?:^|\/)action\.ya?ml$/.test(file)));
  const production=productionPaths.length>0;
  const required=new Set(production?['code_reviewer','qa','appsec',...configuredRoles]:['code_reviewer']);
  return {route:production?'production':'authoring',targetEnvironment:production?'production':'dev',
    requiredRoles:FINAL_REVIEW_ORDER.filter(role=>required.has(role)),productionPaths};
}

// The caller obtains complete paginated host data at a fixed PR head. A rename
// out of the production boundary still changes the old production path.
export function reviewRouteForPull({policy,repository,pr,files,changedFiles,configuredRoles}={}) {
  const configured=roles(configuredRoles);
  if(!Number.isSafeInteger(pr) || pr<1) fail('invalid PR number');
  if(repository!==TOOLKIT_REPOSITORY) return legacy(configured);
  const definition=parseReviewPathPolicy(JSON.stringify(policy));
  if(pr<=definition.grandfatheredThroughPr) return legacy(configured);
  if(!Number.isSafeInteger(changedFiles) || changedFiles<1 || !Array.isArray(files) || files.length!==changedFiles) fail('incomplete changed-file evidence');
  const current=new Set(),changed=new Set();
  for(const file of files) {
    if(!object(file) || !validPath(file.filename) || !FILE_STATUSES.has(file.status) || current.has(file.filename)) fail('invalid or duplicate changed-file evidence');
    current.add(file.filename);
    changed.add(file.filename);
    if(file.status==='renamed' && !validPath(file.previous_filename)) fail('rename source path is required');
    if(file.previous_filename!==undefined) {
      if(!validPath(file.previous_filename)) fail('invalid previous path');
      changed.add(file.previous_filename);
    }
  }
  return classifyReviewPaths(definition,[...changed],configured);
}

function legacy(configuredRoles) {
  if(!configuredRoles.includes('code_reviewer') || !configuredRoles.includes('appsec')) fail('legacy final code reviewer and AppSec are mandatory');
  return {route:'legacy',requiredRoles:configuredRoles};
}
