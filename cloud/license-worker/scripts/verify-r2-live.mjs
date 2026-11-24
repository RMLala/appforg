import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';

const API = 'https://appforge-license-api.lalainaadclick.workers.dev';
const PRODUCT = 'APPFORGE-STUDIO';
const result = {
  observedAt: new Date().toISOString(),
  endpoint: API,
  productId: PRODUCT,
  mode: 'isolated server-issued 72h trial; no paid licence or MVola transaction',
  checks: {},
  cleanup: { attempted: false, complete: false },
  tokensLogged: false
};
const sqlQuote = value => "'" + String(value).replaceAll("'", "''") + "'";
const query = sql => {
  const raw = execFileSync('npx', ['wrangler', 'd1', 'execute', 'appforge-licenses', '--remote', '--json', '--command', sql], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000
  });
  return JSON.parse(raw).flatMap(item => item.results || []);
};
const call = async (path, { method = 'GET', body, token, binary, headers = {} } = {}) => {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(binary !== undefined ? { body: binary } : {}),
    signal: AbortSignal.timeout(30000)
  });
  return response;
};
const json = async response => response.json().catch(() => ({}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const installations = [
  'appforge-r2-qa-' + randomUUID(),
  'appforge-r2-other-' + randomUUID()
];
const hashes = installations.map(value => sha(Buffer.from(value, 'utf8')));
let fileId = 'r2qa_' + randomUUID().replaceAll('-', '');
let passed = false;

async function cleanupOne(hash) {
  const access = 'trial:' + hash;
  const rows = query('SELECT object_key FROM cloud_files WHERE access_id=' + sqlQuote(access) +
    ' AND product_id=' + sqlQuote(PRODUCT));
  for (const row of rows) {
    if (row.object_key) {
      execFileSync('npx', ['wrangler', 'r2', 'object', 'delete', 'appforge-cloud-files/' + row.object_key], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000
      });
    }
  }
  query('DELETE FROM cloud_files WHERE access_id=' + sqlQuote(access) + ' AND product_id=' + sqlQuote(PRODUCT));
  query('DELETE FROM cloud_usage_daily WHERE access_id=' + sqlQuote(access) + ' AND product_id=' + sqlQuote(PRODUCT));
  query('DELETE FROM trials WHERE product_id=' + sqlQuote(PRODUCT) + ' AND installation_hash=' + sqlQuote(hash));
}

try {
  const health = await call('/health');
  result.checks.health = health.status;
  if (health.status !== 200) throw new Error('Worker health check failed.');
  const config = await json(await call('/v1/config'));
  result.checks.config = config.protocol === 'appforge-license-v1' ? 'ok' : 'unexpected';
  if (config.protocol !== 'appforge-license-v1') throw new Error('Worker protocol mismatch.');

  const products = query('SELECT product_id,status FROM products WHERE product_id=' + sqlQuote(PRODUCT) +
    " AND status='active' AND product_id NOT IN (SELECT product_id FROM deleted_products)");
  if (!products.length) throw new Error('Dedicated test product APPFORGE-STUDIO is not active in production D1.');
  result.checks.productActiveInD1 = true;

  const snapshotsBefore = query('SELECT COUNT(*) AS n FROM cloud_snapshots')[0]?.n ?? 0;
  result.checks.snapshotsBefore = Number(snapshotsBefore);

  const trial = await json(await call('/v1/trial', {
    method: 'POST', body: { productId: PRODUCT, installationId: installations[0] }
  }));
  if (!trial.token) throw new Error('Worker did not issue the isolated QA trial.');
  result.checks.isolatedTrial = 'issued';

  const status = await json(await call('/v1/status', {
    method: 'POST', body: { productId: PRODUCT, installationId: installations[0], token: trial.token }
  }));
  if (!status.active) throw new Error('The isolated QA trial did not pass status verification.');
  result.checks.licenseStatus = 'active';

  const renewed = await json(await call('/v1/cloud/token', {
    method: 'POST',
    body: { productId: PRODUCT, installationId: installations[0], licenseToken: trial.token }
  }));
  if (!renewed.token) throw new Error('Cloud token renewal failed.');
  const token = renewed.token;
  result.checks.cloudTokenRenewal = 'ok';

  const quotaResponse = await call('/v1/cloud/quota', { token });
  const quota = await json(quotaResponse);
  result.checks.quotaEndpoint = quotaResponse.status;
  result.checks.r2Available = quota.r2?.available === true;
  if (quotaResponse.status !== 200 || quota.r2?.available !== true) throw new Error('R2 binding or quota is not available to the authenticated trial.');
  result.checks.r2Quota = { usedBytes: quota.r2.usedBytes, maxBytes: quota.r2.maxBytes, maxFileBytes: quota.r2.maxFileBytes };

  const payload = Buffer.from('AppForge private R2 production round-trip QA ' + randomUUID(), 'utf8');
  const expectedSha = sha(payload);
  const upload = await call('/v1/cloud/file?fileId=' + encodeURIComponent(fileId), {
    method: 'PUT', token, binary: payload,
    headers: { 'Content-Type': 'application/octet-stream', 'X-AppForge-Expected-Revision': '0' }
  });
  const uploadBody = await json(upload);
  result.checks.upload = upload.status;
  if (upload.status !== 201 || uploadBody.sha256 !== expectedSha || uploadBody.revision !== 1) throw new Error('R2 upload response or SHA-256 mismatch.');

  const download = await call('/v1/cloud/file?fileId=' + encodeURIComponent(fileId), { token });
  const downloaded = Buffer.from(await download.arrayBuffer());
  result.checks.download = download.status;
  result.checks.downloadSha256 = download.headers.get('X-AppForge-SHA256');
  result.checks.downloadRevision = download.headers.get('X-AppForge-Revision');
  if (download.status !== 200 || !downloaded.equals(payload) || result.checks.downloadSha256 !== expectedSha || result.checks.downloadRevision !== '1') {
    throw new Error('R2 downloaded bytes, revision or SHA-256 did not match the upload.');
  }
  result.checks.sha256RoundTrip = 'match';

  const conflict = await call('/v1/cloud/file?fileId=' + encodeURIComponent(fileId), {
    method: 'PUT', token, binary: Buffer.from('stale write'),
    headers: { 'Content-Type': 'application/octet-stream', 'X-AppForge-Expected-Revision': '0' }
  });
  result.checks.staleRevisionConflict = conflict.status;
  if (conflict.status !== 409) throw new Error('Stale revision was not rejected with HTTP 409.');

  const list = await json(await call('/v1/cloud/files', { token }));
  result.checks.fileListed = Array.isArray(list.items) && list.items.some(item => item.fileId === fileId);
  if (!result.checks.fileListed) throw new Error('Uploaded file is missing from the authenticated file list.');

  const otherTrial = await json(await call('/v1/trial', {
    method: 'POST', body: { productId: PRODUCT, installationId: installations[1] }
  }));
  if (!otherTrial.token) throw new Error('Second isolated trial could not be issued.');
  const otherRenewed = await json(await call('/v1/cloud/token', {
    method: 'POST',
    body: { productId: PRODUCT, installationId: installations[1], licenseToken: otherTrial.token }
  }));
  if (!otherRenewed.token) throw new Error('Second isolated Cloud token could not be issued.');
  const isolatedRead = await call('/v1/cloud/file?fileId=' + encodeURIComponent(fileId), { token: otherRenewed.token });
  const isolatedList = await json(await call('/v1/cloud/files', { token: otherRenewed.token }));
  result.checks.crossTrialFileRead = isolatedRead.status;
  result.checks.crossTrialListCount = isolatedList.items?.length ?? null;
  if (isolatedRead.status !== 404 || (isolatedList.items || []).length !== 0) throw new Error('R2 file isolation between trial installations failed.');

  const unauthenticated = await call('/v1/cloud/file?fileId=' + encodeURIComponent(fileId));
  result.checks.unauthenticatedRead = unauthenticated.status;
  if (unauthenticated.status !== 401) throw new Error('Unauthenticated R2 read was not rejected.');

  const snapshotsAfter = query('SELECT COUNT(*) AS n FROM cloud_snapshots')[0]?.n ?? 0;
  result.checks.snapshotsAfter = Number(snapshotsAfter);
  if (Number(snapshotsAfter) !== Number(snapshotsBefore)) throw new Error('R2 QA unexpectedly changed D1 cloud snapshots.');
  passed = true;
} catch (error) {
  result.error = error.message;
} finally {
  result.cleanup.attempted = true;
  try {
    for (const hash of hashes) cleanupOne(hash);
    result.cleanup.complete = true;
  } catch (error) {
    result.cleanup.error = error.message;
  }
  result.passed = passed && result.cleanup.complete;
  fs.mkdirSync('qa', { recursive: true });
  fs.writeFileSync('qa/r2-live-production.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
if (!result.passed) process.exitCode = 1;
