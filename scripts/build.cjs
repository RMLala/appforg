const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html');
const businessSource=path.join(root,'modules/business-manager/index.html');
if(!fs.existsSync(businessSource))throw new Error('Business Manager source is required for AppForge Studio Ultimate.');
const capacitorTag='<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script>';
let studioHtml=fs.readFileSync(source,'utf8').replace('</head>',capacitorTag+'</head>');
const titleStart=studioHtml.indexOf('<title>'),titleEnd=studioHtml.indexOf('</title>',titleStart);
if(titleStart<0||titleEnd<0)throw new Error('Studio title missing');
studioHtml=studioHtml.slice(0,titleStart)+'<title>AppForge Studio Ultimate — 15.8.14</title>'+studioHtml.slice(titleEnd+8);
studioHtml=studioHtml.replace('<h1>AppForge <span style="color:var(--b)">V15.8</span></h1>','<h1>AppForge <span style="color:var(--b)">Studio Ultimate</span></h1>');
const businessHtml=fs.readFileSync(businessSource,'utf8');
if(!businessHtml.toLowerCase().includes('<html')||!businessHtml.toLowerCase().includes('</html>'))throw new Error('Invalid Business Manager HTML source');
const styleMatch=businessHtml.match(/<style>([\s\S]*?)<\/style>/i);
const mainStart=businessHtml.indexOf('<main class="panel">'),mainEnd=businessHtml.indexOf('</main>',mainStart);
const scriptStart=businessHtml.indexOf('<script>'),scriptEnd=businessHtml.lastIndexOf('</script>');
if(!styleMatch||mainStart<0||mainEnd<mainStart||scriptStart<0||scriptEnd<scriptStart)throw new Error('Business Manager component anchors missing');
let bmMarkup=businessHtml.slice(mainStart+'<main class="panel">'.length,mainEnd);
bmMarkup=bmMarkup.replace('<section class="hidden" id="editor">','<section class="hidden" id="editor"><div class="bm-project-tabs hidden" id="bmProjectTabs" role="tablist" aria-label="Onglets du projet"><button class="nav active" data-project-tab="conception" type="button">Conception</button><button class="nav" data-project-tab="commercial" data-commercial="1" type="button">Commercial</button><button class="nav" data-project-tab="livraisons" type="button">Livraisons</button><button class="nav" data-project-tab="licences" type="button">Licences</button></div>');
let bmScript=businessHtml.slice(scriptStart+'<script>'.length,scriptEnd);
// The Studio owns the only lock, shell, navigation, storage and back stack.
bmScript=bmScript.replace(/const DB='appforge_clientbrief_v01',PIN='appforge_clientbrief_pin_v01';/,"const DB='appforge_clientbrief_v01';");
bmScript=bmScript.replace("let records=[],activeId=null,view='dashboard';","let records=[],activeId=null,view='dashboard',bmStorageReady=false;");
const lockStart=bmScript.indexOf('async function hash(pin,salt)');
const showStart=bmScript.indexOf('function show(name)',lockStart);
if(lockStart<0||showStart<0)throw new Error('Business Manager lock migration anchors missing');
bmScript=bmScript.slice(0,lockStart)+bmScript.slice(showStart);
const oldNavStart=bmScript.indexOf('/* v1.7.2 : navigation par historique natif Chrome/Android');
const importStart=bmScript.indexOf("$('#bmEncryptedImport').onchange",oldNavStart);
if(oldNavStart<0||importStart<0)throw new Error('Business Manager navigation migration anchors missing');
bmScript=bmScript.slice(0,oldNavStart)+`const bmViewStack=[];window.AppForgeBusinessManager={show(name){show(name)},back(){if(bmViewStack.length)show(bmViewStack.pop(),true);else window.AppForgeStudioBack?.()},currentView:()=>view,getRecords:()=>records,refresh(){storageLoad();render();bizCatalogueRender()}};
root.querySelectorAll('.bm-module-nav [data-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.view)));
root.querySelectorAll('[data-launch]').forEach(button=>button.addEventListener('click',()=>{const target=button.dataset.launch;if(target==='licensing')window.goto?.('licenses');else if(target==='backup')window.goto?.('cloudsync');else show(target)}));
`+bmScript.slice(importStart);
bmScript=bmScript.replace('function show(name){','function show(name,fromBack=false){if(!fromBack&&view!==name)bmViewStack.push(view);');
bmScript=bmScript.replace("updateKindChrome();}","updateKindChrome();const tabs=root.querySelector('#bmProjectTabs');if(tabs){tabs.classList.toggle('hidden',!activeId||name==='dashboard'||name==='dossiers');const project=records.find(r=>String(r.id)===String(activeId));const commercial=tabs.querySelector('[data-project-tab=\"commercial\"]');if(commercial)commercial.classList.toggle('hidden',!project||isPersonal(project));}}");
bmScript=bmScript.replace("root.querySelectorAll('.bm-module-nav [data-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.view)));","root.querySelectorAll('.bm-module-nav [data-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.view)));root.querySelectorAll('[data-project-tab]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.projectTab==='conception')show('editor');else if(button.dataset.projectTab==='commercial'){const project=records.find(r=>String(r.id)===String(activeId));if(project&&!isPersonal(project))show('business')}else if(button.dataset.projectTab==='livraisons')show('production');else{window.AppForgeStudioProjectContext?.open(records.find(r=>String(r.id)===String(activeId))?.studioProjectId||activeId);window.goto?.('licenses')}}));");
bmScript=bmScript.replace("const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];","const $=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];");
bmScript=bmScript.replaceAll('document.querySelectorAll(','root.querySelectorAll(').replaceAll('document.querySelector(','root.querySelector(');
bmScript=bmScript.replace(/document\.getElementById\((['"])([^'"]+)\1\)/g,(_,q,id)=>"root.querySelector('#"+id+"')");
bmScript=bmScript.replace("const area=document.getElementById(target);","const area=root.querySelector('#'+target);");
bmScript=bmScript.replace("const saved=JSON.parse(localStorage.getItem(DB)||'null');","const saved=window.AppForgeProjectStore?.getBusinessRecords?.({persist:false})||JSON.parse(localStorage.getItem(DB)||'null');records=saved;");
bmScript=bmScript.replace("localStorage.setItem(DB,JSON.stringify(obj.records));records=obj.records;bizCatalogue=Array.isArray(obj.catalogue)?bizValidateCatalogue(obj.catalogue):[];localStorage.setItem(BIZCAT,JSON.stringify(bizCatalogue));","const importedCatalogue=Array.isArray(obj.catalogue)?bizValidateCatalogue(obj.catalogue):[];if(window.AppForgeProjectStore){if(!bmStorageReady)throw new Error('Lecture du stockage Studio non confirmée. Import bloqué.');if(window.AppForgeProjectStore.saveBusinessRecords(obj.records,importedCatalogue)!==true)throw new Error('AppForge Studio n’a pas confirmé l’import.');records=window.AppForgeProjectStore.getBusinessRecords({persist:false});if(!Array.isArray(records)||records.length!==obj.records.length)throw new Error('La relecture des dossiers importés a échoué.');}else{localStorage.setItem(DB,JSON.stringify(obj.records));records=obj.records;localStorage.setItem(BIZCAT,JSON.stringify(importedCatalogue));}bizCatalogue=importedCatalogue;");
bmScript=bmScript.replace(/async function bmPrepareRestore\(x\)\{[\s\S]*?\n\}\nasync function bmToken/, "async function bmPrepareRestore(x){\n if(!bmStorageReady)throw new Error('Lecture du stockage Studio non confirmée. Restauration bloquée.');if(!bmSnapshotValid(x))throw new Error('Snapshot distant invalide : restauration bloquée.');\n if(!confirm('ATTENTION : restaurer '+x.records.length+' projet(s) Cloud remplace TOUS les dossiers ET le catalogue locaux. Export de sauvegarde JSON avant modification. Continuer ?'))return false;\n const secureBackup=await bmEncrypt(bmLocalSnapshot());\n download('business-manager-backup-chiffre-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({app:'AppForge Business Manager - Encrypted Backup',schema:3,snapshot:secureBackup},null,2),'application/json;charset=utf-8');\n const oldRecords=records,oldCatalogue=bizCatalogue,oldRecordsRaw=localStorage.getItem(DB),oldCatalogRaw=localStorage.getItem(BIZCAT);\n bmSkipHook=true;\n try{\n  const newer=structuredClone(x.records),nextCatalogue=bizValidateCatalogue(x.catalogue??[]);\n  if(window.AppForgeProjectStore){\n   if(window.AppForgeProjectStore.saveBusinessRecords(newer,nextCatalogue)!==true)throw new Error('AppForge Studio n’a pas confirmé la restauration.');\n   const verified=window.AppForgeProjectStore.getBusinessRecords({persist:false});\n   if(!Array.isArray(verified)||verified.length!==newer.length)throw new Error('La relecture des dossiers restaurés a échoué.');\n   records=verified;bmStorageReady=true;\n  }else{\n   localStorage.setItem(DB,JSON.stringify(newer));\n   if(localStorage.getItem(DB)!==JSON.stringify(newer))throw new Error('La sauvegarde locale des dossiers n’a pas été confirmée.');\n   localStorage.setItem(BIZCAT,JSON.stringify(nextCatalogue));\n   if(localStorage.getItem(BIZCAT)!==JSON.stringify(nextCatalogue))throw new Error('La sauvegarde locale du catalogue n’a pas été confirmée.');\n   records=newer;\n  }\n  bizCatalogue=nextCatalogue;activeId=null;render();bizCatalogueRender();if(view==='licensing')licRender();\n }catch(e){\n  records=oldRecords;bizCatalogue=oldCatalogue;\n  try{\n   if(window.AppForgeProjectStore){\n    if(window.AppForgeProjectStore.saveBusinessRecords(oldRecords,oldCatalogue)!==true)throw new Error('Retour arrière Studio non confirmé.');\n   }else{\n    if(oldRecordsRaw===null)localStorage.removeItem(DB);else localStorage.setItem(DB,oldRecordsRaw);\n    if(oldCatalogRaw===null)localStorage.removeItem(BIZCAT);else localStorage.setItem(BIZCAT,oldCatalogRaw);\n   }\n  }catch(rollbackError){window.AppForgeStudioCloudSync?.markUnlinked?.();}\n  throw new Error('Restauration locale impossible : '+e.message);\n }finally{bmSkipHook=false;}\n return true;\n}\nasync function bmToken");
// Keep the established Business Manager datasets intact, but store them inside Studio's existing state envelope.
bmScript=bmScript.replace("function storageLoad(){try{const x=JSON.parse(localStorage.getItem(DB)||'[]');records=Array.isArray(x)?x:[];}catch(e){records=[];alert('Stockage illisible. Aucune donnée n’a été effacée.');}}","function storageLoad(){try{records=window.AppForgeProjectStore?.getBusinessRecords?.()||JSON.parse(localStorage.getItem(DB)||'[]');if(!Array.isArray(records))records=[];bmStorageReady=true;const status=root.querySelector('#bmStorageStatus');if(status){status.textContent='';status.hidden=true;}}catch(e){records=[];bmStorageReady=false;const status=root.querySelector('#bmStorageStatus');if(status){status.textContent='Lecture du stockage Studio impossible : '+e.message+'. Les modifications sont bloquées pour protéger les dossiers existants.';status.hidden=false;}console.error('Stockage illisible; aucune donnée effacée.',e);}}" );
bmScript=bmScript.replace("let bizCatalogue=[];try{bizCatalogue=bizValidateCatalogue(JSON.parse(localStorage.getItem(BIZCAT)||'[]'));}catch(e){bizCatalogue=[];}","let bizCatalogue=[];try{bizCatalogue=bizValidateCatalogue(window.AppForgeProjectStore?.getBusinessCatalogue?.()||JSON.parse(localStorage.getItem(BIZCAT)||'[]'));}catch(e){bizCatalogue=[];}");
bmScript=bmScript.replaceAll("localStorage.setItem(BIZCAT,JSON.stringify(bizCatalogue))","if(!bmStorageReady)throw new Error('Lecture du stockage Studio non confirmée.');if(window.AppForgeProjectStore){if(window.AppForgeProjectStore.saveBusinessRecords(records,bizCatalogue)!==true)throw new Error('Sauvegarde du catalogue non confirmée.');}else{localStorage.setItem(BIZCAT,JSON.stringify(bizCatalogue));if(localStorage.getItem(BIZCAT)!==JSON.stringify(bizCatalogue))throw new Error('Sauvegarde du catalogue non confirmée.');}");
bmScript=bmScript.replaceAll("localStorage.setItem(BIZCAT,JSON.stringify(next))","if(!bmStorageReady)throw new Error('Lecture du stockage Studio non confirmée.');if(window.AppForgeProjectStore){if(window.AppForgeProjectStore.saveBusinessRecords(records,next)!==true)throw new Error('Sauvegarde du catalogue non confirmée.');}else{localStorage.setItem(BIZCAT,JSON.stringify(next));if(localStorage.getItem(BIZCAT)!==JSON.stringify(next))throw new Error('Sauvegarde du catalogue non confirmée.');}");
bmScript=bmScript.replace("function bizInvoicePaid(i){return (i.payments||[]).reduce((v,p)=>v+Number(p.amount),0);}","function bizInvoicePaid(i){return (i.payments||[]).filter(p=>p.status==='Vérifié manuellement').reduce((v,p)=>v+Number(p.amount||0),0);}");
bmScript=bmScript.replace("{id:bizId(),amount,reference:ref.trim(),date:bizToday(),method:'MVola',verification:'Déclaration de vérification manuelle'}","{id:bizId(),amount,reference:ref.trim(),date:bizToday(),method:'MVola',status:'Vérifié manuellement',verification:'Déclaration de vérification manuelle'}");
bmScript=bmScript.replace("localStorage.setItem(DB,encoded);\n if(localStorage.getItem(DB)!==encoded)throw new Error('Le navigateur n’a pas confirmé les données enregistrées.');","if(window.AppForgeProjectStore){if(!bmStorageReady)throw new Error('Lecture du stockage Studio non confirmée. Les modifications sont bloquées.');if(window.AppForgeProjectStore.saveBusinessRecords(records,bizCatalogue)!==true)throw new Error('AppForge Studio n’a pas confirmé la sauvegarde.');return;}\n localStorage.setItem(DB,encoded);\n if(localStorage.getItem(DB)!==encoded)throw new Error('Le navigateur n’a pas confirmé les données enregistrées.');");
// PIN UI was removed: initialize shared Studio-backed records after all module handlers are registered.
bmScript += "\nstorageLoad();render();";
const bmPage=`<section class="page" id="page-business-manager"><div id="businessManagerMount"></div></section>`;
const closeMain=studioHtml.indexOf('</main></div><div class="footer"');
if(closeMain<0)throw new Error('Studio main insertion point missing');
studioHtml=studioHtml.slice(0,closeMain)+bmPage+studioHtml.slice(closeMain);
studioHtml=studioHtml.replace('<button class="menu-toggle" id="menuToggle"','<button class="btn dark small" id="appforgeBack" type="button" aria-label="Retour">← Retour</button><button class="menu-toggle" id="menuToggle"');
const mountAnchor='const $=id=>document.getElementById(id),KEY=\'promptforge_v3_state\',defaults={projects:[],steps:Array(8).fill(false),theme:\'dark\',prompts:0,custom:[],sales:[]};let state=load(),lastPrompt=\'\',lastForm=null,activeProjectId=null;';
if(!studioHtml.includes(mountAnchor))throw new Error('Studio state anchor missing');
studioHtml=studioHtml.replace(mountAnchor,mountAnchor+`
window.AppForgeStudioState=state;state.projects=Array.isArray(state.projects)?state.projects:[];state.catalog=Array.isArray(state.catalog)?state.catalog:[];state.sales=Array.isArray(state.sales)?state.sales:[];state.clients=Array.isArray(state.clients)?state.clients:[];state.payments=Array.isArray(state.payments)?state.payments:[];state.businessRecords=Array.isArray(state.businessRecords)?state.businessRecords:[];state.businessCatalogue=Array.isArray(state.businessCatalogue)?state.businessCatalogue:[];state.businessDataMigrated=!!state.businessDataMigrated;
function migrateBusinessData(){
 if(state.businessDataMigrationV2){window.AppForgeBusinessMigrationError='';return true;}
 const fail=message=>{window.AppForgeBusinessMigrationError=message;window.AppForgeStudioCloudSync?.markUnlinked?.();return false;};
 let legacy=[],catalogue=[];
 try{
  const legacyRaw=localStorage.getItem('appforge_clientbrief_v01'),catalogueRaw=localStorage.getItem('appforge_clientbrief_catalogue_v06');
  legacy=legacyRaw?JSON.parse(legacyRaw):[];catalogue=catalogueRaw?JSON.parse(catalogueRaw):[];
  if(!Array.isArray(legacy)||!Array.isArray(catalogue))throw new Error('Les anciennes données commerciales ne sont pas au format attendu.');
 }catch(error){return fail('Migration interrompue : anciennes données illisibles. Les clés sources sont conservées; aucune donnée n’a été supprimée.');}
 let next;
 try{next=JSON.parse(JSON.stringify(state));}catch(error){return fail('Migration interrompue : l’état Studio ne peut pas être copié sans risque.');}
 next.projects=Array.isArray(next.projects)?next.projects:[];
 next.businessRecords=Array.isArray(next.businessRecords)?next.businessRecords:[];
 next.businessCatalogue=Array.isArray(next.businessCatalogue)?next.businessCatalogue:[];
 next.catalog=Array.isArray(next.catalog)?next.catalog:[];
 next.sales=Array.isArray(next.sales)?next.sales:[];
 next.clients=Array.isArray(next.clients)?next.clients:[];
 next.payments=Array.isArray(next.payments)?next.payments:[];
 const pending=[],seen=new Set();
 for(const record of [...next.businessRecords,...legacy]){
  if(!record||typeof record!=='object'||Array.isArray(record))return fail('Migration interrompue : un ancien dossier est invalide. Les données sources sont conservées.');
  const key='json:'+JSON.stringify(record);
  if(!seen.has(key)){seen.add(key);pending.push(record);}
 }
 const mergeExisting=(source,current)=>{
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  if(Array.isArray(source)&&Array.isArray(current)){
   const out=source.slice();
   for(const item of current){
    const id=item&&typeof item==='object'&&item.id!=null?String(item.id):null;
    const at=id===null?-1:out.findIndex(old=>old&&typeof old==='object'&&old.id!=null&&String(old.id)===id);
    if(at<0){if(!out.some(old=>JSON.stringify(old)===JSON.stringify(item)))out.push(item);}
    else out[at]=mergeExisting(out[at],item);
   }
   return out;
  }
  if(plain(source)&&plain(current)){
   const out={...source};
   for(const key of Object.keys(current))out[key]=Object.prototype.hasOwnProperty.call(source,key)?mergeExisting(source[key],current[key]):current[key];
   return out;
  }
  return current===undefined?source:current;
 };
 const fingerprint=value=>{const copy={...value};delete copy.studioProjectId;delete copy._appforgeLegacyMigrationKey;return JSON.stringify(copy);};
 const migrationFingerprint=value=>{const source=JSON.stringify(value);let hash=2166136261;for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}return 'legacy-'+(hash>>>0).toString(36);};
 let generated=0;
 for(const record of pending){
  const requestedId=record.studioProjectId!=null&&String(record.studioProjectId).trim()?record.studioProjectId:null;
  let project=requestedId===null?null:next.projects.find(item=>String(item.id)===String(requestedId));
  if(!project&&requestedId===null&&record.id!=null)project=next.projects.find(item=>String(item.businessManager?.id||'')===String(record.id));
  if(!project&&record.id==null){const key=migrationFingerprint(record);project=next.projects.find(item=>item._appforgeLegacyMigrationKey===key)||next.projects.find(item=>item.businessManager&&fingerprint(item.businessManager)===fingerprint(record));}
  if(!project){
   let id=requestedId===null?Date.now()+next.projects.length+generated:requestedId;
   while(next.projects.some(item=>String(item.id)===String(id)))id=Date.now()+next.projects.length+(++generated);
   project={id,name:record.project||'Projet sans nom',idea:record.problem||'',ai:'',status:record.status||'À démarrer',updated:new Date().toISOString(),form:{},prompt:'',finalPrompt:''};
   next.projects.push(project);generated++;
  }
  const incoming={...record,studioProjectId:String(project.id)};
  if(requestedId===null&&record.id==null)project._appforgeLegacyMigrationKey=migrationFingerprint(record);
  delete incoming.studioLegacyCommercial;
  const existing=project.businessManager&&typeof project.businessManager==='object'&&!Array.isArray(project.businessManager)?project.businessManager:{};
  project.businessManager=mergeExisting(incoming,existing);
  project.businessManager.studioProjectId=String(project.id);
  if(!project.name||project.name==='Projet sans nom')project.name=record.project||project.name;
  if(!project.idea)project.idea=record.problem||'';
  if(!project.status)project.status=record.status||'À démarrer';
 }
 const catalogueRows=[];
 for(const item of [...next.businessCatalogue,...catalogue]){
  const id=item&&typeof item==='object'&&item.id!=null?String(item.id):null;
  const at=id===null?-1:catalogueRows.findIndex(old=>old&&typeof old==='object'&&old.id!=null&&String(old.id)===id);
  if(at<0){if(!catalogueRows.some(old=>JSON.stringify(old)===JSON.stringify(item)))catalogueRows.push(item);}
  else catalogueRows[at]=mergeExisting(catalogueRows[at],item);
 }
 next.businessCatalogue=catalogueRows;
 next.businessRecords=[];
 next.businessDataMigrated=true;
 next.businessDataMigrationV2=true;
 let serialized,previousRaw;
 try{serialized=JSON.stringify(next);if(serialized===JSON.stringify(state)){window.AppForgeBusinessMigrationError='';return true;}previousRaw=localStorage.getItem(KEY);localStorage.setItem(KEY,serialized);if(localStorage.getItem(KEY)!==serialized)throw new Error('La vérification après écriture a échoué.');}
 catch(error){try{if(previousRaw===null)localStorage.removeItem(KEY);else if(previousRaw!==undefined)localStorage.setItem(KEY,previousRaw);}catch{}return fail('Migration interrompue : sauvegarde locale non confirmée. Les anciennes clés commerciales restent conservées; réessaie après avoir libéré de l’espace de stockage.');}
 for(const key of Object.keys(state))delete state[key];
 Object.assign(state,JSON.parse(serialized));
 window.AppForgeStudioState=state;
 window.AppForgeBusinessMigrationError='';
 window.AppForgeStudioCloudSync?.markUnlinked?.();
 return true;
}
function toBusinessRecord(project){const data=project.businessManager&&typeof project.businessManager==='object'?project.businessManager:{};return {...data,id:String(data.id||('studio-'+project.id)),studioProjectId:String(project.id),project:project.name||data.project||'Projet sans nom',problem:project.idea||data.problem||'',projectKind:data.projectKind||'personal',client:data.client||'',status:project.status||data.status||'À démarrer'};}
function saveStudioState(){localStorage.setItem(KEY,JSON.stringify(state));window.AppForgeStudioCloudSync?.localChanged();return JSON.parse(localStorage.getItem(KEY)||'{}');}
window.AppForgeProjectStore={
getBusinessRecords:(options={})=>{const migrated=migrateBusinessData();const rows=state.projects.map(project=>{const row=toBusinessRecord(project),apps=state.catalog.filter(app=>String(app.projectId||'')===String(project.id)),appIds=new Set(apps.map(app=>String(app.id))),sales=state.sales.filter(sale=>appIds.has(String(sale.applicationId))),saleIds=new Set(sales.map(sale=>String(sale.id))),clientIds=new Set(sales.map(sale=>String(sale.clientId))),studioLegacyCommercial={applications:apps.map(app=>({...app})),sales:sales.map(sale=>({...sale})),clients:state.clients.filter(client=>clientIds.has(String(client.id))).map(client=>({...client})),payments:state.payments.filter(payment=>saleIds.has(String(payment.saleId))).map(payment=>({...payment}))};row.studioLegacyCommercial=studioLegacyCommercial;return row});if(options.persist!==false&&migrated)try{saveStudioState()}catch{}return rows},
getBusinessCatalogue:()=>{migrateBusinessData();return state.businessCatalogue.slice()},
linkLegacyApplication:(applicationId,projectId)=>{try{if(!migrateBusinessData())return false;const app=state.catalog.find(item=>String(item.id)===String(applicationId)),project=state.projects.find(item=>String(item.id)===String(projectId));if(!app||!project||!toBusinessRecord(project).projectKind||toBusinessRecord(project).projectKind==='personal')return false;app.projectId=project.id;saveStudioState();return true}catch{return false}},
saveBusinessRecords:(rows,catalogue)=>{
 let previous=null,previousRaw=null;
 try{
  if(!Array.isArray(rows)||!migrateBusinessData())return false;
  previous={projects:state.projects,businessCatalogue:state.businessCatalogue,businessRecords:state.businessRecords};
  previousRaw=localStorage.getItem(KEY);
  const nextProjects=[],used=new Set();
  for(const record of rows){
   if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Dossier Business Manager invalide.');
   let existing=record.studioProjectId!=null?state.projects.find(item=>String(item.id)===String(record.studioProjectId)):null;
   if(!existing&&record.id!=null)existing=state.projects.find(item=>String(item.businessManager?.id||'')===String(record.id));
   let project=existing?{...existing}:null;
   if(!project){
    let id=record.studioProjectId!=null&&!state.projects.some(item=>String(item.id)===String(record.studioProjectId))?record.studioProjectId:Date.now()+nextProjects.length;
    while(state.projects.some(item=>String(item.id)===String(id))||used.has(String(id)))id=Number(id)+1;
    project={id,name:record.project||'Projet sans nom',idea:record.problem||'',ai:'',status:record.status||'À démarrer',updated:new Date().toISOString(),form:{},prompt:'',finalPrompt:''};
   }
   const projectId=String(project.id);
   if(used.has(projectId))throw new Error('Deux dossiers pointent vers le même projet Studio.');
   used.add(projectId);
   project.name=record.project||project.name;
   project.idea=record.problem||project.idea;
   project.status=record.status||project.status;
   project.updated=new Date().toISOString();
   const persisted=JSON.parse(JSON.stringify(record));
   delete persisted.studioLegacyCommercial;
   persisted.studioProjectId=projectId;
   project.businessManager=persisted;
   nextProjects.push(project);
  }
  state.projects=nextProjects;
  state.businessRecords=[];
  if(Array.isArray(catalogue))state.businessCatalogue=JSON.parse(JSON.stringify(catalogue));
  const stored=saveStudioState();
  if(!stored||!Array.isArray(stored.projects)||stored.projects.length!==nextProjects.length||JSON.stringify(stored.businessCatalogue||[])!==JSON.stringify(state.businessCatalogue))throw new Error('La relecture de l’état Studio n’a pas confirmé la sauvegarde.');
  return true;
 }catch(error){
  if(previous){state.projects=previous.projects;state.businessCatalogue=previous.businessCatalogue;state.businessRecords=previous.businessRecords;}
  try{if(previousRaw===null)localStorage.removeItem(KEY);else if(previousRaw!==null)localStorage.setItem(KEY,previousRaw);}catch{}
  return false;
 }
}
};`);
const runtime=`<script id="appforge-business-manager-integration">(()=>{'use strict';
const mount=document.getElementById('businessManagerMount');if(!mount)throw new Error('Business Manager mount missing');
const routeStack=[];const oldGoto=window.goto;const licensesPage=document.getElementById('page-licenses');let licenseContextId=null;const licenseContext=document.createElement('section');licenseContext.id='appforgeProjectLicenseContext';licenseContext.className='panel';licenseContext.hidden=true;licenseContext.innerHTML='<div class="head"><div><h3>Licence du projet sélectionné</h3><p class="hint" id="appforgeProjectLicenseName"></p></div><button class="btn dark small" id="appforgeProjectLicenseClose" type="button">Fermer la fiche</button></div><div class="grid2"><div><strong>Demande préparée</strong><p id="appforgeProjectLicenseRequest"></p></div><div><strong>Paiement vérifié manuellement</strong><p id="appforgeProjectLicensePayment"></p></div><div><strong>Licence émise par le serveur</strong><p id="appforgeProjectLicenseIssued"></p></div><div><strong>Droits Cloud retournés par le serveur</strong><p id="appforgeProjectLicenseCloud"></p></div></div>';licensesPage?.prepend(licenseContext);document.getElementById('appforgeProjectLicenseClose').onclick=()=>{licenseContextId=null;licenseContext.hidden=true};async function refreshProjectLicenseContext(){if(!licenseContextId){licenseContext.hidden=true;return}const project=(window.AppForgeStudioState?.projects||[]).find(p=>String(p.id)===String(licenseContextId));if(!project){licenseContext.hidden=true;return}const data=project.businessManager||{},request=data.licenseRequest||{},code=String(request.appCode||'').toUpperCase();licenseContext.hidden=false;document.getElementById('appforgeProjectLicenseName').textContent=project.name||'Projet';document.getElementById('appforgeProjectLicenseRequest').textContent=code?code+' · '+(request.plan||'Offre non définie')+' · '+(request.request||'Demande préparée, paiement non établi'):'Aucune demande préparée pour ce projet.';const crm=(data.crm?.payments||[]).filter(p=>p.status==='Vérifié manuellement');const invoicePayments=(data.business?.invoices||[]).flatMap(i=>i.payments||[]).filter(p=>p.status==='Vérifié manuellement');const confirmed=crm.reduce((n,p)=>n+(Number(p.amount)||0),0)+invoicePayments.reduce((n,p)=>n+(Number(p.amount)||0),0);document.getElementById('appforgeProjectLicensePayment').textContent=crm.length+invoicePayments.length?crm.length+invoicePayments.length+' paiement(s) confirmé(s) manuellement · '+confirmed.toLocaleString('fr-FR')+' MGA':'Aucun paiement confirmé manuellement.';const issued=document.getElementById('appforgeProjectLicenseIssued'),cloud=document.getElementById('appforgeProjectLicenseCloud'),session=window.AppForgeLicenseSession;if(!session?.token||!code){issued.textContent=code?'À vérifier dans Licences Studio (session propriétaire indisponible).':'Aucune demande préparée.';cloud.textContent='Non vérifié.';return}issued.textContent='Interrogation du Worker avec la session propriétaire Studio…';cloud.textContent='Lecture des droits serveur…';try{const response=await fetch(session.base+'/admin/licenses?productId='+encodeURIComponent(code),{headers:{Authorization:'Bearer '+session.token},cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'HTTP '+response.status);const returned=Array.isArray(result.items)?result.items:[],clientName=String(data.client||request.client||'').trim(),paymentReference=String(request.reference||'').trim();if(!clientName){issued.textContent='Client non renseigné sur cette fiche : aucune licence ne peut être attribuée au projet.';cloud.textContent='Droits Cloud non attribués à ce projet.';return}const clientLicenses=returned.filter(item=>String(item.customerName||'').trim().localeCompare(clientName,'fr',{sensitivity:'base'})===0),items=paymentReference?clientLicenses.filter(item=>String(item.paymentReference||'').trim()===paymentReference):clientLicenses;if(!items.length){issued.textContent=clientLicenses.length&&paymentReference?'Aucune licence ne correspond à la référence de demande de cette fiche.':'Aucune licence émise retournée pour ce client et ce Product ID.';cloud.textContent='Aucun droit Cloud attribué à ce projet.';return}const base=String(session.base||'').replace(/\\/+$/,'');const details=await Promise.all(items.map(async item=>{try{const r=await fetch(base+'/admin/licenses/'+encodeURIComponent(item.id)+'/cloud',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'}),rights=await r.json();if(!r.ok)throw new Error(rights.error||'HTTP '+r.status);return{item,rights}}catch(error){return{item,error}}}));issued.textContent=details.map(({item})=>[item.customerName||'Client',item.plan||'Type non retourné',item.status==='active'?'Active':item.status||'État non retourné',item.expiresAt||item.expirationDate||'Sans échéance retournée',item.id||'Identifiant non retourné'].join(' · ')).join(' | ');cloud.textContent=details.map(({item,rights,error})=>item.customerName+': '+(rights?(rights.enabled?'Autorisé':'Désactivé')+' · quota '+Math.round((rights.maxBytes||0)/1048576)+' Mo · '+(rights.requestsDay||0)+' requêtes/jour':('Non vérifié ('+(error?.message||'erreur serveur')+')'))).join(' | ')}catch(error){issued.textContent='Vérification serveur échouée : '+error.message;cloud.textContent='Non vérifié; aucun droit Cloud n’est supposé.'}}window.AppForgeStudioProjectContext={open(id){licenseContextId=String(id)}};document.getElementById('appforgeProjectLicenseClose').onclick=()=>{licenseContextId=null;licenseContext.hidden=true};window.goto=function(id){const active=document.querySelector('.page.active')?.id.replace(/^page-/,'');if(active&&active!==id)routeStack.push(active);const result=oldGoto(id);if(id==='business-manager')window.AppForgeBusinessManager?.refresh();if(id==='licenses')refreshProjectLicenseContext();return result};window.AppForgeStudioBack=()=>{const active=document.querySelector('.page.active')?.id.replace(/^page-/,'');if(active==='business-manager'&&window.AppForgeBusinessManager?.currentView?.()!=='dashboard')return window.AppForgeBusinessManager.back();return oldGoto(routeStack.pop()||'dashboard')};document.getElementById('appforgeBack')?.addEventListener('click',window.AppForgeStudioBack);window.Capacitor?.App?.addListener?.('backButton',window.AppForgeStudioBack);
const shadow=mount.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=${JSON.stringify(styleMatch[1])};
const nav=document.createElement('nav');nav.className='bm-module-nav';nav.setAttribute('aria-label','Rubriques AppForge Studio');nav.innerHTML='<button class="nav active" data-view="dashboard" type="button">Vue d’ensemble</button><button class="nav" data-view="dossiers" type="button">Projets</button><button class="nav" data-view="editor" type="button">Conception</button><button class="nav" data-view="business" type="button">Commercial</button><button class="nav" data-studio-page="licenses" type="button">Licences</button><button class="nav" data-studio-page="cloudsync" type="button">Licence &amp; Cloud</button>';
const root=document.createElement('div');root.id='bmIntegratedRoot';root.append(nav);const content=document.createElement('main');content.className='panel';content.innerHTML=${JSON.stringify(bmMarkup)};const storageStatus=document.createElement('p');storageStatus.id='bmStorageStatus';storageStatus.className='hint';storageStatus.hidden=true;storageStatus.setAttribute('role','alert');content.insertBefore(storageStatus,content.firstChild);const legacySection=content.querySelector('#business');if(legacySection){const panel=document.createElement('section');panel.className='compact-panel';panel.id='studioLegacyCommercialPanel';panel.innerHTML='<h3>Affaires historiques du Studio liées à ce projet</h3><p class="muted">Lecture des données commerciales existantes reliées par ID de projet. Ces montants historiques ne valent pas validation d’encaissement.</p><div id="studioLegacyCommercialRows" class="muted">Sélectionnez un projet client.</div><hr><h4>Anciennes affaires sans rattachement</h4><p class="muted">Choisissez explicitement le projet client à associer. Les anciennes données restent conservées dans le registre Studio.</p><div id="studioLegacyUnlinkedRows"></div>';legacySection.append(panel)}root.append(content);shadow.append(style,root);
root.querySelectorAll('.bm-module-nav [data-studio-page]').forEach(button=>button.addEventListener('click',()=>window.goto?.(button.dataset.studioPage)));
const script=document.createElement('script');script.textContent=${JSON.stringify("(()=>{const root=window.__AppForgeBusinessManagerRoot;"+bmScript+"})()")};window.__AppForgeBusinessManagerRoot=root;document.body.append(script);script.remove();if(window.AppForgeBusinessMigrationError){const migrationNotice=root.querySelector('#businessMessage');if(migrationNotice)migrationNotice.textContent=window.AppForgeBusinessMigrationError;else console.error(window.AppForgeBusinessMigrationError);}
const legacyPick=root.querySelector('#bizRecordPick'),legacyRows=root.querySelector('#studioLegacyCommercialRows'),unlinkedRows=root.querySelector('#studioLegacyUnlinkedRows');function studioProjects(){return window.AppForgeProjectStore?.getBusinessRecords?.({persist:false})||[]}function renderStudioLegacyCommercial(){if(!legacyPick||!legacyRows)return;const record=studioProjects().find(row=>String(row.id)===String(legacyPick.value)),legacy=record?.studioLegacyCommercial;if(!legacy||!legacy.sales?.length)legacyRows.textContent='Aucune ancienne affaire Studio reliée à ce projet par un ID exact.';else{const clients=new Map((legacy.clients||[]).map(item=>[String(item.id),item]));legacyRows.replaceChildren();for(const sale of legacy.sales){const app=(legacy.applications||[]).find(item=>String(item.id)===String(sale.applicationId)),client=clients.get(String(sale.clientId)),payments=(legacy.payments||[]).filter(item=>String(item.saleId)===String(sale.id)),article=document.createElement('article');article.className='list-item';const details=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=(sale.app||app?.name||'Affaire Studio')+' · '+(client?.name||sale.client||'Client historique');meta.textContent='Source Studio · affaire '+String(sale.id)+' · '+(sale.status||'statut non renseigné')+' · devis: '+(sale.quote||'—')+' · prix historique: '+(Number(sale.price)||0).toLocaleString('fr-FR')+' '+(sale.currency||'')+' · '+payments.length+' paiement(s) historique(s), non validé(s) ici';details.append(title,meta);article.append(details);legacyRows.append(article)}}}function renderStudioUnlinked(){if(!unlinkedRows)return;const projects=studioProjects().filter(item=>item.projectKind!=='personal'),state=window.AppForgeStudioState,apps=(state?.catalog||[]).filter(app=>!projects.some(project=>String(project.studioProjectId)===String(app.projectId))&&(state.sales||[]).some(sale=>String(sale.applicationId)===String(app.id)));unlinkedRows.replaceChildren();if(!apps.length){unlinkedRows.textContent='Aucune affaire Studio non rattachée.';return}for(const app of apps){const row=document.createElement('div');row.className='list-item';const label=document.createElement('strong');label.textContent=app.name+' · '+(state.sales||[]).filter(sale=>String(sale.applicationId)===String(app.id)).length+' affaire(s)';const select=document.createElement('select');select.setAttribute('aria-label','Projet client pour '+app.name);select.innerHTML='<option value="">Choisir un projet client…</option>';for(const project of projects){const option=document.createElement('option');option.value=project.studioProjectId;option.textContent=project.project;select.append(option)}const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Rattacher';button.addEventListener('click',()=>{if(!select.value){select.focus();return}if(window.AppForgeProjectStore?.linkLegacyApplication?.(app.id,select.value)){renderStudioLegacyCommercial();renderStudioUnlinked()}else alert('Le rattachement n’a pas pu être enregistré. Vérifiez le projet choisi.')});row.append(label,select,button);unlinkedRows.append(row)}}legacyPick?.addEventListener('change',renderStudioLegacyCommercial);renderStudioLegacyCommercial();renderStudioUnlinked();
})();</script>`;
studioHtml=studioHtml.slice(0,studioHtml.lastIndexOf('</body>'))+runtime+studioHtml.slice(studioHtml.lastIndexOf('</body>'));
const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
fs.writeFileSync(path.join(dist,'index.html'),studioHtml);
fs.copyFileSync(path.join(root,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(dist,'capacitor.js'));
const sdk=path.join(root,'cloud/license-worker/client/appforge-cloud-sync.js'),sdkOut=path.join(dist,'cloud/license-worker/client/appforge-cloud-sync.js');
fs.mkdirSync(path.dirname(sdkOut),{recursive:true});fs.copyFileSync(sdk,sdkOut);fs.copyFileSync(path.join(root,'cloud/license-worker/README.md'),path.join(dist,'cloud/license-worker/README.md'));
console.log('AppForge Studio Ultimate 15.8.14 : Business Manager monté dans la navigation et le stockage Studio.');
