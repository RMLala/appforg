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


test('Ultimate build exposes a working sidebar link only when Business Manager is packaged', () => {
  const distIndex = path.join(root, 'dist/index.html');
  if (!fs.existsSync(distIndex)) return; // Run this assertion after npm run build.
  const studio = fs.readFileSync(distIndex, 'utf8');
  const packaged = path.join(root, 'dist/modules/business-manager/index.html');
  if (fs.existsSync(source)) {
    assert.ok(fs.existsSync(packaged), 'Business Manager must be copied into dist');
    assert.ok(studio.includes('id="ultimate-business-launcher"'), 'Studio must expose the module in its sidebar');
    assert.ok(studio.includes('href="modules/business-manager/index.html"'));
  } else {
    assert.ok(!studio.includes('id="ultimate-business-launcher"'), 'Never display a broken Business Manager link');
  }
});

test('Android assets include the exact Business Manager source after Capacitor sync', () => {
  if (!fs.existsSync(source)) return;
  const androidModule = path.join(root, 'android/app/src/main/assets/public/modules/business-manager/index.html');
  assert.ok(fs.existsSync(androidModule), 'Capacitor Android assets must include the module');
  const distModule = path.join(root, 'dist/modules/business-manager/index.html');
  assert.ok(fs.existsSync(distModule));
  const packaged = fs.readFileSync(distModule, 'utf8');
  assert.equal(fs.readFileSync(androidModule, 'utf8'), packaged);
  assert.ok(packaged.includes('id="ultimate-studio-home"'));
  assert.ok(packaged.includes('href="../../index.html"'));
  assert.ok(!fs.readFileSync(source, 'utf8').includes('id="ultimate-studio-home"'), 'Standalone source remains unchanged');
});

test('Business Manager interactive JavaScript parses and mobile controls exist', () => {
  if (!fs.existsSync(source)) return;
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.includes('id="dockMore"'));
  assert.ok(html.includes('id="bmMore"'));
  assert.ok(html.includes("addEventListener('popstate'"));
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  assert.ok(start >= 0 && end > start, 'Expected inline JavaScript');
  const vm = require('node:vm');
  assert.doesNotThrow(() => new vm.Script(html.slice(start + '<script>'.length, end)));
});
