import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTask} from '../scripts/lib/task-tier.mjs';

const noRisks = {
  auth: false,
  secrets: false,
  schema: false,
  publicApi: false,
  financial: false,
  userData: false,
  criticalInfrastructure: false,
  hardToRevert: false
};

function assessment(overrides = {}) {
  return {
    stage: 'preflight',
    developer: 'implementer-session',
    scope: 'single-file',
    risks: {...noRisks},
    userFacingUI: false,
    claimedTier: 1,
    intendedFiles: ['src/notify.js'],
    ...overrides
  };
}

function accessibilityEvidence(commit = 'a'.repeat(40)) {
  return {
    triage: {by: 'accessibility-reviewer', date: '2026-09-25', notes: 'UI scope is bounded.', revision: 2},
    plan: {by: 'accessibility-reviewer', date: '2026-09-25', notes: 'Keyboard and semantics checks are planned.', revision: 2},
    finalReview: {by: 'accessibility-reviewer', date: '2026-09-25', notes: 'Reviewed the final UI diff.', revision: 2, commit}
  };
}

test('classifies an explicitly low-risk single code file as Tier 1', () => {
  const result = classifyTask(assessment());

  assert.equal(result.tier, 1);
  assert.deepEqual(result.reasons, []);
});

test('classifies a bounded subsystem as Tier 2 without lowering a Tier 2 claim', () => {
  const result = classifyTask(assessment({
    scope: 'one-subsystem',
    claimedTier: 2,
    intendedFiles: ['src/notify.js', 'src/format.js', 'tests/notify.test.js']
  }));

  assert.equal(result.tier, 2);
});

test('routes every explicitly high-risk boundary to Tier 3', () => {
  for (const risk of Object.keys(noRisks)) {
    const result = classifyTask(assessment({risks: {...noRisks, [risk]: true}}));
    assert.equal(result.tier, 3, `${risk}=true must escalate`);
  }
});

test('routes missing or unknown safety answers to Tier 3 instead of assuming false', () => {
  const missingStage = assessment();
  delete missingStage.stage;
  const missingDeveloper = assessment();
  delete missingDeveloper.developer;
  const missingUiAnswer = assessment();
  delete missingUiAnswer.userFacingUI;
  const missingRisk = assessment({risks: {...noRisks, auth: null}});
  const missingRiskKey = assessment();
  delete missingRiskKey.risks.secrets;
  const malformedPaths = assessment({intendedFiles: ['../outside.js']});
  const controlCharacterPath = assessment({intendedFiles: ['src/notify\u0000.js']});

  for (const input of [
    missingStage,
    missingDeveloper,
    missingUiAnswer,
    missingRisk,
    missingRiskKey,
    malformedPaths,
    controlCharacterPath,
    assessment({scope: 'unknown'})
  ]) {
    assert.equal(classifyTask(input).tier, 3);
  }
});

test('a lower claimed tier cannot reduce the computed tier', () => {
  const result = classifyTask(assessment({
    scope: 'one-subsystem',
    claimedTier: 1,
    intendedFiles: ['src/notify.js', 'src/format.js']
  }));

  assert.equal(result.tier, 2);
});

test('a higher claimed tier is preserved', () => {
  const result = classifyTask(assessment({claimedTier: 3}));

  assert.equal(result.tier, 3);
});

test('an omitted tier claim fails closed while an explicit null claim leaves the computed tier intact', () => {
  const missingClaim = assessment();
  delete missingClaim.claimedTier;

  assert.equal(classifyTask(missingClaim).tier, 3);
  assert.equal(classifyTask(assessment({claimedTier: null})).tier, 1);
});

test('known sensitive path classes escalate even when all risk answers say false', () => {
  const sensitivePaths = [
    ['src/auth/session.js', 'auth'],
    ['config/secrets/loader.js', 'secrets'],
    ['db/migrations/004.js', 'schema'],
    ['src/api/public-routes.js', 'publicApi'],
    ['src/billing/invoice.js', 'financial'],
    ['src/users/profile.js', 'userData'],
    ['infra/terraform/config.js', 'criticalInfrastructure'],
    ['src/workflows/pr.js', 'criticalInfrastructure']
  ];

  for (const [file, risk] of sensitivePaths) {
    const result = classifyTask(assessment({intendedFiles: [file]}));
    assert.equal(result.tier, 3, `${file} must escalate despite ${risk}=false`);
  }
});

test('preflight UI work is Tier 2 only with independent triage and plan evidence', () => {
  const base = assessment({
    scope: 'one-subsystem',
    userFacingUI: true,
    claimedTier: 2,
    intendedFiles: ['src/components/Notice.tsx'],
    accessibilityEvidence: {
      triage: {by: 'accessibility-reviewer', date: '2026-09-25', notes: 'UI scope is bounded.', revision: 2},
      plan: {by: 'accessibility-reviewer', date: '2026-09-25', notes: 'Keyboard checks are planned.', revision: 2},
      finalReview: null
    }
  });

  assert.equal(classifyTask(base).tier, 2);
  assert.equal(classifyTask({...base, accessibilityEvidence: null}).tier, 3);
  assert.equal(classifyTask({...base, accessibilityEvidence: {
    ...base.accessibilityEvidence,
    triage: {...base.accessibilityEvidence.triage, by: base.developer}
  }}).tier, 3);
  assert.equal(classifyTask({...base, accessibilityEvidence: {
    ...base.accessibilityEvidence,
    plan: {...base.accessibilityEvidence.plan, by: ' IMPLEMENTER-SESSION '}
  }}).tier, 3);
});

test('final UI classification requires independent final review on the reviewed commit', () => {
  const reviewedCommit = 'b'.repeat(40);
  const input = assessment({
    stage: 'final',
    developer: 'implementer-session',
    scope: 'one-subsystem',
    userFacingUI: true,
    claimedTier: 2,
    intendedFiles: ['src/components/Notice.tsx'],
    actualFiles: ['src/components/Notice.tsx'],
    reviewedCommit,
    accessibilityEvidence: accessibilityEvidence(reviewedCommit)
  });

  assert.equal(classifyTask(input).tier, 2);
  assert.equal(classifyTask({...input, accessibilityEvidence: {
    ...input.accessibilityEvidence,
    finalReview: null
  }}).tier, 3);
  assert.equal(classifyTask({...input, accessibilityEvidence: {
    ...input.accessibilityEvidence,
    finalReview: {...input.accessibilityEvidence.finalReview, commit: 'c'.repeat(40)}
  }}).tier, 3);
  assert.equal(classifyTask({...input, accessibilityEvidence: {
    ...input.accessibilityEvidence,
    finalReview: {...input.accessibilityEvidence.finalReview, by: input.developer}
  }}).tier, 3);
});

test('final classification escalates when the actual diff expands the declared single-file scope', () => {
  const result = classifyTask(assessment({
    stage: 'final',
    actualFiles: ['src/notify.js', 'src/format.js']
  }));

  assert.equal(result.tier, 3);
});

test('classification reasons are deterministic for malformed evidence', () => {
  const input = assessment({scope: null, risks: {...noRisks, auth: null}});

  assert.deepEqual(classifyTask(input), classifyTask(input));
  assert.equal(classifyTask(input).tier, 3);
  assert.ok(classifyTask(input).reasons.length > 0);
});
