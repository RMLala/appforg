const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'modules/business-manager/index.html');

test('Business Manager module is optional and cannot break existing Studio',()=>{
  const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
  assert.match(build,/fs\.existsSync\(businessSource\)/);
  assert.match(build,/dist','modules\/business-manager\/index\.html/);
  assert.match(build,/Invalid Business Manager HTML source/);
});

test('Business Manager source, if supplied, has an HTML document and no embedded obvious secrets',()=>{
  if(!fs.existsSync(source))return;
  const html=fs.readFileSync(source,'utf8');
  assert.match(html,/<html[\\s>]/i);
  assert.match(html,/<\\/html>/i);
  assert.doesNotMatch(html,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(html,/CLOUDFLARE_API_TOKEN\\s*[:=]\\s*['\"][^'\"]+['\"]/i);
});
