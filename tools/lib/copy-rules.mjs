// The copy linter's rules (D-054, checks/lint-copy.md), from brand/verbal/mechanics.md (MECH),
// names-and-dates.md (NAMES), voice.md (VOICE) and spelling.yml. Each rule takes a segment's text
// and returns its matches as { index, length, note }. `level` is the level proposed for launch;
// until launch every finding warns (D-054, O-20).

// Proper nouns a heading may capitalize (MECH-002). Add a name here when it is a false finding;
// brand/verbal/vocabulary.md takes this list over once it is written.
export const PROPER = new Set([
  'Grow', 'Good', 'Gardens', 'Leah', 'Fagan', 'Brad', 'Nagle',
  'Chicago', 'Chicagoland', 'Midwest', 'Upper', 'Illinois', 'Wisconsin', 'Indiana', 'Michigan', 'Minnesota', 'Iowa', 'America', 'American', 'English',
  'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Pinterest', 'Google', 'Drive', 'Sheets', 'Docs', 'Figma', 'Jekyll', 'GitHub', 'Cloudflare', 'MailerLite', 'Claude', 'Stripe',
  'Alegreya', 'Sans', 'Kinross', 'Robin', 'Robert', 'Wearing', 'Letter',
  'Actions', 'Pages', 'Access', 'Storybook', 'Sass', 'Markdown', 'Starter',
  'Foundations', 'Components', 'Templates', // the Figma library’s page names (D-032)
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'I', 'Susan',
]);

const DAYS = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const TIME = String.raw`\d{1,2}(?::\d\d)?\s?(?:am|pm|a\.m\.|p\.m\.)`;

// A quoted span: ‘…’ or “…”. An apostrophe inside a word does not end it.
const QUOTED = /‘(?:[^‘’\n]|’(?=\p{L}))*’(?!\p{L})|“[^“”\n]*”/gu;

// Words inside curly quotes are quoted examples or someone else’s words: blank them, keeping
// every offset, so only the quote rules read them.
export function maskQuotes(text) {
  return text.replace(QUOTED, (m) => m[0] + '…'.repeat(m.length - 2) + m[m.length - 1]);
}

const all = (re, text, note) => [...text.matchAll(re)].map((m) => ({ index: m.index, length: m[0].length, note: typeof note === 'function' ? note(m) : note }));

// Capitalized words after the first, in a heading, that are not proper nouns (MECH-002).
export function headingCaps(text) {
  // An ID at the start (D-054, MECH-001.) is not the heading’s first word.
  const id = text.match(/^\s*(?:[A-Z]{1,6}-\d{2,4}\.?\s+)+/);
  const from = id ? id[0].length : 0;
  const out = [];
  let first = true;
  for (const m of text.slice(from).matchAll(/[|·:?!.]\s|\p{L}[\p{L}\p{M}\d’'-]*/gu)) {
    const w = m[0];
    if (/^[|·?!.]\s$/.test(w)) { first = true; continue; } // a new title or sentence starts
    if (/^:\s$/.test(w)) { first = true; continue; } // either case may follow a colon
    if (first) { first = false; continue; }
    const core = w.replace(/[’'].*$/, '');
    if (!/^\p{Lu}\p{Ll}/u.test(core)) continue;
    if (/\p{Lu}/u.test(core.slice(1))) continue; // GitHub, TikTok
    if (PROPER.has(core) || PROPER.has(core.split('-')[0])) continue;
    out.push({ index: from + m.index, length: w.length, note: w });
  }
  return out;
}

export function buildRules(spelling) {
  const stems = (spelling.stems || []).map(({ uk, us, except = [] }) => ({ re: new RegExp(`\\b${uk}\\w*`, 'gi'), us, except }));
  const choices = (spelling.word_choice || []).map(({ avoid, use }) => ({ re: new RegExp(`\\b${avoid}\\b`, 'gi'), avoid, use }));
  return [
    { id: 'MECH-001', level: 'error', msg: 'em dash or double hyphen; an en dash, unspaced, only for ranges', test: (t) => all(/—|(?<!-)--(?!-)|\w – \w|\w - \w/g, t) },
    { id: 'MECH-002', level: 'error', msg: 'title case in a heading or button', kinds: ['heading'], test: (t) => headingCaps(t) },
    { id: 'MECH-003', level: 'error', msg: 'double quotes outside a quote; use single', raw: true, test: (t) => {
      const singles = t.replace(/‘(?:[^‘’\n]|’(?=\p{L}))*’(?!\p{L})/gu, (m) => ' '.repeat(m.length));
      return all(/“(?=\p{L})/gu, singles);
    } },
    { id: 'MECH-004', level: 'error', msg: 'straight quote or apostrophe', raw: true, test: (t) => all(/\p{L}'\p{L}|(?:^|\s)'\p{L}|\p{L}'(?=\s|[.,;:!?)]|$)|"/gu, t) },
    { id: 'MECH-005', level: 'error', msg: 'capital am, pm or unit', test: (t) => all(/\b\d+(?:[.:]\d+)?\s?(?:AM|PM|A\.M\.|P\.M\.|MM|CM|FT|LBS?|OZ|GAL)\b/g, t) },
    { id: 'MECH-006', level: 'error', msg: 'space between number and unit, or time and am or pm', test: (t) => all(/\b\d+(?:[.:]\d+)?\s(?:mm|cm|ft|sq ?ft|lbs?|oz|gal|am|pm|a\.m\.|p\.m\.)(?!\p{L})/giu, t) },
    { id: 'MECH-007', level: 'error', msg: 'comma or period outside a closing quote', raw: true, test: (t) => [...t.matchAll(QUOTED)].filter((m) => /[.,]/.test(t[m.index + m[0].length] || '')).map((m) => ({ index: m.index, length: m[0].length + 1 })) },
    { id: 'MECH-008', level: 'error', msg: 'two spaces after a period', raw: true, test: (t) => all(/\. {2,}(?=\S)/g, t) },
    { id: 'MECH-010', level: 'error', msg: 'UK spelling', test: (t) => stems.flatMap(({ re, us, except }) => all(re, t, (m) => `${m[0]} → ${us}…`).filter((h) => !except.some((e) => t.substr(h.index, h.length).toLowerCase().startsWith(e)))) },
    { id: 'MECH-011', level: 'error', msg: 'word choice', test: (t) => choices.flatMap(({ re, avoid, use }) => all(re, t, `${avoid} → ${use}`)) },
    { id: 'MECH-012', level: 'error', msg: 'exclamation mark', test: (t) => all(/\p{L}!(?=\s|$|[’”)])/gu, t) },
    { id: 'MECH-013', level: 'error', msg: 'emoji', test: (t) => all(/(?![©®™])\p{Extended_Pictographic}/gu, t) },
    { id: 'NAMES-002', level: 'error', msg: 'write ‘Upper Midwest’', test: (t) => all(/\b[Uu]pper [Mm]idwest\b/g, t).filter((h) => t.substr(h.index, h.length) !== 'Upper Midwest') },
    { id: 'NAMES-003', level: 'error', msg: 'event date: weekday, month, day, written out', test: (t) => [
      ...all(new RegExp(String.raw`\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+\d{1,2}\b`, 'g'), t, 'month abbreviated'),
      ...all(new RegExp(String.raw`\b(?:Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat|Sun)\.?,?\s+(?:${MONTHS})\b`, 'g'), t, 'weekday abbreviated'),
      ...all(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, t, 'date in numbers'),
      ...all(new RegExp(String.raw`\b(?:${MONTHS})\s+\d{1,2}(?:st|nd|rd|th)\b`, 'g'), t, 'ordinal day'),
      ...all(new RegExp(String.raw`(?<!(?:${DAYS}|Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat|Sun)\.?,\s)\b(?:${MONTHS})\s+\d{1,2}\b(?!\d|st|nd|rd|th)`, 'g'), t, 'no weekday'),
    ] },
    { id: 'NAMES-004', level: 'error', msg: 'time: ‘10:00am’, ‘noon’', test: (t) => all(/(?<![:\d])\d{1,2}(?:am|pm)\b|\b\d{1,2}(?::\d\d)?\s?[ap]\.m\.|\b12:00\s?pm\b/gi, t) },
    { id: 'NAMES-005', level: 'error', msg: 'date and time: ‘Saturday, May 16, 10:00am–noon’', test: (t) => all(new RegExp(String.raw`\b(?:${DAYS}),\s(?:${MONTHS})\s\d{1,2}(?:,\s\d{4})?(?!,\s)\s*(?:at|@|from|starting at|[-–])?\s*${TIME}`, 'gi'), t) },
    { id: 'VOICE-003', level: 'warn', msg: 'hedge', test: (t) => all(/\b(?:you might (?:want to|consider|like to)|some gardeners prefer|you may (?:want|wish) to|perhaps you|it might be worth)\b/gi, t) },
    { id: 'VOICE-005', level: 'warn', msg: '‘don’t worry’', test: (t) => all(/\bdon[’']t worry\b/gi, t) },
  ];
}

// NAMES-001 reads a whole file: the first mention is ‘Grow Good Gardens’.
export function firstMention(segments) {
  for (const s of segments) {
    const t = maskQuotes(s.text);
    const m = t.match(/\bGrow Good\b/);
    if (!m) continue;
    return t.slice(m.index, m.index + 17) === 'Grow Good Gardens' ? [] : [{ segment: s, index: m.index, length: 9 }];
  }
  return [];
}
