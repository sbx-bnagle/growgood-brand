// Who is signed in: Cloudflare Access puts the request pages and their API behind Google sign-in
// (D-010, D-052) and sends a signed token with every request. This checks the token against the
// team’s published keys, its audience and its expiry, and returns the email it was issued to.

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const decode = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));
let certs = { issuer: '', at: 0, keys: [] };

const tokenFrom = (request) => request.headers.get('Cf-Access-Jwt-Assertion')
  || (request.headers.get('Cookie') || '').split(/;\s*/).find((c) => c.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length) || '';

export async function signedInEmail(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const team = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!team || !env.ACCESS_AUD) throw new HttpError(503, 'Sign-in is not set up yet.');
  const token = tokenFrom(request);
  if (!token) throw new HttpError(401, 'Sign in first.');
  const [h, p, s] = token.split('.');
  let header; let payload;
  try { header = decode(h); payload = decode(p); } catch { throw new HttpError(401, 'The sign-in token is unreadable.'); }
  const issuer = `https://${team}`;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (header.alg !== 'RS256' || payload.iss !== issuer || !aud.includes(env.ACCESS_AUD)) throw new HttpError(401, 'The sign-in token is not for this app.');
  if (!payload.exp || payload.exp * 1000 < now) throw new HttpError(401, 'The sign-in has expired. Reload the page.');
  if (certs.issuer !== issuer || now - certs.at > 3600_000 || !certs.keys.some((k) => k.kid === header.kid)) {
    const res = await fetchImpl(`${issuer}/cdn-cgi/access/certs`);
    if (!res.ok) throw new HttpError(503, 'Could not reach the sign-in service.');
    certs = { issuer, at: now, keys: (await res.json()).keys || [] };
  }
  const jwk = certs.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'The sign-in token’s key is unknown.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok || !payload.email) throw new HttpError(401, 'The sign-in token is not valid.');
  return String(payload.email).toLowerCase();
}

// Approvers are listed in the APPROVERS setting, comma-separated (D-047: Leah approves).
export const isApprover = (email, env) => (env.APPROVERS || '').toLowerCase().split(/[,\s]+/).filter(Boolean).includes(email);

// The drafter (the GitHub workflow) signs its calls with a shared secret, compared in constant time.
export function checkDrafter(request, env) {
  const want = env.DRAFTER_SECRET || '';
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!want) throw new HttpError(503, 'The drafter secret is not set up yet.');
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(want);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  if (diff) throw new HttpError(401, 'Not the drafter.');
}
