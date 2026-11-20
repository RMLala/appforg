import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { r2Files, r2Usage, r2Limits } from './r2-files.js';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const cloud = { product:'APPFORGE-STUDIO', access:'trial:abc', scope:'trial' };
function fixture({ quota = 100, fileLimit = 100 } = {}) {
  const rows = new Map(), objects = new Map();
  const bucket = {
    put: async (key,body) => { objects.set(key, new Uint8Array(body)); },
    get: async key => objects.has(key) ? {body:objects.get(key)} : null,
    delete: async key => {objects.delete(key);}
  };
  const db = {
    prepare(sql) {
      const stmt = { args:[], bind(...args){this.args=args;return this;},
        async first(){
          if (sql.includes('SELECT object_key AS objectKey')){
            const [access,product,id]=this.args;
            const row=rows.get(`${access}:${product}:${id}`);return row ? {...row} : null;
          }
          if (sql.includes('SELECT COALESCE(SUM(size_bytes),0)')) {
            const [access,product]=this.args;
            const data=[...rows.values()].filter(x=>x.access===access&&x.product===product);
            return { usedBytes:data.reduce((n,x)=>n+x.sizeBytes,0),fileCount:data.length };
          }
          throw Error('Unexpected first: '+sql);
        },
        async all(){
          if(!sql.includes('FROM cloud_files'))throw Error('Unexpected all');
          const [access,product]=this.args;
          return {results:[...rows.values()].filter(x=>x.access===access&&x.product===product).map(x=>({fileId:x.fileId,revision:x.revision,sizeBytes:x.sizeBytes,sha256:x.sha256,createdAt:x.createdAt,updatedAt:x.updatedAt}))};
        },
        async run(){
          if(sql.includes('INSERT OR IGNORE INTO cloud_files')){
            const [access,product,fileId,objectKey,revision,sizeBytes,sha256,createdAt,updatedAt]=this.args;
            const k=`${access}:${product}:${fileId}`, used=[...rows.values()].filter(x=>x.access===access&&x.product===product).reduce((s,x)=>s+x.sizeBytes,0);
            if(rows.has(k)||used+sizeBytes>quota)return {meta:{changes:0}};
            rows.set(k,{access,product,fileId,objectKey,revision,sizeBytes,sha256,createdAt,updatedAt});return {meta:{changes:1}};
          }
          if(sql.includes('UPDATE cloud_files')){
            const [objectKey,revision,sizeBytes,sha256,updatedAt,access,product,fileId,expected]=this.args;
            const k=`${access}:${product}:${fileId}`, prev=rows.get(k);
            const used=[...rows.values()].filter(x=>x.access===access&&x.product===product).reduce((s,x)=>s+x.sizeBytes,0);
            if(!prev||prev.revision!==expected||used-prev.sizeBytes+sizeBytes>quota)return {meta:{changes:0}};
            rows.set(k,{...prev,objectKey,revision,sizeBytes,sha256,updatedAt});return {meta:{changes:1}};
          }
          throw Error('Unexpected run: '+sql);
        }
      };return stmt;
    }
  };
  const env={ DB:db,FILE_BUCKET:bucket,R2_TRIAL_MAX_BYTES:String(quota),R2_MAX_FILE_BYTES:String(fileLimit) };
  return {env,rows,objects};
}
function req(method, content, revision) {
  return new Request('https://example.workers.dev/v1/cloud/file?fileId=backup', {
    method, headers: revision===undefined?{}:{'X-AppForge-Expected-Revision':String(revision)},
    ...(content===undefined?{}:{body:content})
  });
}
const url='https://example.workers.dev/v1/cloud/file?fileId=backup';

test('R2 is unavailable without a private binding', async()=>{
  const f=fixture();delete f.env.FILE_BUCKET;
  assert.equal((await r2Files(req('GET'),f.env,new URL(url),cloud)).status,503);
  assert.equal((await r2Usage(f.env,cloud)).available,false);
});
test('upload, list, stream, revision conflict and replacement preserve isolation',async()=>{
  const f=fixture();
  const first=await r2Files(req('PUT','hello',0),f.env,new URL(url),cloud);
  assert.equal(first.status,201);assert.equal((await first.json()).revision,1);
  const read=await r2Files(req('GET'),f.env,new URL(url),cloud);
  assert.equal(read.headers.get('X-AppForge-Revision'),'1');assert.equal(await read.text(),'hello');
  const list=await r2Files(new Request('https://example.workers.dev/v1/cloud/files'),f.env,new URL('https://example.workers.dev/v1/cloud/files'),cloud);
  assert.equal((await list.json()).items.length,1);
  const conflict=await r2Files(req('PUT','wrong',0),f.env,new URL(url),cloud);
  assert.equal(conflict.status,409);
  const other=await r2Files(req('GET'),f.env,new URL(url),{...cloud,access:'trial:different'});
  assert.equal(other.status,404);
  const next=await r2Files(req('PUT','new',1),f.env,new URL(url),cloud);
  assert.equal(next.status,200);assert.equal((await next.json()).revision,2);
  assert.equal(f.objects.size,1);assert.equal((await r2Usage(f.env,cloud)).usedBytes,3);
});
test('quota rejection does not lose previous file or create orphan objects',async()=>{
  const f=fixture({quota:5});
  assert.equal((await r2Files(req('PUT','hello',0),f.env,new URL(url),cloud)).status,201);
  assert.equal((await r2Files(req('PUT','exceeds',1),f.env,new URL(url),cloud)).status,413);
  assert.equal(f.objects.size,1);
  assert.equal(await (await r2Files(req('GET'),f.env,new URL(url),cloud)).text(),'hello');
});
test('body cap, empty body and revision header are validated',async()=>{
  const f=fixture({quota:100,fileLimit:3});
  assert.equal((await r2Files(req('PUT','hello',0),f.env,new URL(url),cloud)).status,413);
  assert.equal((await r2Files(req('PUT','',0),f.env,new URL(url),cloud)).status,400);
  assert.equal((await r2Files(req('PUT','abc'),f.env,new URL(url),cloud)).status,400);
  assert.equal(f.objects.size,0);
  assert.equal(r2Limits(f.env,'trial').maxFileBytes,3);
});