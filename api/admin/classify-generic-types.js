// Reclassify products.product_type as a generic Russian kind ("помидоры", "молоко")
// derived from name/name_ru via Anthropic Claude Haiku 4.5.
// Iterative: each batch is shown the vocabulary already used so it reuses terms.
// POST Bearer CRON_SECRET. Body optional: {familyId?, batchSize?, dryRun?}
// Not idempotent by design — every call reclassifies ALL products of the family.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const SYSTEM_PROMPT = [
  'You classify Portuguese grocery products (from Pingo Doce receipts) into a generic Russian kind.',
  'Return ONE short Russian noun in plural nominative describing WHAT the product IS, ignoring brand, variety, size, packaging, processing state.',
  'Examples:',
  '  "Tomate Cherry Vermelho 250g" → "помидоры"',
  '  "Leite UHT Magro Pingo Doce 1L" → "молоко"',
  '  "Pão de Forma Integral" → "хлеб"',
  '  "Frango Coxas 700g" → "курица"',
  '  "Vinho Alentejano Ravasqueira 75cl" → "вино"',
  '  "Iogurte Grego Oikos Stracciatella 4x110g" → "йогурт"',
  '  "Papel Higiénico Renova 12 rolos" → "туалетная бумага"',
  '  "Batatinha para Assar 500g" → "картофель"',
  '  "Framboesa Driscolls 125g" → "малина"',
  '  "Salmão Posta 300g" → "лосось"',
  'Rules:',
  '  - Use ONLY nouns, plural nominative when the item is naturally counted in plural ("помидоры","огурцы","йогурты"), else the singular natural form ("молоко","хлеб","мука","курица","сыр","кофе","чай","масло","вода","рис","мясо").',
  '  - 1–3 words max. No adjectives unless truly required to disambiguate (avoid "молоко коровье" — just "молоко").',
  '  - Lowercase.',
  '  - REUSE terms from the provided vocabulary when semantically equivalent. Only add a new term if none of the existing ones fit.',
  '  - Return ONLY a JSON array of strings in the same order as the input.',
].join('\n');

async function classifyBatch(names, vocabulary) {
  const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const userContent = `Vocabulary already used (reuse when possible): [${vocabulary.join(', ') || 'empty'}]\n\nClassify each of these ${names.length} items:\n${numbered}`;
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
      temperature: 0,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [{
        name: 'store_classifications',
        description: 'Store the generic Russian kind for each item in order.',
        input_schema: {
          type: 'object',
          properties: {
            types: {
              type: 'array',
              minItems: names.length,
              maxItems: names.length,
              items: { type: 'string' },
              description: `Exactly ${names.length} entries, one per input item in the same order.`,
            },
          },
          required: ['types'],
        },
      }],
      tool_choice: { type: 'tool', name: 'store_classifications' },
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use');
  const arr = toolUse?.input?.types;
  if (!Array.isArray(arr) || arr.length !== names.length) {
    throw new Error(`Expected ${names.length} classifications, got ${Array.isArray(arr) ? arr.length : 'nothing'}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const familyId = Number(body?.familyId || DEFAULT_FAMILY_ID);
  const batchSize = Math.min(150, Math.max(10, Number(body?.batchSize || 80)));
  const dryRun = Boolean(body?.dryRun);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  const { data: products, error: selErr } = await supabase
    .from('products')
    .select('id, name, name_ru')
    .eq('family_id', familyId)
    .order('id');
  if (selErr) return res.status(500).json({ error: `select: ${selErr.message}` });
  if (!products || products.length === 0) return res.status(200).json({ ok: true, total: 0 });

  const inputs = products.map((p) => p.name_ru || p.name);
  const vocabulary = [];
  const vocabSet = new Set();
  const classifications = [];
  const batches = [];

  async function classifyRobust(chunk, vocab, depth = 0) {
    try {
      return await classifyBatch(chunk, vocab);
    } catch (err) {
      if (depth === 0) {
        try { return await classifyBatch(chunk, vocab); } catch { /* fall to split */ }
      }
      if (chunk.length <= 2 || depth >= 4) throw err;
      const mid = Math.ceil(chunk.length / 2);
      const left = await classifyRobust(chunk.slice(0, mid), vocab, depth + 1);
      const newVocab = [...vocab];
      for (const t of left) if (t && !newVocab.includes(t)) newVocab.push(t);
      const right = await classifyRobust(chunk.slice(mid), newVocab, depth + 1);
      return [...left, ...right];
    }
  }

  for (let i = 0; i < inputs.length; i += batchSize) {
    const chunk = inputs.slice(i, i + batchSize);
    const ru = await classifyRobust(chunk, vocabulary);
    classifications.push(...ru);
    for (const term of ru) {
      if (term && !vocabSet.has(term)) { vocabSet.add(term); vocabulary.push(term); }
    }
    batches.push({ batch: batches.length + 1, size: chunk.length, sample: [chunk[0], ru[0]] });
  }

  if (dryRun) {
    return res.status(200).json({
      ok: true, dryRun: true, total: products.length, distinct_types: vocabulary.length,
      vocabulary, sample_map: products.slice(0, 20).map((p, j) => ({ name: inputs[j], generic: classifications[j] })),
      elapsed_ms: Date.now() - started,
    });
  }

  let updated = 0;
  for (let i = 0; i < products.length; i++) {
    const generic = classifications[i];
    if (!generic) continue;
    await supabase.from('products').update({ product_type: generic }).eq('id', products[i].id);
    updated++;
  }
  await supabase.rpc('recalculate_product_type_stats', { p_family_id: familyId });

  return res.status(200).json({
    ok: true, total: products.length, updated, distinct_types: vocabulary.length,
    vocabulary_sample: vocabulary.slice(0, 30),
    batches, elapsed_ms: Date.now() - started,
  });
}
