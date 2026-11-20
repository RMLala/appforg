const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const source=path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html');const html=fs.readFileSync(source,'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');const prompti=fs.readFileSync(path.join(root,'PromptiPro.html'),'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist','index.html'),html);fs.writeFileSync(path.join(root,'dist','PromptiPro.html'),prompti);fs.copyFileSync(path.join(root,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(root,'dist','capacitor.js'));const sdk=path.join(root,'cloud/license-worker/client/appforge-cloud-sync.js'),sdkOut=path.join(root,'dist','cloud/license-worker/client/appforge-cloud-sync.js');fs.mkdirSync(path.dirname(sdkOut),{recursive:true});fs.copyFileSync(sdk,sdkOut);fs.copyFileSync(path.join(root,'cloud/license-worker/README.md'),path.join(root,'dist','cloud/license-worker/README.md'));
// Business Manager remains a separate offline-first HTML module. Never copy user data.
const businessSource=path.join(root,'modules/business-manager/index.html');
if(fs.existsSync(businessSource)){
  const businessHtml=fs.readFileSync(businessSource,'utf8');
  if(!businessHtml.includes('<html')||!businessHtml.includes('</html>'))throw new Error('Invalid Business Manager HTML source');
  const businessDest=path.join(root,'dist','modules/business-manager/index.html');
  fs.mkdirSync(path.dirname(businessDest),{recursive:true});
  fs.writeFileSync(businessDest,businessHtml);
  // Add an accessible entry only when the actual module is packaged.
  const studioIndex=path.join(root,'dist','index.html');
  const studioHtml=fs.readFileSync(studioIndex,'utf8');
  const launchMarkup='<nav id="ultimate-business-launcher" aria-label="AppForge Ultimate" style="position:fixed;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000"><a href="modules/business-manager/index.html" style="display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border-radius:22px;background:#272c57;color:#fff;font:600 14px system-ui;text-decoration:none;box-shadow:0 3px 18px #0006">Business Manager</a></nav>';
  if(!studioHtml.includes('id="ultimate-business-launcher"'))fs.writeFileSync(studioIndex,studioHtml.replace(/<\\/body>/i,launchMarkup+'</body>'));
  console.log('Ultimate: Business Manager module included (no data migration).');
}else{
  console.log('Ultimate: Business Manager module not yet present; existing Studio build preserved.');
}console.log('AppForge Studio 15.8.8 : HTML Android et PromptiPro prêts.');
