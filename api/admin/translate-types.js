// One-shot translator for products.product_type (PT) → product_type_translations.ru
// via Anthropic Claude Haiku 4.5. Idempotent: only translates types missing from the table.
// POST with Bearer CRON_SECRET. No body needed.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = [
  'You translate Pingo Doce (Portuguese supermarket) product category names to Russian.',
  'Return a short, natural Russian category name suitable for a grocery-tracker UI.',
  'Keep brand words and foreign names as-is. Use plural nominative when appropriate.',
  'Return ONLY a JSON array of strings in the same order as the input, no comments, no extra keys.',
  'Example input: ["Batatas, Cebolas e Alhos","Queijo Estrangeiro","Vinho Branco","Frango"]',
  'Example output: ["Картофель, лук и чеснок","Импортные сыры","Белое вино","Курица"]',
].join(' ');

async function translateBatch(names) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: JSON.stringify(names) },
        { role: 'assistant', content: '[' },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const content = data.content?.[0]?.text;
  if (typeof content !== 'string') throw new Error(`Unexpected Anthropic response: ${text.slice(0, 300)}`);
  const arr = JSON.parse('[' + content);
  if (!Array.isArray(arr) || arr.length !== names.length) {
    throw new Error(`Expected ${names.length} translations, got ${arr.length}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  const { data: allTypes } = await supabase.from('products').select('product_type').not('product_type', 'is', null);
  const { data: existing } = await supabase.from('product_type_translations').select('pt');
  const have = new Set((existing || []).map((r) => r.pt));
  const uniq = Array.from(new Set((allTypes || []).map((r) => r.product_type))).filter((t) => t && !have.has(t));
  if (uniq.length === 0) return res.status(200).json({ ok: true, missing: 0, translated: 0, elapsed_ms: Date.now() - started });

  const batchSize = 60;
  let translated = 0;
  for (let i = 0; i < uniq.length; i += batchSize) {
    const chunk = uniq.slice(i, i + batchSize);
    const ru = await translateBatch(chunk);
    const inserts = chunk.map((pt, j) => ({ pt, ru: ru[j] }));
    const { error: insErr } = await supabase.from('product_type_translations').upsert(inserts, { onConflict: 'pt' });
    if (insErr) return res.status(500).json({ ok: false, translated, error: insErr.message });
    translated += chunk.length;
  }
  return res.status(200).json({ ok: true, missing_before: uniq.length, translated, elapsed_ms: Date.now() - started });
}
