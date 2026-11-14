#!/usr/bin/env node
// Checks the theme's includes against their contracts (D-042, COMP-002, COMP-004).
// Usage: node tools/check-components.mjs   Exits 1 on any failure.

import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { parse } from 'yaml';

const results = [];
const pass = (rule, what) => results.push({ ok: true, rule, what });
const fail = (rule, what) => results.push({ ok: false, rule, what });

const TYPES = ['text', 'url', 'enum', 'bool', 'asset'];
const SOURCES = ['request', 'claims', 'assets', 'site', 'fixed'];
// Sample facts an agent could copy: prices, times, years, phone numbers, email addresses (COMP-004).
const FACTLIKE = /\$\s?\d|\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b(19|20)\d{2}\b|\b\d{3}[ .-]\d{4}\b|[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const includes = readdirSync('_includes/gg').filter((f) => f.endsWith('.html')).map((f) => `gg/${f}`);
const contracts = readdirSync('_data/components').filter((f) => f.endsWith('.yml'))
  .map((f) => ({ file: f, ...parse(readFileSync(`_data/components/${f}`, 'utf8')) }));

const byInclude = new Map(contracts.map((c) => [c.include, c]));
for (const inc of includes) {
  byInclude.has(inc) ? pass('D-042', `${inc} has a contract`) : fail('D-042', `${inc} has no contract in _data/components/`);
}
for (const c of contracts) {
  const where = `_data/components/${c.file}`;
  if (!includes.includes(c.include)) { fail('D-042', `${where} names ${c.include}, which does not exist`); continue; }
  const missing = ['name', 'include', 'summary', 'formats', 'params'].filter((k) => c[k] === undefined);
  missing.length ? fail('D-042', `${where} lacks ${missing.join(', ')}`) : pass('D-042', `${where} has every field`);

  const params = c.params || [];
  const bad = params.filter((p) => !TYPES.includes(p.type) || !SOURCES.includes(p.source) || (p.type === 'enum' && !Array.isArray(p.values)));
  bad.length ? fail('D-042', `${where}: bad type, source or values for ${bad.map((p) => p.name).join(', ')}`) : pass('D-042', `${where}: types and sources are valid`);

  // The include reads exactly the parameters the contract lists.
  const source = readFileSync(`_includes/${c.include}`, 'utf8').replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  const used = new Set([...source.matchAll(/\binclude\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]));
  const declared = new Set(params.map((p) => p.name));
  const undeclared = [...used].filter((u) => !declared.has(u));
  const unused = [...declared].filter((d) => !used.has(d));
  undeclared.length ? fail('COMP-002', `${c.include} reads ${undeclared.join(', ')}, not in its contract`) : pass('COMP-002', `${c.include} reads only contract parameters`);
  unused.length ? fail('COMP-002', `${c.include} ignores ${unused.join(', ')}, listed in its contract`) : pass('COMP-002', `${c.include} reads every contract parameter`);

  for (const ex of c.examples || []) {
    const p = ex.params || {};
    const label = `${c.include} example ‘${ex.title}’`;
    const lacking = params.filter((d) => d.required && p[d.name] === undefined).map((d) => d.name);
    const unknown = Object.keys(p).filter((k) => !declared.has(k));
    const offEnum = params.filter((d) => d.type === 'enum' && p[d.name] !== undefined && !d.values.includes(p[d.name])).map((d) => d.name);
    lacking.length || unknown.length || offEnum.length
      ? fail('COMP-002', `${label}: ${[lacking.length && `missing ${lacking.join(', ')}`, unknown.length && `unknown ${unknown.join(', ')}`, offEnum.length && `not an allowed value: ${offEnum.join(', ')}`].filter(Boolean).join('; ')}`)
      : pass('COMP-002', `${label} matches the contract`);
    const facts = Object.entries(p).filter(([, v]) => FACTLIKE.test(String(v))).map(([k]) => k);
    facts.length ? fail('COMP-004', `${label}: ${facts.join(', ')} look like sample facts; use labeled placeholders`) : pass('COMP-004', `${label} uses placeholders`);
  }
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.rule.padEnd(9)} ${r.what}`);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Component contracts\n\n${failed.length ? failed.map((r) => `- **${r.rule}** ${r.what}`).join('\n') : `All ${results.length} checks passed.`}\n`);
}
process.exit(failed.length ? 1 : 0);
