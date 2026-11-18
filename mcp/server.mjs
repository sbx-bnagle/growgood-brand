#!/usr/bin/env node
// The Grow Good brand server (Phase 7, D-039, D-056): MCP tools for the brand rules, component
// contracts, the asset library, rendering print and social formats, and the copy and brand
// checks. It reads main on GitHub when each tool runs, so merged changes reach the next call.
// Run: node mcp/server.mjs (stdio). Claude Code finds it through .mcp.json at the repo root.
// GG_BRAND_SOURCE=<folder> reads a local checkout instead of GitHub; GG_RENDER_FROM=working
// renders from this checkout as it is on disk.

import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sourceFromEnv } from './source.mjs';
import { JOBS, guide, guideText, rule, components, component, assets } from './brand.mjs';
import { LAYOUTS, renderFormat, buildRoot } from './render.mjs';
import { lintSource } from '../tools/lint-copy.mjs';
import { judge, draftText, formatText as judgeText } from '../tools/brand-judge.mjs';

const KINDS = { markdown: '.md', html: '.html', text: '.txt' };
const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });
const READ = { readOnlyHint: true, openWorldHint: true };

export function createServer({ source = sourceFromEnv(), render = renderFormat, judgeFn = judge, judgeRepo = () => buildRoot().root } = {}) {
  const server = new McpServer({ name: 'growgood-brand', version: '0.1.0' });

  server.registerTool('brand_guide', {
    title: 'Brand files for a job',
    description: 'Start here. Returns every brand file a job needs, from main: the open decisions (do not build on them), the claims register (the only source of facts besides the request), the request ladder (make, adapt, brief a person, or stop and ask), then the job’s own voice, mechanics, format and visual rules. Planned files are named but not written yet.',
    inputSchema: { job: z.enum(Object.keys(JOBS)).describe(`The job: ${Object.entries(JOBS).map(([k, v]) => `${k} (${v})`).join(', ')}`) },
    annotations: READ,
  }, async ({ job }) => text(guideText(await guide(source, job))));

  server.registerTool('get_rule', {
    title: 'One brand rule',
    description: 'Returns a brand rule by its ID, such as MECH-007 or VOICE-002: the rule, why, how it is checked, its file and the file’s status. Cite the ID when a rule shapes a choice.',
    inputSchema: { id: z.string().regex(/^[A-Za-z]+-\d{3}$/).describe('A rule ID, such as NAMES-005') },
    annotations: READ,
  }, async ({ id }) => {
    const r = await rule(source, id);
    return r ? text(`${r.id} (${r.path}, ${r.status})\n\n${r.text}`) : fail(`No rule ${id.toUpperCase()} in the brand files.`);
  });

  server.registerTool('list_components', {
    title: 'Components',
    description: 'Lists the theme’s components (Jekyll includes) with their contracts’ summaries, the formats each is used in, and their params. Filter by format family.',
    inputSchema: { format: z.enum(['web', 'flyer', 'postcard', 'social']).optional() },
    annotations: READ,
  }, async ({ format }) => {
    const list = (await components(source)).filter((c) => !format || c.formats.includes(format));
    return text(list.map((c) => `${c.id}: ${c.summary || c.name} [${c.formats.join(', ')}] params: ${c.params.join(', ') || 'none'}`).join('\n'));
  });

  server.registerTool('get_component', {
    title: 'A component’s contract',
    description: 'Returns one component’s contract (_data/components/<id>.yml): each param’s type, whether required, its default, where its value must come from (the request, claims.md, the asset register or the site’s data), the rules it follows, and worked examples.',
    inputSchema: { id: z.string().describe('The component id, such as event-details') },
    annotations: READ,
  }, async ({ id }) => {
    const c = await component(source, id);
    return c ? text(c.text) : fail(`No component ‘${id}’. Use list_components.`);
  });

  server.registerTool('find_assets', {
    title: 'Approved images',
    description: 'Searches the approved asset library (_data/assets.yml): spots, illustrations, photographs and logos with alt text and rights. Only these may be used (D-009). Use the url in a component; the preview link shows the image.',
    inputSchema: {
      query: z.string().optional().describe('Words to match in subjects, alt text, type or style, such as “bee”'),
      type: z.string().optional().describe('spot, illustration, photo or logo'),
      season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']).optional(),
      orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
      limit: z.number().int().optional(),
    },
    annotations: READ,
  }, async (args) => {
    const list = await assets(source, args);
    if (!list.length) return text('No approved asset matches. Ask for one rather than using an image from elsewhere (D-009).');
    return text(list.map((a) => `${a.id} ${a.type} ${a.orientation} ${a.width}×${a.height} ${a.url}\n  alt: ${a.alt}\n  subjects: ${(a.subjects || []).join(', ')}; season: ${a.season}; rights: ${a.rights}; preview: ${a.preview}`).join('\n'));
  });

  server.registerTool('render_format', {
    title: 'Render a print or social format',
    description: 'Builds a format from components with the theme on main, saves it as PDF (print) or PNG (social), and runs preflight: exact size, content inside the padding, one page, embedded Alegreya Sans, image resolution. Parts are checked against their contracts first. Facts in params must come from the request or claims.md.',
    inputSchema: {
      format: z.enum(Object.keys(LAYOUTS)),
      title: z.string().optional().describe('A name for the draft'),
      parts: z.array(z.object({ component: z.string(), params: z.record(z.string(), z.string()).optional() })).describe('Components in order, each with its params as strings'),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  }, async ({ format, title, parts }) => {
    const r = await render({ format, parts, title });
    if (!r.ok) return fail(`Not rendered (${r.ref}):\n${r.problems.map((p) => `- ${p}`).join('\n')}`);
    const findings = r.findings.length ? r.findings.map((f) => `- ${f.check} ${f.rule}${f.target ? ` ${f.target}` : ''}: ${f.help}`).join('\n') : 'Preflight: no findings.';
    return text(`Rendered from ${r.ref}:\n${r.files.join('\n')}\n\n${findings}`);
  });

  server.registerTool('check_copy', {
    title: 'Copy linter',
    description: 'Checks text against the mechanics and names rules by pattern (MECH, NAMES, some VOICE): em dashes, title case, quotes, units, spelling, exclamation marks, dates and times. Run it on every draft before judge_draft.',
    inputSchema: { text: z.string(), kind: z.enum(Object.keys(KINDS)).default('markdown') },
    annotations: { readOnlyHint: true },
  }, async ({ text: t, kind }) => {
    const found = lintSource(t, KINDS[kind], 'draft');
    return text(found.length ? found.map((f) => `- ${f.rule} line ${f.line}: ${f.msg}: “${f.text}”`).join('\n') : 'No copy findings.');
  });

  server.registerTool('judge_draft', {
    title: 'Brand judge',
    description: 'Sends a draft and its request to the brand judge (Claude), which lists every fact and whether the request or claims.md confirms it, and each voice, claims and names rule the draft breaks. An unconfirmed fact blocks the draft. Needs ANTHROPIC_API_KEY; without it, says so.',
    inputSchema: { draft: z.string(), request: z.string().describe('The request or brief the draft was made from'), kind: z.enum(Object.keys(KINDS)).default('markdown') },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ draft, request, kind }) => {
    const r = await judgeFn({ drafts: [{ file: 'draft', text: draftText(draft, KINDS[kind]) }], request, repo: judgeRepo() });
    return text(judgeText(r));
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
