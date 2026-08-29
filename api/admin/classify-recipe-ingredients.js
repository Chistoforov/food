// Классифицирует recipe_ingredients.name_pt → product_type (единый ключ с product_type_stats).
//
// Идемпотентно: обрабатывает только строки где product_type IS NULL.
//
// Оптимизации:
//   1) Дедуп по lower(name_pt): каждое уникальное PT-имя классифицируем один раз,
//      результат разливаем на все строки с тем же lower(name_pt).
//   2) Exact-match fast path: если то же lower(name_pt) уже классифицировано
//      где-то в recipe_ingredients — переиспользуем без LLM.
//   3) Vocabulary фиксирован для всего run'а (не мутируется внутри цикла),
//      живёт в кэшируемом system-блоке.
//   4) Batched UPDATE через .in('id', ids) — одна запись на уникальный ключ.
//
// POST Bearer CRON_SECRET. Body optional: { batchSize?, maxBatches?, familyId? }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const BASE_SYSTEM_PROMPT = [
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

function buildSystemBlock(vocabulary) {
  const vocabLine = `Vocabulary already used (reuse when possible): [${vocabulary.join(', ') || 'empty'}]`;
  return `${BASE_SYSTEM_PROMPT}\n\n${vocabLine}`;
}

async function classifyBatch(names, systemText) {
  const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
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
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
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
      messages: [{ role: 'user', content: `Classify each of these ${names.length} ingredients:\n${numbered}` }],
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

async function fetchAllPending(supabase) {
  const out = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('id, name_pt')
      .is('product_type', null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw new Error(`select unclassified: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return out;
}

async function fetchAlreadyClassified(supabase) {
  const out = new Map(); // lower(name_pt) -> product_type
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('name_pt, product_type')
      .not('product_type', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw new Error(`select classified: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const key = (r.name_pt || '').toLowerCase();
      if (!key) continue;
      if (!out.has(key)) out.set(key, r.product_type);
    }
    if (data.length < step) break;
    from += step;
  }
  return out;
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

  // 1. Загружаем всё нужное для дедупа и exact-match переиспользования.
  const [pendingRows, alreadyClassified] = await Promise.all([
    fetchAllPending(supabase),
    fetchAlreadyClassified(supabase),
  ]);

  // Группируем pending rows по lower(name_pt).
  const idsByKey = new Map();       // key -> [id, id, ...]
  const nameByKey = new Map();      // key -> representative name_pt (для LLM)
  for (const r of pendingRows) {
    const key = (r.name_pt || '').toLowerCase();
    if (!key) continue;
    if (!nameByKey.has(key)) nameByKey.set(key, r.name_pt);
    const arr = idsByKey.get(key) ?? [];
    arr.push(r.id);
    idsByKey.set(key, arr);
  }

  // 2. Собираем словарь один раз (для system-блока, не мутируется в цикле).
  const vocabSet = new Set(alreadyClassified.values());
  {
    const { data: fromStats } = await supabase
      .from('product_type_stats')
      .select('product_type')
      .eq('family_id', familyId);
    for (const r of fromStats || []) if (r.product_type) vocabSet.add(r.product_type);
  }
  const vocabulary = [...vocabSet];
  const systemText = buildSystemBlock(vocabulary);

  const stats = {
    pending_rows: pendingRows.length,
    unique_names: nameByKey.size,
    reused_from_existing: 0,
    llm_classified: 0,
    rows_updated: 0,
    batches: 0,
    new_terms_this_run: new Set(),
    samples: [],
  };

  // 3. Разделяем на fast-path (уже классифицировано где-то ещё) и LLM-кандидатов.
  const fastPath = [];   // [key, product_type]
  const llmKeys = [];    // key strings
  for (const key of nameByKey.keys()) {
    const existing = alreadyClassified.get(key);
    if (existing) fastPath.push([key, existing]);
    else llmKeys.push(key);
  }

  // 4. Применяем fast-path одним batched update per key.
  await Promise.all(
    fastPath.map(async ([key, productType]) => {
      const ids = idsByKey.get(key);
      const { error } = await supabase
        .from('recipe_ingredients')
        .update({ product_type: productType })
        .in('id', ids);
      if (error) throw new Error(`fast-path update: ${error.message}`);
      stats.rows_updated += ids.length;
      stats.reused_from_existing += 1;
    })
  );

  // 5. LLM-цикл по уникальным неклассифицированным именам.
  for (let i = 0; i < llmKeys.length; i += batchSize) {
    if (stats.batches >= maxBatches || Date.now() >= deadline) break;
    const keyChunk = llmKeys.slice(i, i + batchSize);
    const nameChunk = keyChunk.map((k) => nameByKey.get(k));
    let types;
    try {
      types = await classifyBatch(nameChunk, systemText);
    } catch (err) {
      return res.status(500).json({
        error: `batch ${stats.batches + 1}: ${err.message}`,
        stats: {
          ...stats,
          new_terms_this_run: [...stats.new_terms_this_run],
        },
      });
    }
    await Promise.all(
      keyChunk.map(async (key, j) => {
        const t = types[j];
        if (!t) return;
        const ids = idsByKey.get(key);
        const { error } = await supabase
          .from('recipe_ingredients')
          .update({ product_type: t })
          .in('id', ids);
        if (error) throw new Error(`llm update: ${error.message}`);
        stats.rows_updated += ids.length;
        if (!vocabSet.has(t)) stats.new_terms_this_run.add(t);
      })
    );
    stats.llm_classified += keyChunk.length;
    stats.batches++;
    if (stats.samples.length < 5) stats.samples.push([nameChunk[0], types[0]]);
  }

  const { count: remainingAfter } = await supabase
    .from('recipe_ingredients')
    .select('id', { count: 'exact', head: true })
    .is('product_type', null);

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    family_id: familyId,
    vocabulary_size: vocabulary.length,
    ...stats,
    new_terms_this_run: [...stats.new_terms_this_run],
    remaining_rows: remainingAfter ?? 0,
    hint: (remainingAfter ?? 0) > 0
      ? `Re-run to continue (${remainingAfter} rows still unclassified).`
      : 'All ingredients classified.',
  });
}
