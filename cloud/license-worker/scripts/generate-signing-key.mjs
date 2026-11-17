import { webcrypto } from 'node:crypto';
import { writeFile, chmod } from 'node:fs/promises';
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
await writeFile('private-key.jwk', JSON.stringify(privateJwk, null, 2), { mode: 0o600 });
await writeFile('public-key.jwk', JSON.stringify(publicJwk, null, 2), { mode: 0o644 });
try { await chmod('private-key.jwk', 0o600); } catch {}
console.log('Paire créée localement. private-key.jwk est un secret : ne pas le committer, l’envoyer ou l’ajouter à une archive.');
console.log('Clé publique (peut être intégrée dans les applications clientes) :');
console.log(JSON.stringify(publicJwk));
