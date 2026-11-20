// Cloudflare R2 object store for binary backups. All access is authorized upstream.
// D1 holds only metadata and opaque R2 keys; no public bucket access or credentials.
const encoder = new TextEncoder();
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'X-AppForge-Revision, X-AppForge-SHA256, Content-Length',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
});
const validFileId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const positiveLimit = (value, fallback) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
};
export function r2Limits(env, scope) {
  const maxFileBytes = Math.min(25 * 1024 * 1024, positiveLimit(env.R2_MAX_FILE_BYTES, 10 * 1024 * 1024));
  const maxBytes = scope === 'trial'
    ? positiveLimit(env.R2_TRIAL_MAX_BYTES, 20 * 1024 * 1024)
    : positiveLimit(env.R2_MAX_ACCESS_BYTES, 100 * 1024 * 1024);
  return { maxBytes, maxFileBytes, maxFiles: 100 };
}
export function hasR2(env) {
  return !!env.FILE_BUCKET && typeof env.FILE_BUCKET.get === 'function' && typeof env.FILE_BUCKET.put === 'function';
}
export async function r2Usage(env, claims) {
  const limits = r2Limits(env, claims.scope);
  if (!hasR2(env)) return { available: false, usedBytes: null, maxBytes: null, fileCount: null, reason: 'not_configured' };
  const usage = await env.DB.prepare('SELECT COALESCE(SUM(size_bytes),0) AS usedBytes, COUNT(*) AS fileCount FROM cloud_files WHERE access_id=? AND product_id=?')
    .bind(claims.access, claims.product).first();
  const usedBytes = Number(usage?.usedBytes || 0);
  return { available: true, usedBytes, maxBytes: limits.maxBytes,
    availableBytes: Math.max(0, limits.maxBytes - usedBytes),
    fileCount: Number(usage?.fileCount || 0), maxFiles: limits.maxFiles, maxFileBytes: limits.maxFileBytes,
    percentUsed: Math.round(10000 * usedBytes / limits.maxBytes) / 100 };
}
async function readLimited(request, cap) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > cap) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return all;
}
export async function r2Files(req, env, url, claims) {
  if (!hasR2(env)) return json({ error: 'R2 n’est pas configuré sur le Worker.' }, 503);
  const limits = r2Limits(env, claims.scope);
  const fileId = url.searchParams.get('fileId');
  if (url.pathname === '/v1/cloud/files') {
    if (req.method !== 'GET') return json({ error: 'Méthode non prise en charge.' }, 405);
    const { results = [] } = await env.DB.prepare('SELECT file_id AS fileId, revision, size_bytes AS sizeBytes, sha256, created_at AS createdAt, updated_at AS updatedAt FROM cloud_files WHERE access_id=? AND product_id=? ORDER BY updated_at DESC LIMIT 101')
      .bind(claims.access, claims.product).all();
    return json({ ok: true, items: results.slice(0, 100), truncated: results.length > 100, r2: await r2Usage(env, claims) });
  }
  if (!validFileId(fileId)) return json({ error: 'Identifiant de fichier invalide.' }, 400);
  const read = () => env.DB.prepare('SELECT object_key AS objectKey, revision, size_bytes AS sizeBytes, sha256, created_at AS createdAt, updated_at AS updatedAt FROM cloud_files WHERE access_id=? AND product_id=? AND file_id=?')
    .bind(claims.access, claims.product, fileId).first();
  const current = await read();
  if (req.method === 'GET') {
    if (!current) return json({ error: 'Fichier introuvable.' }, 404);
    const object = await env.FILE_BUCKET.get(current.objectKey);
    if (!object) return json({ error: 'Objet R2 manquant. Aucune donnée locale modifiée.' }, 502);
    return new Response(object.body, { headers: {
      ...responseHeaders, 'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileId}.bin"`,
      'X-AppForge-Revision': String(current.revision), 'X-AppForge-SHA256': current.sha256,
      'Content-Length': String(current.sizeBytes)
    } });
  }
  if (req.method !== 'PUT') return json({ error: 'Méthode non prise en charge.' }, 405);
  const expected = Number(req.headers.get('X-AppForge-Expected-Revision'));
  if (!req.headers.has('X-AppForge-Expected-Revision') || !Number.isSafeInteger(expected) || expected < 0)
    return json({ error: 'Révision attendue obligatoire (X-AppForge-Expected-Revision).' }, 400);
  if ((current?.revision || 0) !== expected)
    return json({ conflict: true, fileId, revision: current?.revision || 0 }, 409);
  const bytes = await readLimited(req, limits.maxFileBytes);
  if (!bytes) return json({ error: 'Fichier trop volumineux.' }, 413);
  if (bytes.length === 0) return json({ error: 'Fichier vide non accepté.' }, 400);
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
  // The object key must not expose client IDs or license identifiers.
  const prefixBytes = await crypto.subtle.digest('SHA-256', encoder.encode(`${claims.product}:${claims.access}`));
  const prefix = Array.from(new Uint8Array(prefixBytes), n => n.toString(16).padStart(2, '0')).join('');
  const objectKey = `files/${prefix}/${crypto.randomUUID()}`;
  await env.FILE_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
  const revision = expected + 1, now = new Date().toISOString();
  let write;
  try {
    if (expected === 0) {
      write = await env.DB.prepare(`INSERT OR IGNORE INTO cloud_files(access_id,product_id,file_id,object_key,revision,size_bytes,sha256,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE
          (SELECT COALESCE(SUM(size_bytes),0) FROM cloud_files WHERE access_id=? AND product_id=?) + ? <= ?
          AND (SELECT COUNT(*) FROM cloud_files WHERE access_id=? AND product_id=?) < ?`)
        .bind(claims.access,claims.product,fileId,objectKey,revision,bytes.length,sha256,now,now,
          claims.access,claims.product,bytes.length,limits.maxBytes,claims.access,claims.product,limits.maxFiles).run();
    } else {
      write = await env.DB.prepare(`UPDATE cloud_files SET object_key=?,revision=?,size_bytes=?,sha256=?,updated_at=?
        WHERE access_id=? AND product_id=? AND file_id=? AND revision=?
        AND (SELECT COALESCE(SUM(size_bytes),0) FROM cloud_files WHERE access_id=? AND product_id=?) - size_bytes + ? <= ?`)
        .bind(objectKey,revision,bytes.length,sha256,now,claims.access,claims.product,fileId,expected,
          claims.access,claims.product,bytes.length,limits.maxBytes).run();
    }
  } catch (error) {
    await env.FILE_BUCKET.delete(objectKey).catch(() => {});
    throw error;
  }
  if (!write?.meta?.changes) {
    await env.FILE_BUCKET.delete(objectKey).catch(() => {});
    const latest = await read();
    if ((latest?.revision || 0) !== expected) return json({ conflict: true, fileId, revision: latest?.revision || 0 }, 409);
    return json({ error: 'Quota R2 atteint (taille ou nombre de fichiers).' }, 413);
  }
  // The new pointer is committed before the previous object is removed.
  if (current?.objectKey) await env.FILE_BUCKET.delete(current.objectKey).catch(() => {});
  return json({ ok: true, fileId, revision, sizeBytes: bytes.length, sha256, updatedAt: now }, expected ? 200 : 201);
}