// The asset register and the library manifest (D-053): register rows, which ones agents may use,
// image measurements read from file headers, and the manifest that includes and agents read.

import { extname, basename } from 'node:path';

export const TYPES = ['photo', 'illustration', 'spot', 'icon', 'logo', 'partner-logo'];
export const SEASONS = ['spring', 'summer', 'fall', 'winter', 'any'];
export const RIGHTS = ['owned', 'licensed', 'permission']; // ‘unknown’ never reaches the library
export const LIMITS = { edge: 2400, bytes: 2_000_000 }; // web size: longest edge in px, file size
export const LIBRARY = 'assets/library';
export const MANIFEST = '_data/assets.yml';

// Register values (first row = headers) to row objects; blank rows dropped.
export function rowsFromValues(values = []) {
  const [head = [], ...rest] = values;
  const keys = head.map((h) => String(h).trim());
  return rest
    .filter((r) => r.some((c) => String(c ?? '').trim()))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, String(r[i] ?? '').trim()])));
}

// Why a row cannot go to the library, or null when it can.
export function unusableReason(row) {
  if (row.status !== 'approved') return `status is ${row.status || 'blank'}`;
  if (!RIGHTS.includes(row.usage_rights)) return `usage_rights is ${row.usage_rights || 'blank'}`;
  if (!row.alt_text) return 'alt_text is blank';
  if (!row.drive_file_id) return 'drive_file_id is blank';
  if (!/^A-\d{4}$/.test(row.asset_id)) return `asset_id ${row.asset_id || 'blank'} is not A-0000`;
  if (!TYPES.includes(row.type)) return `type ${row.type || 'blank'} is not one of ${TYPES.join(', ')}`;
  return null;
}

// The library file name: the asset id, then the Drive file name in lowercase.
export function libraryName(row) {
  const ext = extname(row.file_name).toLowerCase();
  const stem = basename(row.file_name, extname(row.file_name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${row.asset_id}-${stem || 'file'}${ext}`;
}

// Width and height from a file's header: PNG, GIF, JPEG, WebP or SVG. Null when unreadable.
export function imageSize(buf) {
  const b = Buffer.from(buf);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i += 1; continue; } // fill byte
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
    return null;
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) }; }
    return null;
  }
  const text = b.toString('utf8', 0, Math.min(b.length, 4096));
  const svg = text.match(/<svg\b[^>]*>/i);
  if (svg) {
    const attr = (n) => { const m = svg[0].match(new RegExp(`\\b${n}\\s*=\\s*["']([\\d.]+)(px)?["']`, 'i')); return m ? Math.round(Number(m[1])) : null; };
    const w = attr('width'); const h = attr('height');
    if (w && h) return { width: w, height: h };
    const vb = svg[0].match(/viewBox\s*=\s*["'][\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)["']/i);
    if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
  }
  return null;
}

export const orientation = ({ width, height }) => {
  const r = width / height;
  return r > 1.1 ? 'landscape' : r < 0.9 ? 'portrait' : 'square';
};

// Problems that keep a measured file out of the library: unreadable, or bigger than web size.
export function sizeProblem(size, bytes) {
  if (!size) return 'its size cannot be read';
  if (Math.max(size.width, size.height) > LIMITS.edge) return `it is ${size.width}×${size.height}px; the longest edge may be ${LIMITS.edge}px`;
  if (bytes > LIMITS.bytes) return `it is ${(bytes / 1e6).toFixed(1)}MB; the limit is ${LIMITS.bytes / 1e6}MB`;
  return null;
}

export function manifestItem(row, file, size) {
  return {
    id: row.asset_id,
    url: `/${LIBRARY}/${file}`,
    type: row.type,
    style: row.style || '',
    subjects: row.subjects ? row.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
    season: SEASONS.includes(row.season) ? row.season : 'any',
    orientation: orientation(size),
    width: size.width,
    height: size.height,
    alt: row.alt_text,
    credit: row.credit || '',
    rights: row.usage_rights,
  };
}

// The manifest: every item, plus the logo rows the wordmark include reads (D-037).
export function buildManifest(items) {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  return { items: sorted, logos: sorted.filter((i) => i.type === 'logo') };
}
