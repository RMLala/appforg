const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
  return json({ ok: true, active: true, token, publicKey: await publicKey(env), startedAt: trial.started_at, expiresAt: trial.expires_at, offline: true });
}
async function activate(req, env) {
  const data = await body(req);
  const productId = String(data.productId || "").trim().toUpperCase();
  const code = String(data.code || "").trim().toUpperCase();
  const installationId = String(data.installationId || "").trim();
  if (!validId(productId) || code.length < 12 || code.length > 80 || installationId.length < 16 || installationId.length > 120) return json({ error: "Informations d’activation invalides." }, 400);
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
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM activations WHERE license_id=?").bind(license.id).first();
    if ((count?.n || 0) >= license.max_devices) return json({ error: "Nombre maximal d’appareils atteint. Contactez le support pour réinitialiser une activation." }, 403);
    await env.DB.prepare("INSERT INTO activations(license_id,installation_hash,activated_at,last_seen) VALUES(?,?,?,?)").bind(license.id, installationHash, new Date().toISOString(), new Date().toISOString()).run();
  } else {
    await env.DB.prepare("UPDATE activations SET last_seen=? WHERE license_id=? AND installation_hash=?").bind(new Date().toISOString(), license.id, installationHash).run();
  }
  const token = await signedToken(env, { v: 1, app: productId, license: license.id, install: installationHash, iat: new Date().toISOString(), exp: license.expires_at || null });
  return json({ ok: true, token, publicKey: await publicKey(env), offline: true });
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
  if (claims.kind === "trial") {
    const trial = await env.DB.prepare("SELECT expires_at FROM trials WHERE product_id=? AND installation_hash=?").bind(productId, installationHash).first();
    if (!trial || Date.parse(trial.expires_at) <= Date.now() || (claims.exp && Date.parse(claims.exp) <= Date.now())) return json({ active: false, expired: true, error: "La période d’essai est terminée." }, 403);
    return json({ active: true, kind: "trial", expiresAt: trial.expires_at, checkedAt: new Date().toISOString() });
  }
  if (typeof claims.license !== "string") return json({ active: false, invalid: true, error: "Cette preuve de licence ne correspond pas." }, 403);
  const license = await env.DB.prepare("SELECT status,paid_confirmed,cloud_enabled,license_type,expires_at FROM licenses WHERE id=? AND product_id=?").bind(claims.license, productId).first();
  if (!license || license.status !== "active" || !license.paid_confirmed) return json({ active: false, revoked: true, error: "Cette licence a été révoquée ou désactivée." }, 403);
  if ((license.expires_at && new Date(license.expires_at).getTime() < Date.now()) || (claims.exp && Date.parse(claims.exp) < Date.now())) return json({ active: false, expired: true, error: "Cette licence a expiré." }, 403);
  const activation = await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(claims.license, installationHash).first();
  if (!activation) return json({ active: false, invalid: true, error: "Cette installation n’est plus autorisée." }, 403);
  return json({ active: true, cloudEnabled: !!license.cloud_enabled, expiresAt: license.expires_at, plan: license.license_type, checkedAt: new Date().toISOString() });
}
async function publicKey(env) {
  const jwk = JSON.parse(env.LICENSE_SIGNING_PRIVATE_JWK);
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] };
}

async function verifyLicenseProof(token, productId, installationId, env) {
  const parts=String(token||"").split(".");
  if(parts.length!==2) return null;
  let claims;
  try {
    claims=JSON.parse(new TextDecoder().decode(from64u(parts[0])));
    const key=await crypto.subtle.importKey("jwk",await publicKey(env),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    if(!await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,from64u(parts[1]),enc.encode(parts[0]))) return null;
  } catch { return null; }
  const installationHash=await digest(installationId);
  if(claims.v!==1||claims.app!==productId||claims.install!==installationHash||typeof claims.license!=="string") return null;
  const license=await env.DB.prepare("SELECT id,product_id,status,paid_confirmed,cloud_enabled,expires_at FROM licenses WHERE id=? AND product_id=?").bind(claims.license,productId).first();
  if(!license||license.status!=="active"||!license.paid_confirmed||!license.cloud_enabled) return null;
  if((license.expires_at&&Date.parse(license.expires_at)<=Date.now())||(claims.exp&&Date.parse(claims.exp)<=Date.now())) return null;
  const activation=await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(license.id,installationHash).first();
  return activation?{license,installationHash}:null;
}
async function cloudToken(req,env) {
  const d=await body(req),productId=String(d.productId||"").trim().toUpperCase(),installationId=String(d.installationId||"").trim();
  if(!validId(productId)||installationId.length<16||installationId.length>120||!d.licenseToken) return json({error:"Informations Cloud invalides."},400);
  const verified=await verifyLicenseProof(d.licenseToken,productId,installationId,env);
  if(!verified) return json({error:"Licence expirée, révoquée ou sans droit Cloud pour cet appareil."},403);
  const raw=b64u(crypto.getRandomValues(new Uint8Array(32))),hash=await digest(raw),now=Date.now(),expiresAt=new Date(now+15*60*1000).toISOString();
  await env.DB.prepare("INSERT INTO cloud_sessions(token_hash,license_id,product_id,installation_hash,expires_at,created_at,last_used_at) VALUES(?,?,?,?,?,?,?)").bind(hash,verified.license.id,productId,verified.installationHash,expiresAt,new Date(now).toISOString(),new Date(now).toISOString()).run();
  return json({ok:true,token:raw,expiresAt,licenseExpiresAt:verified.license.expires_at,cloudEnabled:true});
}
async function cloudSession(req,env) {
  const raw=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(raw.length<32||raw.length>200)return null;
  const row=await env.DB.prepare("SELECT s.token_hash,s.license_id,s.product_id,s.installation_hash,l.status,l.paid_confirmed,l.cloud_enabled,l.expires_at FROM cloud_sessions s JOIN licenses l ON l.id=s.license_id AND l.product_id=s.product_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?").bind(await digest(raw),new Date().toISOString()).first();
  if(!row||row.status!=="active"||!row.paid_confirmed||!row.cloud_enabled||(row.expires_at&&Date.parse(row.expires_at)<=Date.now()))return null;
  const active=await env.DB.prepare("SELECT id FROM activations WHERE license_id=? AND installation_hash=?").bind(row.license_id,row.installation_hash).first();
  if(!active)return null;
  await env.DB.prepare("UPDATE cloud_sessions SET last_used_at=? WHERE token_hash=?").bind(new Date().toISOString(),row.token_hash).run();
  return row;
}
async function syncCloud(req,env) {
  const session=await cloudSession(req,env);if(!session)return json({error:"Jeton Cloud expiré ou accès révoqué. Reconnectez Prompti à Internet."},401);
  const d=await body(req),changes=Array.isArray(d.changes)?d.changes:[];
  if(changes.length>100)return json({error:"Limite de 100 changements par synchronisation."},413);
  const conflicts=[],accepted=[];
  for(const change of changes){
    const id=String(change.id||""),opId=String(change.opId||""),payload=JSON.stringify(change.data);
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!/^[a-zA-Z0-9_-]{12,80}$/.test(opId)||payload.length>128000)return json({error:"Un élément de synchronisation est invalide ou trop volumineux."},400);
    const duplicate=await env.DB.prepare("SELECT version FROM cloud_sync_ops WHERE license_id=? AND op_id=?").bind(session.license_id,opId).first();
    if(duplicate){accepted.push({id,version:duplicate.version,duplicate:true});continue;}
    const current=await env.DB.prepare("SELECT version,payload_json,deleted FROM cloud_records WHERE license_id=? AND record_id=?").bind(session.license_id,id).first();
    const actual=current?.version||0,base=Number.isInteger(change.baseVersion)?change.baseVersion:-1;
    if(actual!==base){conflicts.push({id,version:actual,data:current&&!current.deleted?JSON.parse(current.payload_json):null,deleted:!!current?.deleted});continue;}
    const version=actual+1,now=new Date().toISOString(),deleted=change.deleted===true?1:0;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO cloud_records(license_id,record_id,version,payload_json,deleted,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(license_id,record_id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json,deleted=excluded.deleted,updated_at=excluded.updated_at").bind(session.license_id,id,version,payload,deleted,now),
      env.DB.prepare("INSERT INTO cloud_sync_ops(license_id,op_id,record_id,version,created_at) VALUES(?,?,?,?,?)").bind(session.license_id,opId,id,version,now),
      env.DB.prepare("INSERT INTO cloud_changes(license_id,record_id,version,payload_json,deleted,created_at) VALUES(?,?,?,?,?,?)").bind(session.license_id,id,version,payload,deleted,now)
    ]);
    accepted.push({id,version});
  }
  const cursor=Math.max(0,Number(d.cursor)||0),pulled=await env.DB.prepare("SELECT seq,record_id AS id,version,payload_json AS payload,deleted FROM cloud_changes WHERE license_id=? AND seq>? ORDER BY seq LIMIT 500").bind(session.license_id,cursor).all();
  const rows=pulled.results||[],nextCursor=rows.length?rows[rows.length-1].seq:cursor;
  return json({ok:true,accepted,conflicts,changes:rows.map(x=>({id:x.id,version:x.version,data:x.deleted?null:JSON.parse(x.payload),deleted:!!x.deleted})),cursor:nextCursor});
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
  if (path === "/v1/cloud/renew" && req.method === "POST") return cloudToken(req, env);
  if (path === "/v1/cloud/sync" && req.method === "POST") return syncCloud(req, env);
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
    await env.DB.prepare("INSERT INTO licenses(id,product_id,customer_name,customer_email,code_hash,status,paid_confirmed,plan,max_devices,expires_at,payment_reference,created_at,license_type,cloud_enabled) VALUES(?,?,?,?,?,'active',1,?,?,?,?,?,?,?)").bind(id, productId, customerName, String(d.customerEmail || "").slice(0,160), codeHash, dbPlan, maxDevices, expiresAt, paymentReference.slice(0,100), now, plan, plan === "test_day" ? 0 : 1).run();
    return json({ ok: true, id, productId, customerName, code, plan, maxDevices, expiresAt, createdAt: now }, 201);
  }
  const licenseRoute = path.match(/^\/admin\/licenses\/([0-9a-f-]{36})$/i);
  if (licenseRoute && req.method === "PATCH") {
    const d = await body(req), customerName = String(d.customerName || "").trim(), customerEmail = String(d.customerEmail || "").trim(), paymentReference = String(d.paymentReference || "").trim(), maxDevices = Number(d.maxDevices), cloudEnabled = typeof d.cloudEnabled === "boolean" ? (d.cloudEnabled ? 1 : 0) : null;
    if (customerName.length < 2 || customerName.length > 120 || customerEmail.length > 160 || paymentReference.length > 100 || !Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 10) return json({ error: "Nom, e-mail, référence ou nombre d’appareils invalide." }, 400);
    const r = await env.DB.prepare("UPDATE licenses SET customer_name=?,customer_email=?,payment_reference=?,max_devices=?,cloud_enabled=COALESCE(?,cloud_enabled) WHERE id=? AND status IN ('active','revoked')").bind(customerName,customerEmail,paymentReference,maxDevices,cloudEnabled,licenseRoute[1]).run();
    return json({ ok: true, changed: r.meta?.changes || 0 });
  }
  if (licenseRoute && req.method === "DELETE") {
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
