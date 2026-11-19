const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../../../AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');

test('Studio Cloud page targets only the canonical central V3 Worker', () => {
  assert.match(source, /https:\/\/appforge-license-api\.lalainaadclick\.workers\.dev/);
  assert.doesNotMatch(source, /appforge-cloud-api\.appforge-licences-mg\.workers\.dev/);
  assert.doesNotMatch(source, /\/v1\/auth\/login|\/v1\/session|\/v1\/organizations\//);
});

test('Cloud owner authentication uses the license proof and short-lived bearer token', () => {
  assert.match(source, /APPFORGE-STUDIO/);
  assert.match(source, /\/v1\/status/);
  assert.match(source, /\/v1\/cloud\/token/);
  assert.match(source, /\/v1\/cloud\/snapshot\?resource=default/);
  assert.match(source, /licenseToken:owner\.licenseToken/);
  assert.doesNotMatch(source, /afSyncEmail|afSyncPassword|AppForgeCloudSession/);
});

test('legacy owner email/password credentials are discarded during migration', () => {
  assert.match(source, /AppForge · cloud propriétaire/);
  assert.match(source, /native\(\)\.remove\('appforge_studio_cloud_owner_v1'\)/);
  assert.match(source, /appforge_studio_cloud_v3_owner/);
});
