// Brand judge (D-054, checks/brand-judge.md): the rules and brand files it sends, the request it
// builds, and how a report becomes findings. A stand-in client replaces the Claude API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeRules, brandContext, draftText, judge, findingsFrom, SCHEMA } from '../tools/brand-judge.mjs';

const stub = (report, extra = {}) => {
  const client = { calls: [], beta: { messages: { stream: (params) => { client.calls.push(params); return { finalMessage: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 900, cache_read_input_tokens: 0, output_tokens: 80 }, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(report) }], ...extra }) }; } } } };
  return client;
};
const REPORT = {
  summary: 'One price is not in the claims register.',
  facts: [
    { text: 'Saturday, May 2', source: 'request', claim: '', note: '' },
    { text: '$40 per bed', source: 'none', claim: '', note: 'No price in the register.' },
  ],
  findings: [{ rule: 'VOICE-002', quote: 'amazing', problem: 'Hype word.', fix: 'Say what it does.' }],
};

test('the judge applies the rules in checks/brand-judge.md, from the files that hold them', () => {
  const rules = judgeRules();
  assert.ok(rules.includes('MECH-007') && rules.includes('CLAIM-001') && rules.includes('VOICE-001'));
  const paths = brandContext().map((f) => f.path);
  for (const p of ['brand/claims.md', 'brand/verbal/voice.md', 'brand/verbal/mechanics.md', 'brand/system/components.md']) assert.ok(paths.includes(p), p);
  assert.ok(!paths.includes('brand/visual/logo.md'));
  assert.ok(!brandContext()[0].text.startsWith('---'), 'front matter is left out');
});

test('a draft is read as the words a reader sees', () => {
  assert.equal(draftText('---\ntitle: Plant day\n---\n# Plant day\n\nJoin us **Saturday, May 2**. <span>Free</span>\n', '.md'), '# Plant day\n# Plant day\nJoin us Saturday, May 2. Free');
});

test('one request: structured output, cached brand files, and the draft and request after them', async () => {
  const client = stub(REPORT);
  const r = await judge({ drafts: [{ file: 'flyer.md', text: 'Plant day, $40 per bed' }], request: 'Plant day, Saturday, May 2', client, today: '2026-11-17' });
  const p = client.calls[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.output_config.format, { type: 'json_schema', schema: SCHEMA });
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(p.system[0].text.includes('<brand_file path="brand/claims.md">'));
  assert.ok(!p.system[0].text.includes('2026-11-17'), 'the date stays out of the cached part');
  assert.match(p.messages[0].content, /Today is 2026-11-17[\s\S]*<request>\nPlant day, Saturday, May 2\n<\/request>[\s\S]*<draft file="flyer.md">/);
  assert.deepEqual(r.findings.map((f) => [f.rule, f.level]), [['CLAIM-001', 'error'], ['VOICE-002', 'warn']]);
});

test('on a site pull request an unmatched fact warns, until claims.md is approved', () => {
  assert.deepEqual(findingsFrom(REPORT, { site: true }).map((f) => f.level), ['warn', 'warn']);
});

test('no key, a refusal or a broken report are said plainly, never as a pass', async () => {
  const saved = [process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN];
  delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN;
  try { assert.equal((await judge({ drafts: [] })).skipped, 'no ANTHROPIC_API_KEY'); } finally {
    if (saved[0] !== undefined) process.env.ANTHROPIC_API_KEY = saved[0];
    if (saved[1] !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = saved[1];
  }
  assert.match((await judge({ drafts: [], client: stub(REPORT, { stop_reason: 'refusal', stop_details: { category: 'cyber' } }) })).skipped, /declined \(cyber\)/);
  assert.match((await judge({ drafts: [], client: stub(REPORT, { content: [{ type: 'text', text: '{"summary":' }] }) })).skipped, /not valid JSON/);
});
