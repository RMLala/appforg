const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'modules/business-manager/index.html');
const distPath = path.join(root, 'dist/index.html');

test('Business Manager is packaged inside the single AppForge Studio shell', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(build.includes('businessManagerMount'));
  assert.ok(!build.includes('srcdoc'));
  assert.ok(!build.includes('<iframe'));
  assert.ok(!fs.existsSync(path.join(root, 'dist/modules/business-manager/index.html')));
  const studio = fs.readFileSync(distPath, 'utf8');
  assert.ok(studio.includes('<title>AppForge Studio Ultimate — 15.8.12</title>'));
  assert.ok(studio.includes('id="page-business-manager"'));
  assert.ok(studio.includes('id="appforgeBack"'));
  assert.match(studio, /veil\.id='afNativeLock'/);
  assert.ok(!/<iframe\b/i.test(studio));
  assert.ok(!studio.includes('id="ultimate-business-frame"'));
  assert.ok(!studio.includes('id="lock"'));
  assert.ok(studio.includes('Conception guidée'));
  assert.ok(studio.includes('Générateur avancé'));
});


test('Responsive navigation stays available from mobile through tablet breakpoints', () => {
  const html = fs.readFileSync(path.join(root, 'AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
  assert.ok(html.includes('@media(max-width:1000px){.layout{display:block!important;padding-bottom:78px!important}#mainNav.af-side{display:none!important}.af-bottom-nav{'));
  assert.ok(html.includes('@media(min-width:1001px){.af-bottom-nav,.af-more-sheet,.af-more-backdrop{display:none!important}}'));
  assert.ok(!html.includes('@media(max-width:760px){.layout{display:block!important;padding-bottom:78px!important}#mainNav.af-side{display:none!important}.af-bottom-nav{'));
  assert.ok(html.includes("if(window.matchMedia('(min-width:1001px)').matches){const layout=document.querySelector('.layout');const collapsed=layout.classList.toggle('af-nav-collapsed')"));
  assert.ok(!html.includes('if(quick.some(x=>x[0]===id))continue;'));
  assert.ok(html.includes('else plus.click()'));
});

test('Shared menu initializes with Android WebView-compatible DOM methods', () => {
  const html = fs.readFileSync(path.join(root, 'AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
  const start = html.indexOf('<script id="appforge-navigation-final">');
  const end = html.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start, 'Shared Studio navigation script exists');
  const nav = html.slice(start, end);
  assert.ok(!nav.includes('.replaceChildren('));
  assert.ok(!nav.includes('.append('));
  assert.ok(nav.includes("hamburger.setAttribute('aria-label','Ouvrir toutes les rubriques')"));
  assert.ok(nav.includes('Business Manager'));
});

test('Business Manager dashboard tiles remain clickable and route inside Studio', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.includes('data-launch="dossiers"'));
  assert.ok(html.includes('data-launch="business"'));
  assert.ok(html.includes('data-launch="production"'));
  assert.ok(html.includes('data-launch="licensing"'));
  assert.ok(build.includes("root.querySelectorAll('[data-launch]')"));
  assert.ok(build.includes("if(target==='licensing')window.goto?.('licenses')"));
  assert.ok(build.includes("else if(target==='backup')window.goto?.('cloudsync')"));
  assert.ok(!build.includes("bmMarkup=bmMarkup.replace(/<button"));
});

test('The integrated module uses Studio state and preserves legacy Business Manager data during migration', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(build.includes('appforge_clientbrief_v01'));
  assert.ok(build.includes('appforge_clientbrief_catalogue_v06'));
  assert.ok(build.includes('businessDataMigrated'));
  assert.ok(build.includes('AppForgeStudioCloudSync?.localChanged()'));
  assert.ok(build.includes('getBusinessRecords'));
  assert.ok(build.includes('saveBusinessRecords'));
  assert.ok(build.includes('toBusinessRecord'));
  assert.ok(build.includes('delete persisted.studioLegacyCommercial;project.businessManager=persisted'));
});

test('Legacy Studio commercial records are joined to the common project only by explicit IDs', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.match(build, /state\.catalog\.filter\(app=>String\(app\.projectId\|\|''\)===String\(project\.id\)\)/);
  assert.match(build, /state\.sales\.filter\(sale=>appIds\.has\(String\(sale\.applicationId\)\)\)/);
  assert.match(build, /state\.payments\.filter\(payment=>saleIds\.has\(String\(payment\.saleId\)\)\)/);
  assert.match(build, /delete persisted\.studioLegacyCommercial/);
  assert.match(build, /linkLegacyApplication:\(applicationId,projectId\)/);
  assert.match(build, /Anciennes affaires sans rattachement/);
  assert.match(build, /Choisir un projet client/);
  assert.match(build, /renderStudioUnlinked\(\)/);
  assert.match(build, /Affaires historiques du Studio liées à ce projet/);
  assert.match(build, /non validé\(s\) ici/);
});

test('Studio navigation and Business Manager runtime parse and remain in the same document', () => {
  const studio = fs.readFileSync(distPath, 'utf8');
  const runtimeStart = studio.indexOf('<script id="appforge-business-manager-integration">');
  const runtimeEnd = studio.indexOf('</script>', runtimeStart);
  assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart);
  const runtime = studio.slice(studio.indexOf('>', runtimeStart) + 1, runtimeEnd);
  assert.doesNotThrow(() => new vm.Script(runtime));
  const embedded = runtime.match(/script\.textContent=("(?:\\.|[^"\\])*");window\.__AppForgeBusinessManagerRoot=root/);
  assert.ok(embedded, 'Expected inline integrated Business Manager code.');
  const moduleScript = vm.runInNewContext(embedded[1]);
  assert.doesNotMatch(moduleScript, /document\.querySelector(?:All)?\(/);
  assert.doesNotMatch(moduleScript, /appforge_clientbrief_pin_v01/);
  assert.doesNotMatch(moduleScript, /async function hash\(pin,salt\)/);
  assert.match(runtime, /data-studio-page="licenses"/);
  assert.match(runtime, /data-studio-page="cloudsync"/);
  assert.match(runtime, /appforgeProjectLicenseContext/);
  assert.match(runtime, /admin\/licenses\?productId=/);
  assert.match(runtime, /customerName\|\|''/);
  assert.match(runtime, /paymentReference\|\|''/);
  assert.match(runtime, /admin\/licenses\/.*\/cloud/);
  assert.match(runtime, /rights\.maxBytes/);
  assert.match(moduleScript, /filter\(p=>p\.status==='Vérifié manuellement'/);
  assert.match(moduleScript, /status:'Vérifié manuellement'/);
  assert.doesNotThrow(() => new vm.Script(moduleScript));
  assert.match(studio, /\['business-manager','▣','Business Manager'\]/);
  assert.doesNotMatch(studio, /ultimate-business-launcher|ultimate-business-frame|srcdoc/);
  assert.deepEqual(fs.readdirSync(path.join(root,'dist')).filter(name=>name.endsWith('.html')),['index.html']);
});


test('Studio Cloud restoration is selective, integrity-checked, and backed up locally first', () => {
  const sourceHtml = fs.readFileSync(path.join(root, 'AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
  assert.match(sourceHtml, /Restaurer depuis le Cloud/);
  assert.match(sourceHtml, /afRestoreStudio/);
  assert.match(sourceHtml, /afRestoreDelivery/);
  const anchor = sourceHtml.indexOf("const $=id=>document.getElementById(id),API='");
  assert.ok(anchor >= 0, 'Cloud client source exists');
  const scriptStart = sourceHtml.lastIndexOf('<script>', anchor);
  const scriptEnd = sourceHtml.indexOf('</script>', anchor);
  const cloudScript = sourceHtml.slice(sourceHtml.indexOf('>', scriptStart) + 1, scriptEnd);
  assert.doesNotThrow(() => new vm.Script(cloudScript));
  assert.match(cloudScript, /v1\/cloud\/files/);
  assert.match(cloudScript, /v1\/cloud\/file\?fileId=/);
  assert.match(cloudScript, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(cloudScript, /idbPut\('backups',backup\)/);
  assert.match(cloudScript, /appforge-studio-cloud-restore/);
});

test('Studio design and generator stay in Studio instead of redirecting to PromptiPro', () => {
  const sourceHtml = fs.readFileSync(path.join(root, 'AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(sourceHtml.includes("['guided','✦','Conception guidée']"));
  assert.ok(sourceHtml.includes("['builder','⚙','Générateur avancé']"));
  assert.ok(!sourceHtml.includes("location.href='PromptiPro.html?tab=application'"));
  assert.ok(!sourceHtml.includes("location.href='PromptiPro.html?tab=application';return"));
  assert.ok(!build.includes("writeFileSync(path.join(dist,'PromptiPro.html')"));
});

test('Existing Business Manager source remains intact and free of obvious embedded private keys', () => {
  const html = fs.readFileSync(source, 'utf8');
  assert.ok(html.toLowerCase().includes('<html'));
  assert.ok(html.toLowerCase().includes('</html>'));
  assert.ok(!html.includes('-----BEGIN PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(!html.includes('-----BEGIN EC PRIVATE KEY-----'));
});

test('Studio source has no nested script tags inside the CRM questionnaire template', () => {
  const html = fs.readFileSync(path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html'),'utf8');
  const start = html.indexOf('const CRM_QUESTIONNAIRE_TEMPLATE = ');
  const end = html.indexOf('const crmQEsc=',start);
  assert.ok(start>=0 && end>start,'CRM questionnaire source exists');
  assert.doesNotMatch(html.slice(start,end),/<script(?=[\\s>])/i);
  assert.ok(html.slice(start,end).includes(String.raw`\u003cscript`));
});
