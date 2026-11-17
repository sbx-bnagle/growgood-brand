// Read-only Google access for the asset sync (D-053): a service account signs a token request,
// then reads the register sheet and downloads Drive files. No Google client library needed.

import { createSign } from 'node:crypto';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

const b64url = (data) => Buffer.from(data).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// A signed JWT asking for an access token, from the service account's JSON key.
export function jwtAssertion(key, scopes = SCOPES, now = Math.floor(Date.now() / 1000)) {
  if (!key || !key.client_email || !key.private_key) throw new Error('the service account key needs client_email and private_key');
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
}

async function ok(res, what) {
  if (res.ok) return res;
  const text = await res.text().catch(() => '');
  throw new Error(`${what} failed: ${res.status} ${text.slice(0, 200)}`);
}

export async function accessToken(key, { scopes = SCOPES, fetchImpl = fetch } = {}) {
  const res = await ok(await fetchImpl(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwtAssertion(key, scopes) }),
  }), 'Google sign-in');
  return (await res.json()).access_token;
}

export async function sheetValues(token, spreadsheetId, range, { fetchImpl = fetch } = {}) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await ok(await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } }), 'Reading the register');
  return (await res.json()).values || [];
}

export async function driveFile(token, fileId, { fetchImpl = fetch } = {}) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await ok(await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } }), `Downloading Drive file ${fileId}`);
  return Buffer.from(await res.arrayBuffer());
}
