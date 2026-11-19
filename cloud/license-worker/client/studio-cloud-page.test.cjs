const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../../../AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
const start = source.indexOf("page.id='page-cloudsync'");
const end = source.indexOf('</script>', start);
const cloudPage = source.slice(start, end);

test('Studio Cloud page targets only the canonical central V3 Worker', () => {
  assert.ok(start > 0 && end > start, 'Cloud page script is present');
  assert.match(cloudPage, /https:\/\/appforge-license-api\.lalainaadclick\.workers\.dev/);
  assert.doesNotMatch(cloudPage, /appforge-cloud-api\.appforge-licences-mg\.workers\.dev/);
  assert.doesNotMatch(cloudPage, /\/v1\/auth\/login|\/v1\/session|\/v1\/organizations\//);
});

test('Cloud owner authentication uses the license proof and short-lived bearer token', () => {
  assert.match(cloudPage, /APPFORGE-STUDIO/);
  assert.match(cloudPage, /\/v1\/status/);
  assert.match(cloudPage, /\/v1\/cloud\/token/);
  assert.match(cloudPage, /\/v1\/cloud\/snapshot\?resource=default/);
  assert.match(cloudPage, /licenseToken:owner\.licenseToken/);
  assert.doesNotMatch(cloudPage, /afSyncEmail|afSyncPassword|AppForgeCloudSession/);
});

test('legacy owner credentials are discarded and the V3 proof has secure storage', () => {
  assert.match(source, /AppForge · cloud propriétaire/);
  assert.match(source, /native\(\)\.remove\('appforge_studio_cloud_owner_v1'\)/);
  assert.match(source, /appforge_studio_cloud_v3_owner/);
});
