import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {classifyReviewPaths,parseReviewPathPolicy,reviewRouteForPull} from '../scripts/lib/review-paths.mjs';

const policyPath=new URL('../policy/review-paths.json',import.meta.url);
const policy=()=>parseReviewPathPolicy(fs.readFileSync(policyPath,'utf8'));
const repository='dpitcock/ai-toolkit';

test('authoring infrastructure requires only Code Reviewer, regardless of names or file count',()=>{
  const files=['tests/gates.test.mjs','tests/helpers/publisher-host.mjs','tests/fixtures/auth/secrets.yml','tests/fixtures/action.yml',
    'docs/verification.md','docs/agent-details/AGENT-TESTING.md','README.md','project/new-plan.md',
    'epics/EPIC-007/tasks/TASK-001.md','scripts/internal-report.mjs'];
  const result=classifyReviewPaths(policy(),files);
  assert.equal(result.targetEnvironment,'dev');
  assert.deepEqual(result.requiredRoles,['code_reviewer']);
  assert.deepEqual(result.productionPaths,[]);
});

test('every explicitly shipped path and each protected directory requires production review',()=>{
  const definition=policy();
  for(const file of [...definition.productionFiles,...definition.productionDirectories.map(dir=>`${dir}example.md`),
    'custom/action.yml','custom/action.yaml']) {
    const result=classifyReviewPaths(definition,[file]);
    assert.equal(result.targetEnvironment,'production',file);
    assert.deepEqual(result.requiredRoles,['code_reviewer','qa','appsec'],file);
  }
});

test('mixed changes retain production review and optional configured production roles',()=>{
  const result=classifyReviewPaths(policy(),['tests/gates.test.mjs','scripts/check-gate.mjs'],
    ['principal','qa','appsec','accessibility_reviewer','ui_designer']);
  assert.deepEqual(result.requiredRoles,['code_reviewer','principal','qa','appsec','accessibility_reviewer','ui_designer']);
  assert.deepEqual(result.productionPaths,['scripts/check-gate.mjs']);
});

test('approved shipped boundary is protected independently of manifest enumeration',()=>{
  const approved=`
    project/project-plan.md.template config/workspace-config.yaml project/workspace-config-history.jsonl
    AGENTS.md CLAUDE.md skills-lock.json package.json package-lock.json
    docs/gates.md docs/roles.md docs/workflow.md docs/installation.md docs/review-paths.md
    .github/CODEOWNERS CODEOWNERS docs/CODEOWNERS
    scripts/init-project.sh scripts/init-workspace.mjs scripts/install-native-lock.mjs
    scripts/install-skills.sh scripts/link-skills.mjs scripts/new-epic.sh
    scripts/check-gate.mjs scripts/check-gate.sh scripts/check-pr.mjs scripts/check-project.mjs
    scripts/check-tier1.mjs scripts/check-tier2.mjs scripts/check-host-reviews.mjs scripts/preflight.mjs
    scripts/admit-epic.mjs scripts/workflow-event.mjs scripts/review-route.mjs
    scripts/lib/review-paths.mjs scripts/lib/local-review-route.mjs
    scripts/lib/activation-history.mjs scripts/lib/activation-report.mjs scripts/lib/bootstrap-policy.mjs
    scripts/lib/epic-completion.mjs scripts/lib/epic-finalization.mjs scripts/lib/epic-integration.mjs
    scripts/lib/epic-policy-adoption.mjs scripts/lib/policy-adoption-record.mjs
    scripts/lib/release-verification-proof.mjs scripts/lib/release-verification-record.mjs
    scripts/lib/release-verification-reviews.mjs scripts/lib/release-verification-runtime.mjs
    scripts/lib/review-evidence.mjs scripts/lib/review-scheduling.mjs scripts/lib/task-assessment.mjs
    scripts/lib/task-tier.mjs scripts/lib/tier-defaults.mjs scripts/lib/tier3-policy.mjs
    scripts/lib/workflow-admission.mjs scripts/lib/workflow-authorization.mjs
    scripts/lib/workflow-context.mjs scripts/lib/workflow-state.mjs scripts/lib/workspace-config.mjs
    scripts/lib/workspace-history-validation.mjs scripts/lib/workspace-history.mjs
    templates/nested/example.yaml epics/EPIC-XXX/tasks/TASK-XXX.md.template policy/future-policy.json
    .clinerules/rule.md skills/new-skill/SKILL.md .github/workflows/new.yml .github/actions/new/index.js
    action.yml nested/action.yaml
  `.trim().split(/\s+/);
  for(const file of approved) assert.equal(classifyReviewPaths(policy(),[file]).route,'production',file);
  for(const file of ['scripts/check-gate.mjs.notes','policy-notes/a','epics/EPIC-123/epic.md',
    'docs/superpowers/plans/internal.md','scripts/lib/internal-dev-helper.mjs','tests/fixtures/action.yaml']) {
    assert.equal(classifyReviewPaths(policy(),[file]).route,'authoring',file);
  }
});

test('malformed or empty paths and malformed policy fail closed',()=>{
  for(const files of [[],['../tests/a'],['/tests/a'],['tests//a'],['tests\\a'],['tests/./a'],['tests/a\n']]) {
    assert.throws(()=>classifyReviewPaths(policy(),files));
  }
  const definition=policy();
  for(const mutation of [{version:2},{repository:'owner/fork'},{grandfatheredThroughPr:-1},
    {productionFiles:['../scripts/a']},{productionDirectories:['scripts']},{unexpected:true}]) {
    assert.throws(()=>parseReviewPathPolicy(JSON.stringify({...definition,...mutation})));
  }
  assert.throws(()=>classifyReviewPaths(definition,['tests/a'],['unknown']));
});

test('new toolkit PRs override global roles only for authoring; grandfathered PRs and adopters retain them',()=>{
  const definition=policy();
  const input={policy:definition,repository,pr:definition.grandfatheredThroughPr+1,
    files:[{filename:'tests/gates.test.mjs',status:'modified'}],changedFiles:1,configuredRoles:['code_reviewer','appsec']};
  assert.deepEqual(reviewRouteForPull(input).requiredRoles,['code_reviewer']);
  for(const patch of [{pr:definition.grandfatheredThroughPr},{repository:'owner/adopter'}]) {
    assert.deepEqual(reviewRouteForPull({...input,...patch}).requiredRoles,['code_reviewer','appsec']);
    assert.equal(reviewRouteForPull({...input,...patch}).route,'legacy');
  }
});

test('host routing includes old rename paths and deleted shipped files',()=>{
  for(const file of [
    {filename:'tests/old-policy.mjs',previous_filename:'scripts/check-gate.mjs',status:'renamed'},
    {filename:'policy/obsolete.yaml',status:'removed'},
  ]) {
    const result=reviewRouteForPull({policy:policy(),repository,pr:999,files:[file],changedFiles:1,configuredRoles:[]});
    assert.equal(result.targetEnvironment,'production');
    assert.ok(result.requiredRoles.includes('qa'));
    assert.ok(result.requiredRoles.includes('appsec'));
  }
});

test('incomplete, duplicate, or ambiguous host file evidence cannot select the authoring route',()=>{
  const input={policy:policy(),repository,pr:999,files:[{filename:'tests/a',status:'modified'}],changedFiles:1,configuredRoles:[]};
  for(const patch of [{changedFiles:2},{changedFiles:0},{changedFiles:undefined},
    {files:[{filename:'tests/a',status:'renamed'}]},
    {files:[{filename:'tests/a',status:'unknown'}]},
    {files:[input.files[0],input.files[0]],changedFiles:2}]) {
    assert.throws(()=>reviewRouteForPull({...input,...patch}));
  }
});
