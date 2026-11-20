const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'modules/business-manager/index.html');

test('Business Manager packaging remains optional and isolated',()=>{
 const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
 assert.match(build,/fs\\.existsSync\\(businessSource\\)/);
 assert.ok(build.includes("dist','modules/business-manager/index.html"));
 assert.ok(build.includes('Invalid Business Manager HTML source'));
 assert.ok(build.includes('ultimate-business-launcher'));
});

test('Business Manager source is valid and does not contain obvious embedded secrets',()=>{
 if(!fs.existsSync(source))return;
 const html=fs.readFileSync(source,'utf8');
 assert.match(html,/<html[\\s>]/i);
 assert.match(html,/<\\/html>/i);
 assert.doesNotMatch(html,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
 assert.doesNotMatch(html,/CLOUDFLARE_API_TOKEN\\s*[:=]\\s*['\"][^'\"]+['\"]/i);
});
