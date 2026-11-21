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
  assert.ok(studio.includes('<title>AppForge Studio Ultimate — 15.8.14</title>'));
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
  assert.ok(html.includes("hamburger.addEventListener('touchend'"));
  assert.ok(html.includes("hamburger.addEventListener('click'"));
  assert.ok(html.includes("hamburger.style.pointerEvents='auto'"));
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
  assert.ok(build.includes('delete persisted.studioLegacyCommercial;'));
  assert.ok(build.includes('project.businessManager=persisted;'));
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
  assert.match(cloudScript, /async function readSnapshot\(\)/);
  assert.match(cloudScript, /let localError=''/);
  assert.match(cloudScript, /linked=false;localError=error\.message/);
  assert.match(cloudScript, /La copie distante reste accessible pour une restauration sélective/);
  assert.match(cloudScript, /function mergeCloudData/);
  assert.match(cloudScript, /cloudSnapshot:remote/);
  assert.match(cloudScript, /localRaw:\{studio:oldStudioRaw,delivery:oldDeliveryRaw\}/);
  assert.match(cloudScript, /if\(restoreStudio&&/);
  assert.match(cloudScript, /if\(restoreDelivery&&/);
  assert.match(cloudScript, /Les valeurs précédentes ont été rétablies/);
  assert.match(cloudScript, /markUnlinked/);
  assert.doesNotMatch(cloudScript, /localStorage\.setItem\('promptforge_v3_state',JSON\.stringify\(remote\.studioState\)\)/);
  assert.doesNotMatch(cloudScript, /localStorage\.setItem\('appforge_delivery_tracker_v1',JSON\.stringify\(remote\.deliveryTracker\)\)/);
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


// Migration commerciale : les enregistrements orphelins et les sources invalides ne doivent jamais être supprimés.
test('Business migration recreates missing linked projects and merges into existing projects', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  const start = build.indexOf('function migrateBusinessData(){');
  const end = build.indexOf('\nfunction toBusinessRecord', start);
  assert.ok(start >= 0 && end > start, 'Business migration function exists');
  const migration = build.slice(start, end);
  function runMigration(state, legacyRaw = '[]', catalogueRaw = '[]', failWrite = false) {
    const store = new Map([
      ['promptforge_v3_state', JSON.stringify(state)],
      ['appforge_clientbrief_v01', legacyRaw],
      ['appforge_clientbrief_catalogue_v06', catalogueRaw]
    ]);
    const localStorage = {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { if (failWrite && key === 'promptforge_v3_state') throw new Error('quota'); store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    };
    const window = { AppForgeStudioCloudSync: { markUnlinked() { window.unlinked = true; } } };
    const context = { state, KEY: 'promptforge_v3_state', localStorage, window };
    vm.runInNewContext(migration + '\nresult=migrateBusinessData();', context);
    return { ok: context.result, state, store, window };
  }

  const orphan = runMigration({
    projects: [], businessRecords: [{ id: 'legacy-1', studioProjectId: 'project-missing', project: 'Projet historique', business: { orders: [{ id: 'order-1' }] } }],
    businessCatalogue: [], businessDataMigrated: false
  });
  assert.equal(orphan.ok, true);
  assert.equal(orphan.state.projects.length, 1);
  assert.equal(String(orphan.state.projects[0].id), 'project-missing');
  assert.equal(orphan.state.projects[0].businessManager.business.orders[0].id, 'order-1');
  assert.equal(orphan.state.businessRecords.length, 0);
  assert.equal(orphan.state.businessDataMigrated, true);
  assert.equal(orphan.state.businessDataMigrationV2, true);
  assert.equal(orphan.window.unlinked, true);

  const existing = runMigration({
    projects: [{ id: 'project-1', name: 'Nom validé', businessManager: { client: 'Client validé', business: { orders: [{ id: 'old-order' }] } } }],
    businessRecords: [{ id: 'legacy-2', studioProjectId: 'project-1', project: 'Ancien nom', client: 'Ancien client', business: { orders: [{ id: 'new-order' }] } }],
    businessCatalogue: [], businessDataMigrated: false
  });
  assert.equal(existing.ok, true);
  assert.equal(existing.state.projects.length, 1);
  assert.equal(existing.state.projects[0].name, 'Nom validé');
  assert.equal(existing.state.projects[0].businessManager.client, 'Client validé');
  assert.deepEqual(JSON.parse(JSON.stringify(existing.state.projects[0].businessManager.business.orders.map(x => x.id))).sort(), ['new-order', 'old-order']);

  const recovered = runMigration({ projects: [], businessRecords: [], businessCatalogue: [], businessDataMigrated: true }, JSON.stringify([{ id:'legacy-recovered', project:'Dossier récupéré après migration précédente' }]));
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.projects.length, 1);
  assert.equal(recovered.state.projects[0].name, 'Dossier récupéré après migration précédente');
  const repeated = runMigration(recovered.state, JSON.stringify([{ id:'legacy-recovered', project:'Dossier récupéré après migration précédente' }]));
  assert.equal(repeated.ok, true);
  assert.equal(repeated.state.projects.length, 1, 'the same legacy record is not imported twice');

  const noId = runMigration({ projects: [], businessRecords: [], businessCatalogue: [], businessDataMigrated: false }, JSON.stringify([{ project:'Dossier sans ID', client:'Client historique' }]));
  const noIdRepeated = runMigration(noId.state, JSON.stringify([{ project:'Dossier sans ID', client:'Client historique' }]));
  assert.equal(noIdRepeated.state.projects.length, 1, 'a record without an ID uses a stable migration marker');
});

test('Business migration preserves invalid legacy data and does not set its completion flag', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  const start = build.indexOf('function migrateBusinessData(){');
  const end = build.indexOf('\nfunction toBusinessRecord', start);
  const migration = build.slice(start, end);
  const state = { projects: [], businessRecords: [], businessCatalogue: [], businessDataMigrated: false };
  const store = new Map([
    ['promptforge_v3_state', JSON.stringify(state)],
    ['appforge_clientbrief_v01', '{invalid-json'],
    ['appforge_clientbrief_catalogue_v06', '[]']
  ]);
  const localStorage = { getItem:key=>store.has(key)?store.get(key):null, setItem:(key,value)=>store.set(key,String(value)), removeItem:key=>store.delete(key) };
  const window = {};
  const context = { state, KEY:'promptforge_v3_state', localStorage, window };
  vm.runInNewContext(migration + '\nresult=migrateBusinessData();', context);
  assert.equal(context.result, false);
  assert.equal(state.businessDataMigrated, false);
  assert.equal(store.get('appforge_clientbrief_v01'), '{invalid-json');
  assert.match(window.AppForgeBusinessMigrationError, /clés sources sont conservées/);
});

test('Business migration rolls back when local persistence cannot be confirmed', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  const start = build.indexOf('function migrateBusinessData(){');
  const end = build.indexOf('\nfunction toBusinessRecord', start);
  const migration = build.slice(start, end);
  const state = { projects: [], businessRecords: [{ id:'x', project:'À conserver' }], businessCatalogue: [], businessDataMigrated:false };
  const original = JSON.stringify(state);
  const store = new Map([
    ['promptforge_v3_state', original],
    ['appforge_clientbrief_v01', '[]'],
    ['appforge_clientbrief_catalogue_v06', '[]']
  ]);
  const localStorage = { getItem:key=>store.has(key)?store.get(key):null, setItem:(key,value)=>{if(key==='promptforge_v3_state')throw new Error('quota');store.set(key,String(value));}, removeItem:key=>store.delete(key) };
  const context = { state, KEY:'promptforge_v3_state', localStorage, window:{} };
  vm.runInNewContext(migration + '\nresult=migrateBusinessData();', context);
  assert.equal(context.result, false);
  assert.equal(JSON.stringify(state), original);
  assert.equal(state.businessDataMigrated, false);
  assert.match(context.window.AppForgeBusinessMigrationError, /sauvegarde locale non confirmée/);
});

test('Cloud merge adds missing records, keeps local conflicts, and combines completed steps', () => {
  const sourceHtml = fs.readFileSync(path.join(root, 'AppForge_Studio_V15_7_Questionnaire_Client.html'), 'utf8');
  const start = sourceHtml.indexOf('function cloudCopy(value)');
  const end = sourceHtml.indexOf('async function restore()', start);
  assert.ok(start >= 0 && end > start, 'Cloud merge helper exists');
  const helper = sourceHtml.slice(start, end);
  const local = {
    projects: [{ id:'p1', name:'Nom local', localOnly:true }, { id:'p2', name:'Projet local' }],
    steps: [true, false, false],
    theme: 'dark'
  };
  const cloud = {
    projects: [{ id:'p1', name:'Nom Cloud', cloudOnly:true }, { id:'p3', name:'Projet Cloud' }],
    steps: [false, true, false, true],
    theme: 'light',
    cloudOnlyRoot: true
  };
  const report = { added:0, conflicts:0, paths:[] };
  const context = { local, cloud, report };
  vm.runInNewContext(helper + "\nresult=mergeCloudData(local,cloud,'studioState',report);", context);
  const merged = JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(merged.projects.map(x=>x.id), ['p1','p2','p3']);
  assert.equal(merged.projects[0].name, 'Nom local');
  assert.equal(merged.projects[0].localOnly, true);
  assert.equal(merged.projects[0].cloudOnly, true);
  assert.deepEqual(merged.steps, [true, true, false, true]);
  assert.equal(merged.theme, 'dark');
  assert.equal(merged.cloudOnlyRoot, true);
  assert.ok(report.conflicts >= 2);
  assert.ok(report.paths.includes('studioState.projects[p1].name'));
  assert.ok(report.paths.includes('studioState.theme'));
});

test('Only explicitly validated manual payments count as paid', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.match(build, /function bizInvoicePaid\(i\)\{return \(i\.payments\|\|\[\]\)\.filter\(p=>p\.status==='Vérifié manuellement'\)/);
  assert.doesNotMatch(build, /p\.verification==='Déclaration de vérification manuelle'\)\.reduce/);
  assert.match(build, /invoicePayments=\(data\.business\?\.invoices\|\|\[\]\)\.flatMap\(i=>i\.payments\|\|\[\]\)\.filter\(p=>p\.status==='Vérifié manuellement'\)/);
});

test('Release metadata is aligned on AppForge Studio 15.8.14 and API23/API29 builds', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/android.yml'), 'utf8');
  assert.equal(pkg.version, '15.8.14');
  assert.match(gradle, /versionCode 175/);
  assert.match(gradle, /versionName "15.8.14"/);
  assert.match(workflow, /AppForge-Studio-Ultimate-15\.8\.14-Release-API23\.apk/);
  assert.match(workflow, /AppForge-Studio-Ultimate-15\.8\.14-Release-API29\.apk/);
  assert.match(workflow, /name: AppForge-Studio-Ultimate-15\.8\.14-Release-API23/);
  assert.match(workflow, /name: AppForge-Studio-Ultimate-15\.8\.14-Release-API29/);
  assert.match(workflow, /npm run test:worker/);
});


test('Business Manager save, delete, import and restore use the shared Studio project store', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.ok(build.includes('getBusinessRecords?.({persist:false})'));
  assert.match(build, /records=saved/);
  assert.match(build, /const area=root\.querySelector\('#'\+target\)/);
  assert.match(build, /saveBusinessRecords\(obj\.records,importedCatalogue\)/);
  assert.match(build, /saveBusinessRecords\(newer,nextCatalogue\)/);
  assert.match(build, /state\.projects=nextProjects/);
  assert.ok(build.includes('bmScript += "\\nstorageLoad();render();";'));
});

test('Shared Business Manager project store persists deletions instead of resurrecting removed projects', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  const start = build.indexOf('window.AppForgeProjectStore={');
  const end = build.indexOf('};' + String.fromCharCode(96) + ');', start);
  assert.ok(start >= 0 && end > start, 'Shared project store block exists');
  const source = build.slice(start, end + 2);
  const store = new Map();
  const state = {
    projects: [
      { id:'p1', name:'Projet à conserver', idea:'Ancien objectif', status:'À faire', form:{keep:true}, businessManager:{id:'record-1'} },
      { id:'p2', name:'Projet à supprimer', idea:'Ancien objectif', status:'À faire', businessManager:{id:'record-2'} }
    ],
    businessRecords:[], businessCatalogue:[], businessDataMigrationV2:true,
    catalog:[], sales:[], clients:[], payments:[]
  };
  const localStorage = {
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  };
  const window = {};
  const context = {
    state, window, localStorage, KEY:'promptforge_v3_state',
    migrateBusinessData:()=>true,
    toBusinessRecord:project=>({...project.businessManager,id:project.businessManager?.id||'studio-'+project.id,studioProjectId:String(project.id),project:project.name,problem:project.idea||'',projectKind:project.businessManager?.projectKind||'personal',client:project.businessManager?.client||'',status:project.status||'À démarrer'}),
    saveStudioState:()=>{localStorage.setItem('promptforge_v3_state',JSON.stringify(state));return JSON.parse(localStorage.getItem('promptforge_v3_state'));}
  };
  vm.runInNewContext(source,context);
  const ok=context.window.AppForgeProjectStore.saveBusinessRecords([
    {id:'record-1',studioProjectId:'p1',project:'Projet conservé',problem:'Objectif mis à jour',status:'En cours',projectKind:'client'}
  ],[]);
  assert.equal(ok,true);
  assert.equal(state.projects.length,1);
  assert.equal(state.projects[0].id,'p1');
  assert.equal(state.projects[0].name,'Projet conservé');
  assert.equal(state.projects[0].form.keep,true);
  assert.equal(state.projects.some(project=>project.id==='p2'),false);
  assert.equal(JSON.parse(localStorage.getItem('promptforge_v3_state')).projects.length,1);
});

test('Personal Business Manager projects hide the Commercial project tab', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert.match(build, /commercial\.classList\.toggle\('hidden',!project\|\|isPersonal\(project\)\)/);
  assert.match(build, /const project=records\.find\(r=>String\(r\.id\)===String\(activeId\)\)/);
});
