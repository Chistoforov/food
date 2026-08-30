// GET /api/catalog-search?q=<string>&lang=ru|pt
// Looks up Pingo Doce full catalog (catalog_products). If lang=ru and query has
// Cyrillic, translates RU→PT via Claude Haiku first. Read-only, no auth: the
// same catalog is already reachable via the anon key from the client — this
// endpoint just keeps the Anthropic key server-side.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const TRANSLATE_SYSTEM = [
  'You translate a shopping search query from Russian to Portuguese for use',
  'against a Portuguese supermarket (Pingo Doce) product catalog.',
  'Return ONLY the Portuguese words — no quotes, no explanation, no punctuation.',
  'Keep it short (1–4 words). Prefer canonical Portuguese grocery terms.',
  'Examples:',
  'молоко → leite',
  'тесто ротти → massa roti',
  'йогурт натуральный → iogurte natural',
  'куриная грудка → peito de frango',
].join(' ');

async function translateRuToPt(q) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      temperature: 0,
      system: [{ type: 'text', text: TRANSLATE_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: q }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  const content = data.content?.[0]?.text;
  if (typeof content !== 'string') throw new Error(`Unexpected Anthropic response: ${text.slice(0, 200)}`);
  return content.trim().replace(/^["'`]|["'`.]$/g, '').trim();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE env' });
  }

  const params = req.method === 'GET' ? req.query : (req.body || {});
  const rawQ = typeof params.q === 'string' ? params.q : '';
  const lang = params.lang === 'ru' ? 'ru' : 'pt';

  const q = rawQ.trim();
  if (q.length < 2) {
    return res.status(200).json({ translated_query: null, results: [] });
  }
  if (q.length > 80) {
    return res.status(400).json({ error: 'Query too long' });
  }

  let qPt = q;
  let translatedQuery = null;
  const hasCyrillic = /[Ѐ-ӿ]/.test(q);
  if (lang === 'ru' && hasCyrillic) {
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    try {
      const t = await translateRuToPt(q);
      if (t) {
        qPt = t;
        translatedQuery = t;
      }
    } catch (err) {
      // Fall back to raw query — better to search literally than to fail.
      console.warn('translate failed:', err.message);
    }
  }

  // Neutralize ILIKE wildcards in user input; supabase-js parameterizes the rest.
  const needle = qPt.replace(/[%_\\]/g, ' ').trim();
  if (!needle) return res.status(200).json({ translated_query: translatedQuery, results: [] });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('catalog_products')
    .select('id, name, brand, category1, category2, image_url')
    .eq('is_active', true)
    .or(`name.ilike.%${needle}%,brand.ilike.%${needle}%`)
    .order('name', { ascending: true })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    translated_query: translatedQuery,
    results: data || [],
  });
}
