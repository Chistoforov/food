// Классифицирует recipe_ingredients.name_pt → product_type (единый ключ с product_type_stats),
// чтобы матчить ингредиенты рецепта на «что дома есть у пользователя».
//
// Идемпотентно: обрабатывает только строки где product_type IS NULL.
// Модель Claude Haiku 4.5 получает существующий словарь product_type
// (из product_type_stats) и биасит вывод к переиспользованию.
//
// POST Bearer CRON_SECRET. Body optional: { batchSize?, maxBatches?, familyId? }
//   familyId — из чьей семьи брать словарь (default: PD_FAMILY_ID).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const SYSTEM_PROMPT = [
  'You classify Portuguese recipe ingredients into a generic Russian kind (product_type).',
  'Ingredients come from Pingo Doce recipes.',
  'Return ONE short Russian noun in plural nominative describing WHAT the ingredient IS, ignoring brand, variety, size, packaging, processing state.',
  'Examples:',
  '  "cebola" → "лук"',
  '  "alho" → "чеснок"',
  '  "azeite virgem extra" → "оливковое масло"',
  '  "flocos de aveia" → "овсяные хлопья"',
  '  "leite" → "молоко"',
  '  "banana" → "бананы"',
  '  "iogurte natural" → "йогурт"',
  '  "sementes de chia" → "семена чиа"',
  '  "canela" → "корица"',
  '  "sal" → "соль"',
  '  "manteiga de amendoim" → "арахисовая паста"',
  '  "batata" → "картофель"',
  '  "brócolos" → "брокколи"',
  '  "massa conchas" → "макароны"',
  '  "pêssego de roer" → "персики"',
  '  "chocolate derretido" → "шоколад"',
  'Rules:',
  '  - Use ONLY nouns, plural nominative when the item is naturally counted in plural, else singular natural form.',
  '  - 1-3 words max. No adjectives unless truly required.',
  '  - Lowercase.',
  '  - CRITICAL: REUSE terms from the provided vocabulary when semantically equivalent. Only add a new term if none of the existing ones fit.',
].join('\n');

async function classifyBatch(names, vocabulary) {
  const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const userContent =
    `Vocabulary already used (reuse when possible): [${vocabulary.join(', ') || 'empty'}]\n\n` +
    `Classify each of these ${names.length} ingredients:\n${numbered}`;
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
        description: 'Store the generic Russian kind for each ingredient in order.',
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
  const batchSize = Math.min(100, Math.max(10, Number(body?.batchSize || 60)));
  const maxBatches = Math.min(40, Math.max(1, Number(body?.maxBatches || 12)));
  const familyId = Number(body?.familyId || DEFAULT_FAMILY_ID);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + 240_000;

  // Стартовый словарь: product_type_stats семьи + уже классифицированные recipe_ingredients.
  const vocabSet = new Set();
  {
    const { data: fromStats } = await supabase
      .from('product_type_stats')
      .select('product_type')
      .eq('family_id', familyId);
    for (const r of fromStats || []) if (r.product_type) vocabSet.add(r.product_type);
    const { data: fromRecipes } = await supabase
      .from('recipe_ingredients')
      .select('product_type')
      .not('product_type', 'is', null);
    for (const r of fromRecipes || []) if (r.product_type) vocabSet.add(r.product_type);
  }
  const vocabulary = [...vocabSet];

  const { count: remainingBefore } = await supabase
    .from('recipe_ingredients')
    .select('id', { count: 'exact', head: true })
    .is('product_type', null);

  let processed = 0;
  let batchesRun = 0;
  const samples = [];
  const newTerms = new Set();

  for (let i = 0; i < maxBatches; i++) {
    if (Date.now() >= deadline) break;
    const { data: rows, error } = await supabase
      .from('recipe_ingredients')
      .select('id, name_pt')
      .is('product_type', null)
      .order('id', { ascending: true })
      .limit(batchSize);
    if (error) return res.status(500).json({ error: `select: ${error.message}` });
    if (!rows || rows.length === 0) break;
    try {
      const types = await classifyBatch(rows.map((r) => r.name_pt), vocabulary);
      for (let j = 0; j < rows.length; j++) {
        const t = types[j];
        if (!t) continue;
        await supabase.from('recipe_ingredients').update({ product_type: t }).eq('id', rows[j].id);
        if (!vocabSet.has(t)) { vocabSet.add(t); vocabulary.push(t); newTerms.add(t); }
      }
      processed += rows.length;
      batchesRun++;
      if (samples.length < 5) samples.push([rows[0].name_pt, types[0]]);
    } catch (err) {
      return res.status(500).json({ error: `batch ${i + 1}: ${err.message}`, processed, batchesRun });
    }
  }

  const { count: remainingAfter } = await supabase
    .from('recipe_ingredients')
    .select('id', { count: 'exact', head: true })
    .is('product_type', null);

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    family_id: familyId,
    remainingBefore: remainingBefore ?? 0,
    processed,
    batches: batchesRun,
    remainingAfter: remainingAfter ?? 0,
    vocabulary_size: vocabulary.length,
    new_terms_this_run: [...newTerms],
    samples,
    hint: (remainingAfter ?? 0) > 0
      ? `Re-run to continue (${remainingAfter} ingredients left).`
      : 'All ingredients classified.',
  });
}
