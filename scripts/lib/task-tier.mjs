const RISK_KEYS = ['auth', 'secrets', 'schema', 'publicApi', 'financial', 'userData', 'criticalInfrastructure', 'hardToRevert'];
const INPUT_KEYS = new Set(['stage', 'developer', 'scope', 'risks', 'userFacingUI', 'claimedTier', 'intendedFiles', 'actualFiles', 'accessibilityEvidence', 'reviewedCommit']);
const CODE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cs', '.go', '.java', '.js', '.jsx', '.kt', '.mjs', '.php', '.py', '.rb', '.rs', '.sh', '.swift', '.ts', '.tsx']);
const SENSITIVE_PATHS = [
  ['auth', /(?:^|[\/._-])(?:auth|authentication|authorization|permissions?)(?:[\/._-]|$)/i],
  ['secrets', /(?:^|[\/._-])(?:secrets?|credentials?|private-keys?)(?:[\/._-]|$)/i],
  ['schema', /(?:^|[\/._-])(?:schemas?|migrations?)(?:[\/._-]|$)/i],
  ['public-api', /(?:^|[\/._-])(?:api|openapi|graphql)(?:[\/._-]|$)/i],
  ['financial', /(?:^|[\/._-])(?:billing|payments?|finance|financial|transactions?|invoices?|ledger)(?:[\/._-]|$)/i],
  ['user-data', /(?:^|[\/._-])(?:users?|customers?|profiles?|pii|personal-data|user-data)(?:[\/._-]|$)/i],
  ['infrastructure', /(?:^|[\/._-])(?:infra|infrastructure|terraform|k8s|kubernetes|workflows?|deployments?|docker)(?:[\/._-]|$)/i]
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validRepoPath(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)) return false;
  return !value.split('/').some(part => !part || part === '.' || part === '..');
}

function validFileList(files) {
  return Array.isArray(files) && files.length > 0 && files.every(validRepoPath) && new Set(files).size === files.length;
}

function sensitivePathReason(file) {
  return SENSITIVE_PATHS.find(([, pattern]) => pattern.test(file))?.[0] ?? null;
}

function sameIdentity(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function validReviewRecord(record, requiresCommit = false) {
  if (!isObject(record)) return false;
  const keys = requiresCommit ? ['by', 'date', 'notes', 'revision', 'commit'] : ['by', 'date', 'notes', 'revision'];
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(record, key))) return false;
  if (typeof record.by !== 'string' || !record.by.trim() || typeof record.notes !== 'string' || !record.notes.trim()) return false;
  if (!Number.isInteger(record.revision) || record.revision < 1) return false;
  return typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    && !Number.isNaN(Date.parse(record.date)) && new Date(record.date).toISOString().slice(0, 10) === record.date
    && (!requiresCommit || (typeof record.commit === 'string' && /^[a-f0-9]{40}$/i.test(record.commit)));
}

function hasAccessibilityEvidence(input) {
  const evidence = input.accessibilityEvidence;
  if (!isObject(evidence) || Object.keys(evidence).some(key => !['triage', 'plan', 'finalReview'].includes(key))) return false;
  if (!Object.hasOwn(evidence, 'triage') || !Object.hasOwn(evidence, 'plan')) return false;
  if (!validReviewRecord(evidence.triage) || !validReviewRecord(evidence.plan)) return false;
  if (sameIdentity(evidence.triage.by, input.developer) || sameIdentity(evidence.plan.by, input.developer)) return false;
  if (input.stage === 'preflight') {
    return evidence.finalReview == null || (validReviewRecord(evidence.finalReview, true) && !sameIdentity(evidence.finalReview.by, input.developer));
  }
  return typeof input.reviewedCommit === 'string' && /^[a-f0-9]{40}$/i.test(input.reviewedCommit)
    && validReviewRecord(evidence.finalReview, true)
    && !sameIdentity(evidence.finalReview.by, input.developer)
    && evidence.finalReview.commit.toLowerCase() === input.reviewedCommit.toLowerCase();
}

export function classifyTask(input) {
  const reasons = new Set();
  let tier = 1;
  const escalate = (level, reason) => {
    tier = Math.max(tier, level);
    reasons.add(reason);
  };

  if (!isObject(input)) return {tier: 3, reasons: ['malformed-input']};
  if (Object.keys(input).some(key => !INPUT_KEYS.has(key))) escalate(3, 'unknown-input-field');
  for (const key of ['stage', 'developer', 'scope', 'risks', 'userFacingUI', 'claimedTier', 'intendedFiles']) {
    if (!Object.hasOwn(input, key)) escalate(3, `missing-${key}`);
  }
  if (!['preflight', 'final'].includes(input.stage)) escalate(3, 'invalid-stage');
  if (typeof input.developer !== 'string' || !input.developer.trim()) escalate(3, 'invalid-developer');
  if (![1, 2, 3, null].includes(input.claimedTier)) escalate(3, 'invalid-claimed-tier');

  if (!isObject(input.risks) || Object.keys(input.risks).length !== RISK_KEYS.length || RISK_KEYS.some(key => !Object.hasOwn(input.risks, key))) {
    escalate(3, 'incomplete-risk-answers');
  } else {
    for (const key of RISK_KEYS) {
      if (input.risks[key] === true) escalate(3, `high-risk-${key}`);
      else if (input.risks[key] !== false) escalate(3, `unknown-risk-${key}`);
    }
  }

  if (input.userFacingUI === true) escalate(2, 'user-facing-ui');
  else if (input.userFacingUI !== false) escalate(3, 'unknown-ui-scope');
  if (input.scope === 'one-subsystem') escalate(2, 'one-subsystem-scope');
  else if (input.scope !== 'single-file') escalate(3, 'unknown-or-cross-cutting-scope');

  const intended = validFileList(input.intendedFiles);
  const actualProvided = Object.hasOwn(input, 'actualFiles');
  const actual = actualProvided ? validFileList(input.actualFiles) : input.stage === 'preflight' ? intended : false;
  if (!intended) escalate(3, 'invalid-intended-files');
  if (actualProvided && !actual) escalate(3, 'invalid-actual-files');
  if (input.stage === 'final' && !actualProvided) escalate(3, 'missing-actual-files');
  const files = actualProvided ? input.actualFiles : input.intendedFiles;
  if (Array.isArray(files) && Array.isArray(input.intendedFiles) && files.some(file => !input.intendedFiles.includes(file))) {
    escalate(3, 'actual-scope-expanded');
  }
  if (input.scope === 'single-file' && (input.intendedFiles?.length !== 1 || files?.length !== 1 || !CODE_EXTENSIONS.has(files?.[0]?.slice(files[0].lastIndexOf('.')).toLowerCase()))) {
    escalate(3, 'not-one-code-file');
  }
  if (input.scope === 'one-subsystem' && (input.intendedFiles?.length > 5 || files?.length > 5)) escalate(3, 'subsystem-file-limit');
  for (const file of [...(Array.isArray(input.intendedFiles) ? input.intendedFiles : []), ...(Array.isArray(files) ? files : [])]) {
    const sensitive = validRepoPath(file) ? sensitivePathReason(file) : null;
    if (sensitive) escalate(3, `sensitive-path-${sensitive}`);
  }
  if (input.userFacingUI === true && !hasAccessibilityEvidence(input)) escalate(3, 'incomplete-accessibility-evidence');

  if ([1, 2, 3].includes(input.claimedTier) && input.claimedTier > tier) {
    tier = input.claimedTier;
    reasons.add(`claimed-tier-${input.claimedTier}`);
  }

  return {tier, reasons: [...reasons]};
}
