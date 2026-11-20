const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'modules/business-manager/index.html');

test('Business Manager packaging remains optional and isolated', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(build.includes('fs.existsSync(businessSource)'));
  assert.ok(build.includes("dist','modules/business-manager/index.html"));
  assert.ok(build.includes('Invalid Business Manager HTML source'));
  assert.ok(build.includes('ultimate-business-launcher'));
});

test('Business Manager source is HTML without obvious embedded private keys', () => {
  if (!fs.existsSync(source)) return;
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.toLowerCase().includes('<html'));
  assert.ok(html.toLowerCase().includes('</html>'));
  assert.ok(!html.includes('-----BEGIN PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN EC PRIVATE KEY-----'));
});
