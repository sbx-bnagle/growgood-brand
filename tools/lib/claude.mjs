// One structured request to Claude, shared by the brand judge and the request drafter. The
// instructions and brand files go in a cached system prompt; the reply is held to a JSON schema
// (structured outputs). Streamed, as thinking and long replies can outrun a plain request’s
// timeout. Server-side fallbacks re-run a declined request on another model.

export const MODEL = 'claude-opus-5-5';

export async function structured({ system, user, schema, client = null, model = MODEL, effort = 'high', maxTokens = 32000 }) {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return { ok: false, reason: 'no ANTHROPIC_API_KEY' };
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic();
  }
  const message = await client.beta.messages.stream({
    model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  }).finalMessage();
  const u = message.usage || {};
  const base = { model: message.model || model, usage: { input: u.input_tokens, cached: u.cache_read_input_tokens, output: u.output_tokens } };
  if (message.stop_reason === 'refusal') return { ...base, ok: false, reason: `the model declined (${message.stop_details?.category || 'no category'})` };
  if (message.stop_reason === 'max_tokens') return { ...base, ok: false, reason: 'the reply ran past its length limit' };
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return { ...base, ok: true, data: JSON.parse(text) }; } catch { return { ...base, ok: false, reason: 'the reply was not valid JSON' }; }
}
