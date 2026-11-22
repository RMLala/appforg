import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const {default:worker}=await import('../src/index.js');

// Base SQLite synthétique : mêmes migrations que la production, en option limitées (ex. sans 0008).
async function fixture({upTo=Infinity, r2=false}={}){
  const sql=new DatabaseSync(':memory:');
  const dir=new URL('../migrations/',import.meta.url);
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
    const n=Number(file.slice(0,4)); if(n>upTo) continue;
    sql.exec(fs.readFileSync(new URL(file,dir),'utf8'));
  }
  const DB={prepare(q){let b=[];return{bind(...v){b=v;return this},async first(){return sql.prepare(q).get(...b)||null},async all(){return{results:sql.prepare(q).all(...b)}},async run(){return{meta:{changes:Number(sql.prepare(q).run(...b).changes)}}}}},async batch(items){return Promise.all(items.map(x=>x.run()))}};
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const env={DB,ADMIN_API_TOKEN:'synthetic-admin-'+crypto.randomUUID(),CODE_HASH_PEPPER:crypto.randomUUID(),DAILY_API_LIMIT:'50000',LICENSE_SIGNING_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',keys.privateKey))};
  if(r2) env.FILE_BUCKET={get(){},put(){}};
  const call=async(path,method='GET',body,token)=>{const r=await worker.fetch(new Request('https://qa.test'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()}};
  const admin=(p,m,b)=>call(p,m,b,env.ADMIN_API_TOKEN);
  await admin('/admin/apps','POST',{productId:'QA-QUOTA',name:'Synthetic quota fixture'});
  return{sql,call,admin,env};
}
const counts=(sql)=>['licenses','activations','cloud_snapshots','cloud_usage_daily','usage_daily','products'].map(t=>sql.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n).join(',')+'|'+sql.prepare('SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) n FROM cloud_snapshots').get().n;

test('GET /admin/quotas exige le jeton administrateur existant',async()=>{
  const s=await fixture();try{
    assert.equal((await s.call('/admin/quotas')).status,401);
    assert.equal((await s.call('/admin/quotas','GET',null,'mauvais-jeton')).status,401);
  }finally{s.sql.close();}
});

test('GET /admin/quotas : format attendu par AppForge Studio et aucune écriture',async()=>{
  const s=await fixture({r2:true});try{
    const before=counts(s.sql);
    const r=await s.admin('/admin/quotas');
    assert.equal(r.status,200);
    const b=r.body;
    assert.equal(b.ok,true); assert.match(b.day,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof b.api.totalRequests,'number'); assert.equal(typeof b.api.softLimit,'number');
    assert.equal(typeof b.cloud.requestsToday,'number');
    assert.equal(typeof b.storage.usedBytes,'number'); assert.equal(typeof b.storage.snapshots,'number');
    assert.ok(Array.isArray(b.licenses));
    assert.equal(b.r2.available,true); assert.equal(b.r2.usedBytes,0); assert.equal(b.r2.fileCount,0);
    assert.equal(counts(s.sql),before,'GET /admin/quotas ne doit rien écrire');
  }finally{s.sql.close();}
});

test('GET /admin/quotas : table cloud_files absente (migration 0008 non appliquée) → réponse structurée, pas d’erreur 500',async()=>{
  const s=await fixture({upTo:7,r2:true});try{
    const r=await s.admin('/admin/quotas');
    assert.equal(r.status,200);
    assert.equal(r.body.r2.available,false);
    assert.equal(r.body.r2.reason,'table_unavailable');
  }finally{s.sql.close();}
});

test('GET /admin/quotas : R2 non lié → reason not_configured',async()=>{
  const s=await fixture();try{
    const r=await s.admin('/admin/quotas');
    assert.equal(r.body.r2.reason,'not_configured');
  }finally{s.sql.close();}
});

test('GET /admin/quotas reflète une licence réelle avec Cloud et sauvegarde',async()=>{
  const s=await fixture();try{
    const lic=await s.admin('/admin/licenses','POST',{productId:'QA-QUOTA',customerName:'Synthetic QA client',paymentReference:'SYNTHETIC-NOT-MVOLA',paymentConfirmed:true,plan:'annual',maxDevices:1});
    assert.equal(lic.status,201);
    const act=await s.call('/v1/activate','POST',{productId:'QA-QUOTA',code:lic.body.code,installationId:'synthetic-quota-device-001'});
    assert.equal(act.status,200);
    assert.equal((await s.admin('/admin/licenses/'+lic.body.id+'/cloud','PATCH',{enabled:true,maxBytes:10485760,requestsDay:1000})).status,200);
    const put=await s.call('/v1/cloud/snapshot?resource=default','PUT',{expectedRevision:0,snapshot:{data:'x'.repeat(700)}},act.body.cloudAccess.token);
    assert.equal(put.status,200);
    await s.call('/v1/cloud/snapshot?resource=default','GET',null,act.body.cloudAccess.token);
    const q=(await s.admin('/admin/quotas')).body;
    assert.equal(q.storage.snapshots,1);
    assert.ok(q.storage.usedBytes>=700);
    assert.equal(q.cloud.requestsToday,2);
    const row=q.licenses.find(x=>x.id===lic.body.id);
    assert.ok(row,'la licence doit apparaître');
    assert.equal(row.requestsDay,1000); assert.equal(row.maxBytes,10485760);
    assert.equal(row.requestsToday,2); assert.ok(row.usedBytes>=700);
    assert.ok(!JSON.stringify(q).includes('code_hash')); assert.ok(!JSON.stringify(q).includes(lic.body.code));
  }finally{s.sql.close();}
});

test('GET /admin/usage inchangé',async()=>{
  const s=await fixture();try{
    const r=await s.admin('/admin/usage');
    assert.equal(r.status,200);
    assert.deepEqual(Object.keys(r.body).sort(),['activationRequests','day','softLimit','statusRequests','totalRequests','trialRequests']);
  }finally{s.sql.close();}
});
