const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};
const enc = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const from64u = value => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }
function safeEqual(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function codeValue() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = crypto.getRandomValues(new Uint8Array(20)); let out = ""; for (const byte of bytes) out += alphabet[byte & 31]; return `APF-${out.match(/.{1,5}/g).join("-")}`; }
async function body(req) { try { return await req.json(); } catch { throw new Error("JSON invalide."); } }
function validId(v) { return typeof v === "string" && /^[A-Z0-9_-]{3,40}$/.test(v); }
async function signedToken(env, data) {
  const payload = b64u(enc.encode(JSON.stringify(data)));
  const jwk = JSON.parse(env.LICENSE_SIGNING_PRIVATE_JWK);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(payload));
  return `${payload}.${b64u(signature)}`;
}
async function verifySignedToken(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || token.length > 8192) throw new Error("token");
  const claims = JSON.parse(new TextDecoder().decode(from64u(parts[0])));
  const key = await crypto.subtle.importKey("jwk", await publicKey(env), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, from64u(parts[1]), enc.encode(parts[0]))) throw new Error("signature");
  if (claims.exp && Date.parse(claims.exp) <= Date.now()) throw new Error("expired");
  return claims;
}
async function cloudRights(env, productId, accessId, scope) {
  if(scope==='trial'){const trial=await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId,accessId.slice(6)).first();return {enabled:!!trial&&Date.parse(trial.expires_at)>Date.now(),maxBytes:5242880,requestsDay:1000,expiresAt:trial?.expires_at||null};}
  const row=await env.DB.prepare("SELECT cloud_enabled,cloud_quota_bytes,cloud_requests_day,expires_at,status,paid_confirmed FROM licenses WHERE id=? AND product_id=?").bind(accessId,productId).first();
  return {enabled:!!row&&row.cloud_enabled===1&&row.status==='active'&&!!row.paid_confirmed&&(!row.expires_at||Date.parse(row.expires_at)>Date.now()),maxBytes:row?.cloud_quota_bytes||0,requestsDay:row?.cloud_requests_day||0,expiresAt:row?.expires_at||null};
}
async function consumeCloudRequest(env, productId, accessId, limit) {
  const day=new Date().toISOString().slice(0,10);
  const row=await env.DB.prepare("INSERT INTO cloud_usage_daily(access_id,product_id,day,requests) VALUES(?,?,?,1) ON CONFLICT(access_id,product_id,day) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests").bind(accessId,productId,day,limit).first();
  return !!row;
}
async function issueCloudToken(env, productId, accessId, installationHash, scope = "license") {
  const rights=await cloudRights(env,productId,accessId,scope);
  if(!rights.enabled)return {enabled:false};
  const expiresAt = new Date(Math.min(Date.now()+6*3600000,rights.expiresAt?Date.parse(rights.expiresAt):Infinity)).toISOString();
  return { enabled:true, token: await signedToken(env, { v: 1, kind: "cloud", scope, product: productId, access: accessId, install: installationHash, iat: new Date().toISOString(), exp: expiresAt }), expiresAt, maxBytes:rights.maxBytes, requestsDay:rights.requestsDay };
}
async function cloudToken(req, env) {
  const data = await body(req), productId = String(data.productId || "").trim().toUpperCase(), installationId = String(data.installationId || "").trim();
  if (!validId(productId) || installationId.length < 16 || installationId.length > 120) return json({ error: "Informations Cloud invalides." }, 400);
  const product = await env.DB.prepare("SELECT status FROM products WHERE product_id=? AND product_id NOT IN (SELECT product_id FROM deleted_products)").bind(productId).first();
  if (!product || product.status !== "active") return json({ error: "Cette application est désactivée : l’accès Cloud est suspendu." }, 403);
  let claims; try { claims = await verifySignedToken(env, data.licenseToken); } catch { return json({ error: "Preuve de licence invalide ou expirée." }, 403); }
  const install = await digest(installationId);
  if (claims.app !== productId || claims.install !== install) return json({ error: "Cette preuve ne correspond pas à cette installation." }, 403);
  if (claims.kind === "trial") {
    const trial = await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId, install).first();
    if (!trial || Date.parse(trial.expires_at) <= Date.now()) return json({ error: "La période d’essai est terminée : l’accès Cloud est suspendu." }, 403);
    return json({ ok: true, ...(await issueCloudToken(env, productId, `trial:${install}`, install, "trial")), offline: false });
  }
  if (typeof claims.license !== "string") return json({ error: "Cette preuve ne contient pas de licence active." }, 403);
  const license = await env.DB.prepare("SELECT status,paid_confirmed,expires_at,COALESCE(license_type,plan) AS license_type,created_at,cloud_enabled FROM licenses WHERE id=? AND product_id=?").bind(claims.license, productId).first();
  if (!license || license.status !== "active" || !license.paid_confirmed || (license.expires_at && Date.parse(license.expires_at) <= Date.now())) return json({ error: "Licence inactive ou expirée : l’accès Cloud est suspendu." }, 403);
  const activation = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(claims.license, install).first();
  if (!activation) return json({ error: "Cet appareil n’est plus autorisé." }, 403);
  await env.DB.prepare("UPDATE activations SET last_seen=? WHERE license_id=? AND installation_hash=?").bind(new Date().toISOString(), claims.license, install).run();
  const rights=await cloudRights(env,productId,claims.license,"license");
  if(!rights.enabled)return json({error:"Accès Cloud désactivé pour cette licence."},403);
  if(!await consumeCloudRequest(env,productId,claims.license,rights.requestsDay))return json({error:"Quota journalier Cloud atteint."},429);
  return json({ ok: true, ...(await issueCloudToken(env, productId, claims.license, install)), offline: false });
}
// Read-only quota metrics for the existing D1 snapshots. R2 usage is deliberately
// unavailable until an R2 binding and verified object metadata are deployed.
async function cloudQuota(req, env) {
  let claims;
  try { claims = await verifySignedToken(env, req.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "")); }
  catch { return json({ error: "Jeton Cloud invalide ou expiré." }, 401); }
  if (claims.kind !== "cloud" || !validId(claims.product) || typeof claims.access !== "string" || typeof claims.install !== "string") return json({ error: "Jeton Cloud invalide." }, 403);
  const product = await env.DB.prepare("SELECT status FROM products WHERE product_id=? AND product_id NOT IN (SELECT product_id FROM deleted_products)").bind(claims.product).first();
  if (!product || product.status !== "active") return json({ error: "Application désactivée." }, 403);
  if (claims.scope === "trial") {
    const trial = await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(claims.product, claims.install).first();
    if (!trial || claims.access !== `trial:${claims.install}` || Date.parse(trial.expires_at) <= Date.now()) return json({ error: "Essai expiré." }, 403);
  } else if (claims.scope === "license") {
    const license = await env.DB.prepare("SELECT status,paid_confirmed,expires_at FROM licenses WHERE id=? AND product_id=?").bind(claims.access, claims.product).first();
    if (!license || license.status !== "active" || !license.paid_confirmed || (license.expires_at && Date.parse(license.expires_at) <= Date.now())) return json({ error: "Licence inactive." }, 403);
    const activation = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(claims.access, claims.install).first();
    if (!activation) return json({ error: "Appareil non autorisé." }, 403);
  } else return json({ error: "Portée Cloud invalide." }, 403);
  const rights = await cloudRights(env, claims.product, claims.access, claims.scope);
  if (!rights.enabled) return json({ error: "Accès Cloud désactivé." }, 403);
  if (!await consumeCloudRequest(env, claims.product, claims.access, rights.requestsDay)) return json({ error: "Quota journalier Cloud atteint." }, 429);
  const usage = await env.DB.prepare("SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) AS usedBytes,COUNT(*) AS snapshotCount FROM cloud_snapshots WHERE access_id=? AND product_id=?").bind(claims.access, claims.product).first();
  const usedBytes = Number(usage?.usedBytes || 0), maxBytes = Number(rights.maxBytes || 0);
  return json({ ok: true, checkedAt: new Date().toISOString(), d1: { usedBytes, maxBytes, availableBytes: Math.max(0,maxBytes-usedBytes), snapshotCount: Number(usage?.snapshotCount || 0), percentUsed: maxBytes > 0 ? Math.round(10000*usedBytes/maxBytes)/100 : null }, r2: { available: false, usedBytes: null, maxBytes: null, fileCount: null, reason: "not_configured" } });
}
async function cloudSnapshot(req, env, url) {
  let claims; try { claims = await verifySignedToken(env, req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")); } catch { return json({ error: "Jeton Cloud invalide ou expiré." }, 401); }
  if (claims.kind !== "cloud" || !validId(claims.product) || typeof claims.access !== "string" || typeof claims.install !== "string") return json({ error: "Jeton Cloud invalide." }, 403);
  const product = await env.DB.prepare("SELECT status FROM products WHERE product_id=? AND product_id NOT IN (SELECT product_id FROM deleted_products)").bind(claims.product).first();
  if (!product || product.status !== "active") return json({ error: "Cette application est désactivée : la synchronisation est suspendue." }, 403);
  if (claims.scope === "trial") {
    const trial = await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(claims.product, claims.install).first();
    if (!trial || Date.parse(trial.expires_at) <= Date.now() || claims.access !== `trial:${claims.install}`) return json({ error: "Essai expiré : l’accès Cloud est suspendu." }, 403);
  } else if (claims.scope === "license") {
    const license = await env.DB.prepare("SELECT status,paid_confirmed,expires_at FROM licenses WHERE id=? AND product_id=?").bind(claims.access, claims.product).first();
    if (!license || license.status !== "active" || !license.paid_confirmed || (license.expires_at && Date.parse(license.expires_at) <= Date.now())) return json({ error: "Licence inactive : l’accès Cloud est suspendu." }, 403);
    const activation = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(claims.access, claims.install).first();
    if (!activation) return json({ error: "Cet appareil n’est plus autorisé." }, 403);
  } else return json({ error: "Portée Cloud invalide." }, 403);
  const rights=await cloudRights(env,claims.product,claims.access,claims.scope);
  if(!rights.enabled)return json({error:"Accès Cloud désactivé pour cette licence."},403);
  if(!await consumeCloudRequest(env,claims.product,claims.access,rights.requestsDay))return json({error:"Quota journalier Cloud atteint."},429);
  const resource = String(url.searchParams.get("resource") || "default");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(resource)) return json({ error: "Identifiant de sauvegarde invalide." }, 400);
  const read = async () => {
    const row = await env.DB.prepare("SELECT revision,payload,updated_at AS updatedAt FROM cloud_snapshots WHERE access_id=? AND product_id=? AND resource=?").bind(claims.access, claims.product, resource).first();
    return row ? { resource, revision: row.revision, snapshot: JSON.parse(row.payload), updatedAt: row.updatedAt } : { resource, revision: 0, snapshot: null };
  };
  if (req.method === "GET") return json(await read());
  if (req.method !== "PUT") return json({ error: "Méthode non prise en charge." }, 405);
  const declaredLength = Number(req.headers.get("Content-Length") || 0);
  if (declaredLength > 450000) return json({ error: "La sauvegarde dépasse 450 Ko." }, 413);
  const reader = req.body?.getReader(); if (!reader) return json({ error: "Corps de requête manquant." }, 400);
  const chunks = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 450000) { await reader.cancel(); return json({ error: "La sauvegarde dépasse 450 Ko." }, 413); } chunks.push(part.value); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  const raw = new TextDecoder().decode(all);
  let d; try { d = JSON.parse(raw); } catch { return json({ error: "JSON invalide." }, 400); }
  if (!Number.isInteger(d.expectedRevision) || d.expectedRevision < 0 || !d.snapshot || typeof d.snapshot !== "object" || Array.isArray(d.snapshot)) return json({ error: "Révision et instantané valides requis." }, 400);
  const current = await read();
  if (current.revision !== d.expectedRevision) return json({ conflict: true, ...current }, 409);
  const revision = current.revision + 1, now = new Date().toISOString();
  const payload = JSON.stringify(d.snapshot);
  const write = current.revision === 0
    ? await env.DB.prepare("INSERT OR IGNORE INTO cloud_snapshots(access_id,product_id,resource,revision,payload,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) FROM cloud_snapshots WHERE access_id=? AND product_id=?) + length(CAST(? AS BLOB)) <= ?").bind(claims.access,claims.product,resource,revision,payload,now,claims.access,claims.product,payload,rights.maxBytes).run()
    : await env.DB.prepare("UPDATE cloud_snapshots SET revision=?,payload=?,updated_at=? WHERE access_id=? AND product_id=? AND resource=? AND revision=? AND (SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) FROM cloud_snapshots WHERE access_id=? AND product_id=?) - length(CAST(payload AS BLOB)) + length(CAST(? AS BLOB)) <= ?").bind(revision,payload,now,claims.access,claims.product,resource,d.expectedRevision,claims.access,claims.product,payload,rights.maxBytes).run();
  if(!(write.meta?.changes>0)){
    const latest=await read();if(latest.revision!==d.expectedRevision)return json({conflict:true,...latest},409);
    return json({error:"Quota de stockage Cloud atteint."},413);
  }
  if (!(write.meta?.changes > 0)) return json({ conflict: true, ...(await read()) }, 409);
  return json({ ok: true, resource, revision, updatedAt: now });
}
async function auth(req, env) {
  const got = req.headers.get("Authorization") || "";
  return safeEqual(got, `Bearer ${env.ADMIN_API_TOKEN || ""}`) && !!env.ADMIN_API_TOKEN;
}
async function dailyUsage(env, add = false, kind = "activation") {
  const day = new Date().toISOString().slice(0, 10);
  const column = kind === "status" ? "status_requests" : kind === "trial" ? "trial_requests" : "activation_requests";
  if (add) await env.DB.prepare(`INSERT INTO usage_daily(day, activation_requests, status_requests, trial_requests) VALUES(?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET ${column}=${column}+1`).bind(day, kind === "activation" ? 1 : 0, kind === "status" ? 1 : 0, kind === "trial" ? 1 : 0).run();
  const row = await env.DB.prepare("SELECT activation_requests,status_requests,trial_requests FROM usage_daily WHERE day=?").bind(day).first();
  const activationRequests = row?.activation_requests || 0, statusRequests = row?.status_requests || 0, trialRequests = row?.trial_requests || 0;
  return { day, activationRequests, statusRequests, trialRequests, totalRequests: activationRequests + statusRequests + trialRequests, softLimit: Number(env.DAILY_API_LIMIT || 50000) };
}
async function startTrial(req, env) {
  const data = await body(req), productId = String(data.productId || "").trim().toUpperCase(), installationId = String(data.installationId || "").trim();
  if (!validId(productId) || installationId.length < 16 || installationId.length > 120) return json({ error: "Informations d’essai invalides." }, 400);
  const beforeUsage = await dailyUsage(env);
  if (beforeUsage.totalRequests >= beforeUsage.softLimit) return json({ error: "Limite quotidienne du service atteinte. Réessayez demain.", usage: beforeUsage }, 429);
  await dailyUsage(env, true, "trial");
  const product = await env.DB.prepare("SELECT product_id FROM products WHERE product_id=? AND status='active'").bind(productId).first();
  if (!product) return json({ error: "Application inconnue ou inactive." }, 404);
  const installationHash = await digest(installationId), now = new Date();
  let trial = await env.DB.prepare("SELECT started_at,expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId, installationHash).first();
  if (!trial) {
    const hours = Math.max(1, Math.min(168, Number(env.TRIAL_HOURS || 72)));
    const startedAt = now.toISOString(), expiresAt = new Date(now.getTime() + hours * 3600000).toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO trials(product_id,installation_hash,started_at,expires_at) VALUES(?,?,?,?)").bind(productId, installationHash, startedAt, expiresAt).run();
    trial = await env.DB.prepare("SELECT started_at,expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId, installationHash).first();
  }
  if (!trial || Date.parse(trial.expires_at) <= now.getTime()) return json({ active: false, expired: true, error: "La période d’essai est terminée." }, 403);
  const token = await signedToken(env, { v: 1, app: productId, kind: "trial", install: installationHash, iat: trial.started_at, exp: trial.expires_at });
  return json({ ok: true, active: true, token, publicKey: await publicKey(env), cloudAccess: await issueCloudToken(env, productId, `trial:${installationHash}`, installationHash, "trial"), startedAt: trial.started_at, expiresAt: trial.expires_at, offline: true });
}
async function activate(req, env) {
  const data = await body(req);
  const productId = String(data.productId || "").trim().toUpperCase();
  const code = String(data.code || "").trim().toUpperCase();
  const installationId = String(data.installationId || "").trim();
  if (!validId(productId) || code.length < 12 || code.length > 80 || installationId.length < 16 || installationId.length > 120) return json({ error: "Informations d’activation invalides." }, 400);
  const product = await env.DB.prepare("SELECT status FROM products WHERE product_id=? AND product_id NOT IN (SELECT product_id FROM deleted_products)").bind(productId).first();
  if (!product || product.status !== "active") return json({ error: "Cette application est désactivée : les activations sont suspendues." }, 403);
  const beforeUsage = await dailyUsage(env);
  if (beforeUsage.totalRequests >= beforeUsage.softLimit) return json({ error: "Limite quotidienne d’activations atteinte. Réessayez demain.", usage: beforeUsage }, 429);
  const usage = await dailyUsage(env, true, "activation");
  const codeHash = await digest(`${env.CODE_HASH_PEPPER || ""}:${code}`);
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const license = await env.DB.prepare("SELECT id,product_id,status,paid_confirmed,max_devices,expires_at FROM licenses WHERE product_id=? AND code_hash=?").bind(productId, codeHash).first();
  if (!license || license.status !== "active" || !license.paid_confirmed) {
    const subject = await digest(`${env.CODE_HASH_PEPPER || ""}:${ip}:${productId}:${codeHash}`);
    const bucket = Math.floor(Date.now() / 900000);
    const attempt = await env.DB.prepare("INSERT INTO activation_attempts(subject_hash,bucket,failures) VALUES(?,?,1) ON CONFLICT(subject_hash,bucket) DO UPDATE SET failures=failures+1 RETURNING failures").bind(subject, bucket).first();
    if ((attempt?.failures || 1) > 5) return json({ error: "Trop d’essais pour ce code. Attendez 15 minutes avant de recommencer." }, 429);
    return json({ error: "Code invalide, paiement non confirmé ou licence désactivée." }, 403);
  }
  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return json({ error: "Cette licence a expiré." }, 403);
  const installationHash = await digest(installationId);
  const prior = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(license.id, installationHash).first();
  if (!prior) {
    await env.DB.prepare("INSERT OR IGNORE INTO activations(license_id,installation_hash,activated_at,last_seen) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM activations WHERE license_id=?) < (SELECT max_devices FROM licenses WHERE id=?)").bind(license.id,installationHash,new Date().toISOString(),new Date().toISOString(),license.id,license.id).run();
    const registered=await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(license.id,installationHash).first();
    if(!registered)return json({error:"Nombre maximal d’appareils atteint."},403);
  } else {
    await env.DB.prepare("UPDATE activations SET last_seen=? WHERE license_id=? AND installation_hash=?").bind(new Date().toISOString(), license.id, installationHash).run();
  }
  const token = await signedToken(env, { v: 1, app: productId, license: license.id, install: installationHash, iat: new Date().toISOString(), exp: license.expires_at || null });
  return json({ ok: true, token, publicKey: await publicKey(env), cloudAccess: await issueCloudToken(env, productId, license.id, installationHash), offline: true });
}
async function checkStatus(req, env) {
  const data = await body(req);
  const productId = String(data.productId || "").trim().toUpperCase();
  const token = String(data.token || "").trim();
  const installationId = String(data.installationId || "").trim();
  if (!validId(productId) || token.length > 4096 || installationId.length < 16 || installationId.length > 120) return json({ active: false, error: "Informations de vérification invalides." }, 400);
  const beforeUsage = await dailyUsage(env);
  if (beforeUsage.totalRequests >= beforeUsage.softLimit) return json({ error: "Limite quotidienne du service atteinte.", usage: beforeUsage }, 429);
  await dailyUsage(env, true, "status");
  const parts = token.split(".");
  if (parts.length !== 2) return json({ active: false, invalid: true, error: "Preuve de licence invalide." }, 403);
  let claims;
  try {
    const payloadText = new TextDecoder().decode(from64u(parts[0]));
    claims = JSON.parse(payloadText);
    const key = await crypto.subtle.importKey("jwk", await publicKey(env), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, from64u(parts[1]), enc.encode(parts[0]));
    if (!verified) throw new Error("signature");
  } catch {
    return json({ active: false, invalid: true, error: "Preuve de licence invalide." }, 403);
  }
  const installationHash = await digest(installationId);
  if (claims.v !== 1 || claims.app !== productId || claims.install !== installationHash) return json({ active: false, invalid: true, error: "Cette preuve ne correspond pas à cette installation." }, 403);
  const product = await env.DB.prepare("SELECT status FROM products WHERE product_id=? AND product_id NOT IN (SELECT product_id FROM deleted_products)").bind(productId).first();
  if (!product || product.status !== "active") return json({ active: false, revoked: true, error: "Cette application est désactivée : la licence est suspendue." }, 403);
  if (claims.kind === "trial") {
    const trial = await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId, installationHash).first();
    if (!trial || Date.parse(trial.expires_at) <= Date.now() || (claims.exp && Date.parse(claims.exp) <= Date.now())) return json({ active: false, expired: true, error: "La période d’essai est terminée." }, 403);
    return json({ active: true, kind: "trial", licenseType: "trial", expiresAt: trial.expires_at, checkedAt: new Date().toISOString() });
  }
  if (typeof claims.license !== "string") return json({ active: false, invalid: true, error: "Cette preuve de licence ne correspond pas." }, 403);
  const license = await env.DB.prepare("SELECT status,paid_confirmed,expires_at,COALESCE(license_type,plan) AS license_type,created_at,cloud_enabled FROM licenses WHERE id=? AND product_id=?").bind(claims.license, productId).first();
  if (!license || license.status !== "active" || !license.paid_confirmed) return json({ active: false, revoked: true, error: "Cette licence a été révoquée ou désactivée." }, 403);
  if ((license.expires_at && new Date(license.expires_at).getTime() < Date.now()) || (claims.exp && Date.parse(claims.exp) < Date.now())) return json({ active: false, expired: true, error: "Cette licence a expiré." }, 403);
  const activation = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(claims.license, installationHash).first();
  if (!activation) return json({ active: false, invalid: true, error: "Cette installation n’est plus autorisée." }, 403);
  return json({ active: true, kind: "license", licenseType: license.license_type || null, licenseCreatedAt: license.created_at || null, expiresAt: license.expires_at || null, cloudEnabled: license.cloud_enabled === 1, checkedAt: new Date().toISOString() });
}
async function publicKey(env) {
  const jwk = JSON.parse(env.LICENSE_SIGNING_PRIVATE_JWK);
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] };
}
async function handle(req, env) {
  const url = new URL(req.url), path = url.pathname.replace(/\/$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (path === "/health" && req.method === "GET") return json({ ok: true, service: "AppForge License API", time: new Date().toISOString() });
  if (path === "/v1/config" && req.method === "GET") return json({ publicKey: await publicKey(env), protocol: "appforge-license-v1" });
  if (path === "/v1/activate" && req.method === "POST") return activate(req, env);
  if (path === "/v1/trial" && req.method === "POST") return startTrial(req, env);
  if (path === "/v1/status" && req.method === "POST") return checkStatus(req, env);
  if (path === "/v1/cloud/token" && req.method === "POST") return cloudToken(req, env);
  if (path === "/v1/cloud/quota" && req.method === "GET") return cloudQuota(req, env);
  if (path === "/v1/cloud/snapshot" && ["GET", "PUT"].includes(req.method)) return cloudSnapshot(req, env, url);
  if (!path.startsWith("/admin/")) return json({ error: "Route inconnue." }, 404);
  if (!(await auth(req, env))) return json({ error: "Accès administrateur refusé." }, 401);
  if (path === "/admin/usage" && req.method === "GET") return json(await dailyUsage(env));
  if (path === "/admin/trials" && req.method === "GET") {
    const now = new Date().toISOString();
    const { results = [] } = await env.DB.prepare("SELECT t.product_id AS productId,p.name AS appName,COUNT(*) AS total,SUM(CASE WHEN t.expires_at>? THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN t.expires_at<=? THEN 1 ELSE 0 END) AS expired,MIN(CASE WHEN t.expires_at>? THEN t.expires_at ELSE NULL END) AS nextExpiry FROM trials t JOIN products p ON p.product_id=t.product_id GROUP BY t.product_id,p.name ORDER BY p.name").bind(now, now, now).all();
    const totals = results.reduce((a, r) => ({ total: a.total + Number(r.total || 0), active: a.active + Number(r.active || 0), expired: a.expired + Number(r.expired || 0) }), { total: 0, active: 0, expired: 0 });
    return json({ ...totals, items: results, checkedAt: now });
  }
  if (path === "/admin/apps" && req.method === "GET") {
    const { results = [] } = await env.DB.prepare("SELECT product_id AS productId,name,status,created_at AS createdAt FROM products WHERE product_id NOT IN (SELECT product_id FROM deleted_products) ORDER BY created_at DESC").all();
    return json({ items: results });
  }
  if (path === "/admin/apps" && req.method === "POST") {
    const d = await body(req), productId = String(d.productId || "").trim().toUpperCase(), name = String(d.name || "").trim();
    if (!validId(productId) || name.length < 2 || name.length > 80) return json({ error: "Identifiant (3–40 caractères A–Z, 0–9, _ ou -) et nom requis." }, 400);
    try { await env.DB.prepare("INSERT INTO products(product_id,name,status,created_at) VALUES(?,?, 'active',?)").bind(productId, name, new Date().toISOString()).run(); }
    catch { return json({ error: "Cet identifiant d’application existe déjà." }, 409); }
    return json({ ok: true, productId, name }, 201);
  }
  const appRoute = path.match(/^\/admin\/apps\/([A-Z0-9_-]{3,40})$/);
  if (appRoute && req.method === "PATCH") {
    const d = await body(req), name = String(d.name || "").trim(), status = d.status === "inactive" ? "inactive" : d.status === "active" ? "active" : "";
    if (name.length < 2 || name.length > 80 || !status) return json({ error: "Nom et état valides requis." }, 400);
    const r = await env.DB.prepare("UPDATE products SET name=?,status=? WHERE product_id=?").bind(name,status,appRoute[1]).run();
    await env.DB.prepare("DELETE FROM deleted_products WHERE product_id=?").bind(appRoute[1]).run();
    return json({ ok: true, changed: r.meta?.changes || 0 });
  }
  if (appRoute && req.method === "DELETE") {
    const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM licenses WHERE product_id=? AND status='active'").bind(appRoute[1]).first();
    if ((active?.n || 0) > 0) return json({ error: "Révoque ou supprime d’abord les licences actives de cette application." }, 409);
    const related = await env.DB.prepare("SELECT COUNT(*) AS n FROM licenses WHERE product_id=?").bind(appRoute[1]).first();
    if ((related?.n || 0) > 0) {
      await env.DB.batch([env.DB.prepare("UPDATE products SET status='inactive' WHERE product_id=?").bind(appRoute[1]),env.DB.prepare("INSERT OR IGNORE INTO deleted_products(product_id,deleted_at) VALUES(?,?)").bind(appRoute[1],new Date().toISOString())]);
      return json({ ok: true, archived: true, changed: 1 });
    }
    const r = await env.DB.prepare("DELETE FROM products WHERE product_id=?").bind(appRoute[1]).run();
    return json({ ok: true, archived: false, changed: r.meta?.changes || 0 });
  }
  if (path === "/admin/licenses" && req.method === "GET") {
    const productId = url.searchParams.get("productId") || "";
    const { results = [] } = await env.DB.prepare("SELECT l.id,l.product_id AS productId,l.customer_name AS customerName,l.customer_email AS customerEmail,l.status,COALESCE(l.license_type,l.plan) AS plan,l.max_devices AS maxDevices,l.expires_at AS expiresAt,l.payment_reference AS paymentReference,l.created_at AS createdAt,(SELECT COUNT(*) FROM activations a WHERE a.license_id=l.id) AS activations FROM licenses l WHERE l.id NOT IN (SELECT license_id FROM deleted_licenses) AND (?='' OR l.product_id=?) ORDER BY l.created_at DESC LIMIT 500").bind(productId, productId).all();
    return json({ items: results });
  }
  if (path === "/admin/licenses" && req.method === "POST") {
    const d = await body(req), productId = String(d.productId || "").trim().toUpperCase(), customerName = String(d.customerName || "").trim(), owner = d.plan === "owner", internalTest = d.plan === "test_day", plan = ["test_day","monthly","annual","lifetime","owner"].includes(d.plan) ? d.plan : "", paymentReference = String(d.paymentReference || "").trim(), maxDevices = Math.min(10, Math.max(1, Number(d.maxDevices) || 1));
    if (!validId(productId) || customerName.length < 2 || !plan || (owner ? paymentReference !== "OWNER-TEST" : internalTest ? paymentReference !== "INTERNAL-TEST" : (!paymentReference || d.paymentConfirmed !== true))) return json({ error: "Application, client, type de licence et référence valide sont obligatoires. Le paiement doit être confirmé pour une licence client." }, 400);
    const product = await env.DB.prepare("SELECT product_id FROM products WHERE product_id=? AND status='active'").bind(productId).first();
    if (!product) return json({ error: "Application inconnue ou inactive." }, 404);
    const code = codeValue(), codeHash = await digest(`${env.CODE_HASH_PEPPER || ""}:${code}`), id = crypto.randomUUID(), now = new Date().toISOString();
    const durationDays = { test_day: 1, monthly: 30, annual: 365 }[plan];
    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;
    const dbPlan = ["lifetime","owner"].includes(plan) ? "lifetime" : "annual";
    await env.DB.prepare("INSERT INTO licenses(id,product_id,customer_name,customer_email,code_hash,status,paid_confirmed,plan,max_devices,expires_at,payment_reference,created_at,license_type) VALUES(?,?,?,?,?,'active',1,?,?,?,?,?,?)").bind(id, productId, customerName, String(d.customerEmail || "").slice(0,160), codeHash, dbPlan, maxDevices, expiresAt, paymentReference.slice(0,100), now, plan).run();
    return json({ ok: true, id, productId, customerName, code, plan, maxDevices, expiresAt, createdAt: now, cloudEnabled: true, cloudAvailableAfterActivation: true }, 201);
  }
  const cloudAdmin=path.match(/^\/admin\/licenses\/([0-9a-f-]{36})\/cloud$/i);
  if(cloudAdmin&&req.method==='GET'){
    const row=await env.DB.prepare("SELECT cloud_enabled AS enabled,cloud_quota_bytes AS maxBytes,cloud_requests_day AS requestsDay FROM licenses WHERE id=?").bind(cloudAdmin[1]).first();
    return row?json({...row,enabled:row.enabled===1}):json({error:"Licence inconnue."},404);
  }
  if(cloudAdmin&&req.method==='PATCH'){
    const d=await body(req),maxBytes=Number(d.maxBytes),requestsDay=Number(d.requestsDay);
    if(typeof d.enabled!=='boolean'||!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>1073741824||!Number.isSafeInteger(requestsDay)||requestsDay<1||requestsDay>100000)return json({error:"Droits et quotas Cloud invalides."},400);
    const r=await env.DB.prepare("UPDATE licenses SET cloud_enabled=?,cloud_quota_bytes=?,cloud_requests_day=? WHERE id=?").bind(d.enabled?1:0,maxBytes,requestsDay,cloudAdmin[1]).run();
    return r.meta?.changes?json({ok:true,cloudEnabled:d.enabled,maxBytes,requestsDay}):json({error:"Licence inconnue."},404);
  }
  const licenseRoute = path.match(/^\/admin\/licenses\/([0-9a-f-]{36})$/i);
  if (licenseRoute && req.method === "PATCH") {
    const d = await body(req), customerName = String(d.customerName || "").trim(), customerEmail = String(d.customerEmail || "").trim(), paymentReference = String(d.paymentReference || "").trim(), maxDevices = Number(d.maxDevices);
    if (customerName.length < 2 || customerName.length > 120 || customerEmail.length > 160 || paymentReference.length > 100 || !Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 10) return json({ error: "Nom, e-mail, référence ou nombre d’appareils invalide." }, 400);
    const r = await env.DB.prepare("UPDATE licenses SET customer_name=?,customer_email=?,payment_reference=?,max_devices=? WHERE id=? AND status IN ('active','revoked')").bind(customerName,customerEmail,paymentReference,maxDevices,licenseRoute[1]).run();
    return json({ ok: true, changed: r.meta?.changes || 0 });
  }
  if (licenseRoute && req.method === "DELETE") {
    const existing = await env.DB.prepare("SELECT id FROM licenses WHERE id=?").bind(licenseRoute[1]).first();
    if (!existing) return json({ error: "Licence introuvable." }, 404);
    const now = new Date().toISOString();
    await env.DB.batch([env.DB.prepare("UPDATE licenses SET status='revoked',revoked_at=COALESCE(revoked_at,?) WHERE id=? AND status='active'").bind(now,licenseRoute[1]),env.DB.prepare("INSERT OR IGNORE INTO deleted_licenses(license_id,deleted_at) VALUES(?,?)").bind(licenseRoute[1],now)]);
    return json({ ok: true, changed: 1, revoked: true });
  }
  const revoke = path.match(/^\/admin\/licenses\/([0-9a-f-]{36})\/revoke$/i);
  if (revoke && req.method === "POST") {
    const changed = await env.DB.prepare("UPDATE licenses SET status='revoked',revoked_at=? WHERE id=? AND status='active'").bind(new Date().toISOString(), revoke[1]).run();
    return json({ ok: true, changed: changed.meta?.changes || 0 });
  }
  return json({ error: "Route inconnue." }, 404);
}
export default { async fetch(req, env) { try { return await handle(req, env); } catch (err) { return json({ error: "Erreur serveur. Vérifiez la configuration du service." }, 500); } } };
