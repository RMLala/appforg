const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const source=path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html');const html=fs.readFileSync(source,'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');const prompti=fs.readFileSync(path.join(root,'PromptiPro.html'),'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist','index.html'),html);fs.writeFileSync(path.join(root,'dist','PromptiPro.html'),prompti);fs.copyFileSync(path.join(root,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(root,'dist','capacitor.js'));const sdk=path.join(root,'cloud/license-worker/client/appforge-cloud-sync.js'),sdkOut=path.join(root,'dist','cloud/license-worker/client/appforge-cloud-sync.js');fs.mkdirSync(path.dirname(sdkOut),{recursive:true});fs.copyFileSync(sdk,sdkOut);fs.copyFileSync(path.join(root,'cloud/license-worker/README.md'),path.join(root,'dist','cloud/license-worker/README.md'));
// Business Manager remains a separate offline-first HTML module. Never copy user data.
const businessSource=path.join(root,'modules/business-manager/index.html');
if(fs.existsSync(businessSource)){
  const businessHtml=fs.readFileSync(businessSource,'utf8');
  if(!businessHtml.includes('<html')||!businessHtml.includes('</html>'))throw new Error('Invalid Business Manager HTML source');
  const businessDest=path.join(root,'dist','modules/business-manager/index.html');
  fs.mkdirSync(path.dirname(businessDest),{recursive:true});
  fs.writeFileSync(businessDest,businessHtml);
  console.log('Ultimate: Business Manager module included (no data migration).');
}else{
  console.log('Ultimate: Business Manager module not yet present; existing Studio build preserved.');
}console.log('AppForge Studio 15.8.8 : HTML Android et PromptiPro prêts.');
