// Style check (D-054, checks/stylelint.md): type values come from tokens (TYPE-001 to TYPE-003).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import stylelint from 'stylelint';
import config from '../stylelint.config.mjs';
import { lintStyles } from '../tools/lint-styles.mjs';

const ids = async (code) => {
  const { results: [r] } = await stylelint.lint({ code, config, codeFilename: 'x.scss' });
  return r.warnings.map((w) => w.text.split(' ')[0]);
};

test('tokens, Sass variables, functions and keywords pass', async () => {
  assert.deepEqual(await ids(`
    .a { font-family: var(--gg-font-family-sans); font-size: var(--gg-type-body-size); line-height: var(--gg-type-body-line); }
    .b { font-size: $font-size; line-height: bl(2); font-family: map-get($sans, stack); font-size: var(--ts-#{$role}-font-size); }
    .c { font: inherit; font-size: inherit; font-weight: 700; font-weight: bold; line-height: 24px; line-height: 0; }
  `), []);
});

test('literal values are findings, under their TYPE rule', async () => {
  assert.deepEqual(await ids(`
    .a { font-family: sans-serif; }
    .b { font-size: 14px; font-weight: 600; }
    .c { line-height: 1; line-height: 26px; }
    .d { font: 16px/1.5 serif; }
  `), ['TYPE-001', 'TYPE-002', 'TYPE-002', 'TYPE-003', 'TYPE-003', 'TYPE-001']);
});

test('token definitions and @font-face are not checked', async () => {
  assert.deepEqual(await ids(`
    $base-font-size: 100%;
    :root { --gg-type-body-size: 21px; --gg-type-body-line: 32px; }
    @font-face { font-family: icon; src: url(icon.woff); }
  `), []);
});

test('lintStyles reads Jekyll Sass entry files and skips vendor fonts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lint-styles-'));
  mkdirSync(join(root, 'css'));
  mkdirSync(join(root, 'fonts'));
  writeFileSync(join(root, 'css', 'main.scss'), '---\n---\n\n.a { font-size: 14px; }\n');
  writeFileSync(join(root, 'fonts', 'style.css'), '.icon { font-family: icomoon; }\n');
  const r = await lintStyles([root]);
  assert.equal(r.files, 1);
  assert.deepEqual(r.findings.map((f) => [f.rule, f.line]), [['TYPE-002', 4]]);
});
