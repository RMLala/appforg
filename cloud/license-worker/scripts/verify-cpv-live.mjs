// Real server observation + isolated, server-issued trial. No admin API secret is used.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const base='https://appforge-license-api.lalainaadclick.workers.dev';const result={observedAt:new Date().toISOString(),endpoint:base,productD1Verified:false,authenticatedSyncVerified:false,kind:'server-issued isolated trial; no MVola payment',checks:{},remaining:['Paid-code activation and paid-license revocation need a valid test code from the license manager','Physical Android multi-device validation']};
const query=sql=>{const raw=execFileSync('npx',['wrangler','d1','execute','appforge-licenses','--remote','--json','--command',sql],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});const data=JSON.parse(raw);return data.flatMap(x=>x.results||[])};
const call=async(path,method='GET',body,token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});return{status:r.status,body:await r.json().catch(()=>({}))}};
let ownHash='',product='';
try{
 const health=await call('/health'),config=await call('/v1/config');result.checks.health=health.status;result.checks.config=config.status;assert.equal(health.status,200);assert.equal(config.body.protocol,'appforge-license-v1');
 if(!process.env.CLOUDFLARE_API_TOKEN||process.env.CLOUDFLARE_ACCOUNT_ID!=='950250f745ef2c98e286b9b120a6cae4')throw Error('Authorized canonical D1 credentials unavailable');
 let products=query("SELECT product_id,name,status FROM products WHERE upper(product_id) LIKE '%CPV%' OR lower(name) LIKE '%hebdo%' OR lower(name) LIKE '%parole%'");result.productCandidates=products;
 if(products.length===0){query("INSERT OR IGNORE INTO products(product_id,name,status,created_at) VALUES('CPV-HEBDO','CPV Rapport Hebdo','active',CURRENT_TIMESTAMP)");result.productRegisteredForExistingApp=true;products=query("SELECT product_id,name,status FROM products WHERE product_id='CPV-HEBDO'");result.productCandidates=products;}
 const selected=products.find(x=>x.product_id==='CPV-HEBDO')||products.filter(x=>/hebdo/i.test(x.name)).filter(x=>!/convention/i.test(x.name))[0];if(!selected)throw Error('CPV weekly product not found in D1');product=selected.product_id;result.productId=product;result.productD1Verified=true;assert.equal(selected.status,'active');
 const installationId='cpv-live-qa-'+crypto.randomUUID();ownHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(installationId))).toString('hex');
 const trial=await call('/v1/trial','POST',{productId:product,installationId});result.checks.realTrialIssuance=trial.status;assert.equal(trial.status,200);assert.ok(trial.body.token&&trial.body.cloudAccess?.token);
 const status=await call('/v1/status','POST',{productId:product,installationId,token:trial.body.token});result.checks.realStatus=status.status;assert.equal(status.body.active,true);
 const renew=await call('/v1/cloud/token','POST',{productId:product,installationId,licenseToken:trial.body.token});result.checks.realRenewal=renew.status;assert.equal(renew.status,200);assert.ok(renew.body.token);
 const forbidden=await call('/v1/cloud/token','POST',{productId:product,installationId:'cpv-other-'+crypto.randomUUID(),licenseToken:trial.body.token});result.checks.wrongDevice=forbidden.status;assert.equal(forbidden.status,403);
 const resource='default',path='/v1/cloud/snapshot?resource='+resource,token=renew.body.token;const initial=await call(path,'GET',null,token);assert.equal(initial.status,200);assert.equal(initial.body.revision,0);
 const snapshot={schema:'cpv-live-verification',marker:crypto.randomUUID(),value:17};const write=await call(path,'PUT',{expectedRevision:0,snapshot},token);result.checks.authenticatedPut=write.status;assert.equal(write.status,200);
 const read=await call(path,'GET',null,token);result.checks.authenticatedGet=read.status;assert.equal(read.status,200);assert.deepEqual(read.body.snapshot,snapshot);result.authenticatedSyncVerified=true;
 const conflict=await call(path,'PUT',{expectedRevision:0,snapshot:{value:18}},token);result.checks.staleRevision=conflict.status;assert.equal(conflict.status,409);
 query("UPDATE trials SET expires_at='2020-01-01T00:00:00Z' WHERE product_id='"+product.replaceAll("'","''")+"' AND installation_hash='"+ownHash+"'");
 const expired=await call(path,'GET',null,token);result.checks.realExpiredTrial=expired.status;assert.equal(expired.status,403);
 result.completeForTrialContract=true;
}catch(e){result.error=e.message.startsWith('CPV')||e.message.startsWith('Authorized')?e.message:'A live verification step failed; no credential or response token is logged';result.completeForTrialContract=false;}
finally{
 if(ownHash&&product){try{const scoped="access_id='trial:"+ownHash+"' AND product_id='"+product.replaceAll("'","''")+"'";query('DELETE FROM cloud_snapshots WHERE '+scoped);query('DELETE FROM cloud_usage_daily WHERE '+scoped);result.syntheticSnapshotCleanup=true;}catch{result.syntheticSnapshotCleanup=false;}}
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/cpv-live-worker.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
