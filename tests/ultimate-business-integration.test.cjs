const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'modules/business-manager/index.html');

test('Business Manager source remains available and safe to package', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(build.includes('Business Manager source is required'));
  assert.ok(build.includes('srcdoc'));
  assert.ok(build.includes('appforge-ultimate-studio-home'));
  assert.ok(build.includes('event.source===frame.contentWindow'));
  assert.ok(build.includes("dist,'modules/business-manager/index.html"));
});

test('Business Manager source remains unchanged and contains no obvious embedded private keys', () => {
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.toLowerCase().includes('<html'));
  assert.ok(html.toLowerCase().includes('</html>'));
  assert.ok(!html.includes('-----BEGIN PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN EC PRIVATE KEY-----'));
  assert.ok(!html.includes('id="ultimate-studio-home"'));
});

test('Studio Ultimate embeds Business Manager in its own navigation without external module navigation', () => {
  const distIndex = path.join(root, 'dist/index.html');
  assert.ok(fs.existsSync(distIndex), 'Run npm run build before this assertion.');
  const studio = fs.readFileSync(distIndex, 'utf8');
  assert.ok(studio.includes('<title>AppForge Studio Ultimate — 15.8.10</title>'));
  assert.ok(studio.includes('id="ultimate-business-launcher"'));
  assert.ok(studio.includes('id="ultimate-business-frame"'));
  assert.ok(studio.includes('bmProductManager'));
  assert.ok(studio.includes('Créer un produit pour une application'));
  assert.ok(studio.includes('srcdoc'));
  assert.ok(!studio.includes('href="modules/business-manager/index.html"'));
  assert.ok(studio.includes('window.parent.postMessage'));
  const runtimeStart = studio.indexOf('<script id="ultimate-business-runtime">');
  const runtimeEnd = studio.indexOf('</script>', runtimeStart);
  assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart);
  const runtime = studio.slice(runtimeStart + '<script id="ultimate-business-runtime">'.length, runtimeEnd);
  assert.ok(runtime, 'Expected the Business Manager navigation runtime.');
  assert.doesNotThrow(() => new vm.Script(runtime));
});

test('Studio HTML does not expose nested script tags inside questionnaire JavaScript', () => {
  const source = fs.readFileSync(path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html'),'utf8');
  const start = source.indexOf('const CRM_QUESTIONNAIRE_TEMPLATE = ');
  const end = source.indexOf('const crmQEsc=',start);
  assert.ok(start>=0 && end>start,'CRM questionnaire source exists');
  assert.doesNotMatch(source.slice(start,end),/<script(?=[\\s>])/i,'Nested script openers must be encoded in JS literals');
  assert.ok(source.slice(start,end).includes(String.raw`\u003cscript`),'Encoded nested script opener must be present');
});

test('Ultimate runtime is inserted AFTER the embedded CRM questionnaire template', () => {
  const dist=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
  const crm=dist.indexOf('const crmQEsc=');
  const runtime=dist.indexOf('<script id="ultimate-business-runtime">');
  const nav=dist.indexOf('<script id="appforge-navigation-final">');
  assert.ok(crm>=0 && nav>crm && runtime>nav,'Runtime must be after all source scripts, not inside CRM string');
  assert.ok(dist.lastIndexOf('</body>')>runtime,'Runtime must be inside the final document body');
  assert.equal((dist.match(/<script id="ultimate-business-runtime">/g)||[]).length,1);
});

test('Ultimate navigation survives dynamic sidebar rebuild and includes Business in bottom dock', () => {
  const source = fs.readFileSync(path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html'),'utf8');
  const build = fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
  const dist = fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
  assert.ok(source.includes("['business-manager','▣','Business Manager']"));
  assert.ok(source.includes("['business-manager','▣','Business']"));
  assert.ok(source.includes("document.getElementById('ultimate-business-launcher')?.click()"));
  assert.ok(source.includes("hamburger.onclick="));
  assert.ok(build.includes("navigation is rebuilt at runtime"));
  assert.ok(dist.includes('id="ultimate-business-launcher"'));
  assert.ok(dist.includes('id="ultimate-business-frame"'));
});

test('Capacitor package keeps the same-origin module asset for data continuity', () => {
  const distIndex = path.join(root, 'dist/index.html');
  const androidIndex = path.join(root, 'android/app/src/main/assets/public/index.html');
  const distModule = path.join(root, 'dist/modules/business-manager/index.html');
  const androidModule = path.join(root, 'android/app/src/main/assets/public/modules/business-manager/index.html');
  assert.ok(fs.existsSync(androidIndex), 'Capacitor sync must include Ultimate.');
  assert.ok(fs.existsSync(androidModule), 'Capacitor sync must preserve the Business Manager module route.');
  assert.equal(fs.readFileSync(androidIndex, 'utf8'), fs.readFileSync(distIndex, 'utf8'));
  assert.equal(fs.readFileSync(androidModule, 'utf8'), fs.readFileSync(distModule, 'utf8'));
  assert.ok(fs.readFileSync(androidModule, 'utf8').includes('id="ultimate-studio-home"'));
});

test('Business Manager and integrated navigation scripts parse', () => {
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.includes('id="dockMore"'));
  assert.ok(html.includes('id="bmMore"'));
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  assert.ok(start >= 0 && end > start);
  assert.doesNotThrow(() => new vm.Script(html.slice(start + '<script>'.length, end)));
  const studio = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const runtimeStart = studio.indexOf('<script id="ultimate-business-runtime">');
  const runtimeEnd = studio.indexOf('</script>', runtimeStart);
  assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart);
  const runtime = studio.slice(runtimeStart + '<script id="ultimate-business-runtime">'.length, runtimeEnd);
  assert.ok(runtime);
  assert.doesNotThrow(() => new vm.Script(runtime));
});


test('Cloud UI offers explicit local retention and recovery of previous owner identity', () => {
 const source=fs.readFileSync(path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html'),'utf8');
 assert.ok(source.includes('id="afSyncKeepLocal"'));
 assert.ok(source.includes('id="afSyncSnapshotRestore"'));
 assert.ok(source.includes("'appforge_studio_cloud_owner_v1'"));
 assert.ok(source.includes('Aucune nouvelle licence ne sera créée automatiquement'));
 assert.ok(source.includes('afWorkerCentral'));
 assert.ok(source.includes('https://appforge-license-api.lalainaadclick.workers.dev'));
});

test('Ultimate launch remains Studio-first and Business is only opened on explicit action', () => {
 const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
 assert.ok(build.includes('let opened=false'));
 assert.ok(build.includes('launcher.addEventListener("click",openBusiness)'));
 assert.ok(build.includes('function closeBusiness(updateHistory)'));
 assert.ok(build.includes('studioHtml.lastIndexOf(\'</body>\')'));
});
