const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./appforge-cloud-sync.js');

function fixture({ remote = null, onInitialRemote, onConflict, onLicenseRevoked } = {}) {
  const statusResult = { active: true };
  const db = new Map();
  const calls = [];
  const local = { records: [{ id: 'a', value: 10 }] };
  let serverSnapshot = remote;
  let revision = remote ? 1 : 0;
  const store = { get: async k => db.get(k) ?? null, set: async (k,v) => db.set(k,v), remove: async k => db.delete(k) };
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname + new URL(url).search;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method: init.method || 'GET', body, headers: init.headers || {} });
    if (path.endsWith('/v1/activate')) return response({ token: 'license-signed', cloudAccess: { token: 'cloud-signed', expiresAt: new Date(Date.now()+3600000).toISOString() } });
    if (path.endsWith('/v1/status')) return statusResult.active ? response({ active: true }) : response({ active: false, revoked: true, error: 'Cette licence a été révoquée.' }, 403);
    if (path.endsWith('/v1/cloud/token')) return response({ token: 'renewed-cloud', expiresAt: new Date(Date.now()+3600000).toISOString() });
    if (path.includes('/v1/cloud/snapshot') && (init.method || 'GET') === 'GET') return response({ revision, snapshot: serverSnapshot });
    if (path.includes('/v1/cloud/snapshot') && init.method === 'PUT') {
      if (body.expectedRevision !== revision) return response({ conflict: true, revision, snapshot: serverSnapshot }, 409);
      serverSnapshot = body.snapshot; revision += 1;
      return response({ revision });
    }
    throw new Error('Unexpected request: ' + path);
  };
  const client = create({
    apiBase: 'https://licenses.example.workers.dev',
    productId: 'DEMO_APP',
    store, fetch, isOnline: () => true,
    data: { getSnapshot: async () => local, applySnapshot: async data => Object.assign(local, data) },
    onInitialRemote, onConflict, onLicenseRevoked
  });
  return { client, calls, db, local, revoke(){statusResult.active=false;}, get serverSnapshot(){return serverSnapshot}, get revision(){return revision} };
}
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }

test('activation provisions Cloud and uploads local data without account fields', async () => {
  const f = fixture();
  const activated = await f.client.activate('APF-ABCDE-ABCDE-ABCDE-ABCDE');
  assert.equal(activated.sync.state, 'synced');
  assert.equal(f.calls[0].path, '/v1/activate');
  assert.deepEqual(Object.keys(f.calls[0].body).sort(), ['code','installationId','productId']);
  assert.equal(f.calls.some(x => x.path.includes('login') || x.path.includes('session') || x.path.includes('organizations')), false);
  assert.equal(f.calls.at(-1).method, 'PUT');
  assert.equal(f.calls.at(-1).headers.Authorization, 'Bearer cloud-signed');
  assert.deepEqual(f.serverSnapshot, f.local);
});

test('existing server data is surfaced for a choice instead of overwriting local data', async () => {
  let choicePayload;
  const remote = { records: [{ id: 'remote', value: 99 }] };
  const f = fixture({ remote, onInitialRemote: async value => { choicePayload = value; return undefined; } });
  const activated = await f.client.activate('APF-ABCDE-ABCDE-ABCDE-ABCDE');
  assert.equal(activated.sync.state, 'remote-available');
  assert.equal(choicePayload.remote.records[0].id, 'remote');
  assert.equal(f.calls.some(x => x.method === 'PUT'), false);
  assert.equal(f.local.records[0].id, 'a');
});

test('concurrent local and remote changes report a conflict without writing', async () => {
  const f = fixture();
  await f.client.activate('APF-ABCDE-ABCDE-ABCDE-ABCDE');
  f.local.records.push({ id: 'local', value: 20 });
  f.calls.length = 0;
  // Another authorized device changed the server copy and revision.
  const originalFetch = f.client.fetcher;
  f.client.fetcher = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/v1/cloud/snapshot' && (init.method || 'GET') === 'GET') return response({ revision: 2, snapshot: { records: [{ id: 'other-device', value: 30 }] } });
    return originalFetch(url, init);
  };
  const result = await f.client.sync();
  assert.equal(result.state, 'conflict');
  assert.equal(f.calls.some(x => x.method === 'PUT'), false);
});

test('a write race offers the fresh server copy to the conflict handler', async () => {
  let prompted = false;
  const f = fixture({ onConflict: async ({ raced, remote }) => {
    prompted = raced === true && remote.records[0].id === 'newer-device';
    return 'remote';
  } });
  const originalFetch = f.client.fetcher;
  let firstWrite = true;
  f.client.fetcher = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/v1/cloud/snapshot' && init.method === 'PUT' && firstWrite) {
      firstWrite = false;
      return response({ conflict: true, revision: 1, snapshot: { records: [{ id: 'newer-device', value: 50 }] } }, 409);
    }
    return originalFetch(url, init);
  };
  const activated = await f.client.activate('APF-ABCDE-ABCDE-ABCDE-ABCDE');
  assert.equal(prompted, true);
  assert.equal(activated.sync.direction, 'download');
  assert.equal(f.local.records[0].id, 'newer-device');
});

test('a revoked license is invalidated on the next online check without deleting local data', async () => {
  let revokedNotice;
  const f = fixture({ onLicenseRevoked: detail => { revokedNotice = detail; } });
  await f.client.activate('APF-ABCDE-ABCDE-ABCDE-ABCDE');
  f.revoke();
  f.calls.length = 0;
  const result = await f.client.start();
  assert.equal(result.state, 'revoked');
  assert.equal(f.calls[0].path, '/v1/status');
  assert.equal(f.calls.some(call => call.path.includes('/v1/cloud/snapshot')), false);
  assert.equal(revokedNotice.preserveLocalData, true);
  assert.deepEqual(f.local.records, [{ id: 'a', value: 10 }]);
  const record = JSON.parse(f.db.get('appforge-cloud-entitlement-v1:DEMO_APP'));
  assert.equal(record.licenseToken, '');
  assert.equal(record.cloudToken, '');
});
