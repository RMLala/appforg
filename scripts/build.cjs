const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const source=path.join(root,'AppForge_Studio_V15_7_Questionnaire_Client.html');const html=fs.readFileSync(source,'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');const prompti=fs.readFileSync(path.join(root,'PromptiPro.html'),'utf8').replace('</head>','<script src="capacitor.js"></script><script>if(window.Capacitor?.registerPlugin)document.documentElement.style.visibility="hidden"</script></head>');fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist','index.html'),html);fs.writeFileSync(path.join(root,'dist','PromptiPro.html'),prompti);fs.copyFileSync(path.join(root,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(root,'dist','capacitor.js'));const sdk=path.join(root,'cloud/license-worker/client/appforge-cloud-sync.js'),sdkOut=path.join(root,'dist','cloud/license-worker/client/appforge-cloud-sync.js');fs.mkdirSync(path.dirname(sdkOut),{recursive:true});fs.copyFileSync(sdk,sdkOut);fs.copyFileSync(path.join(root,'cloud/license-worker/README.md'),path.join(root,'dist','cloud/license-worker/README.md'));
// Business Manager remains a separate offline-first HTML module. Never copy user data.
const businessSource=path.join(root,'modules/business-manager/index.html');
if(fs.existsSync(businessSource)){
  const businessHtml=fs.readFileSync(businessSource,'utf8');
  if(!businessHtml.includes('<html')||!businessHtml.includes('</html>'))throw new Error('Invalid Business Manager HTML source');
  const businessDest=path.join(root,'dist','modules/business-manager/index.html');
  fs.mkdirSync(path.dirname(businessDest),{recursive:true});
  // Only the packaged copy gets a way back to Studio; standalone source stays unchanged.
  const businessMenuAnchor='<div class="bm-more-menu hidden" id="bmMoreMenu" role="menu">';
  if(!businessHtml.includes(businessMenuAnchor))throw new Error('Business Manager navigation anchor missing');
  const studioReturn='<a id="ultimate-studio-home" href="../../index.html" role="menuitem" style="display:block;padding:11px 12px;color:inherit;text-decoration:none;font-size:13px">✦ AppForge Studio</a>';
  const bundledBusinessHtml=businessHtml.replace(businessMenuAnchor,businessMenuAnchor+studioReturn);
  fs.writeFileSync(businessDest,bundledBusinessHtml);
  // Add an accessible entry only when the actual module is packaged.
  const studioIndex=path.join(root,'dist','index.html');
  const studioHtml=fs.readFileSync(studioIndex,'utf8');
  // Insert a normal sidebar destination, not a floating overlay that hides content.
  const launchMarkup='<div class="nav-label" id="ultimate-business-label">BUSINESS MANAGER</div><a id="ultimate-business-launcher" href="modules/business-manager/index.html" style="display:flex;align-items:center;min-height:44px;padding:10px 12px;border-radius:10px;color:var(--t);text-decoration:none;font-size:12px">▣ &nbsp; Business Manager</a>';
  const navAnchor='<aside class="nav" id="mainNav" aria-label="Menu principal">';
  if(!studioHtml.includes(navAnchor))throw new Error('Studio navigation anchor missing: refusing incomplete integration');
  if(!studioHtml.includes('id="ultimate-business-launcher"'))fs.writeFileSync(studioIndex,studioHtml.replace(navAnchor,navAnchor+launchMarkup));
  if(!fs.existsSync(businessDest))throw new Error('Business Manager missing from build output');
}else{
  console.log('Ultimate: Business Manager module not yet present; existing Studio build preserved.');
}console.log('AppForge Studio 15.8.8 : HTML Android et PromptiPro prêts.');
