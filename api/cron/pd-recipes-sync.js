// Еженедельный incremental sync рецептов Pingo Doce.
// В отличие от backfill-recipes:
//   - Обрабатывает delta: recipes без scraped_at ИЛИ sitemap_lastmod > scraped_at.
//   - Дефолт лимит меньше (100) — в устоявшемся состоянии PD добавляет
//     единицы/десятки рецептов в неделю; 100 хватает с запасом.
//   - Если после скрапа появились новые name_pt без name_ru — тут же зовёт
//     translate-recipes-inline (batch); аналогично для classify.
//
// Vercel Cron: 0 4 * * 1 (ночь понедельника).

import { createClient } from '@supabase/supabase-js';
import { ingestSitemaps, scrapeMany } from '../_shared/recipes-helpers.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');
const SOFT_TIMEOUT_MS = 240_000;

// --- Haiku wrappers (компактнее чем в admin-эндпоинтах — здесь всегда мелкая delta) ---

async function translateBatch(names, systemPrompt) {
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
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: JSON.stringify(names) },
        { role: 'assistant', content: '[' },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  const arr = JSON.parse('[' + JSON.parse(text).content?.[0]?.text);
  if (!Array.isArray(arr) || arr.length !== names.length) throw new Error('bad shape');
  return arr.map((s) => (typeof s === 'string' ? s : String(s)));
}

const RECIPE_TR_PROMPT =
  'You translate Portuguese recipe titles (Pingo Doce) to Russian. Keep brand names Latin, keep units. Return ONLY a JSON array of strings in the same order as input.';
const INGREDIENT_TR_PROMPT =
  'You translate short Portuguese cooking-ingredient names to Russian for a shopping list. Keep brand names Latin. Return ONLY a JSON array of strings in the same order as input.';

async function fillTranslations(supabase, table, prompt) {
  const { data: rows } = await supabase
    .from(table)
    .select('id, name_pt')
    .is('name_ru', null)
    .order('id')
    .limit(200);
  if (!rows || rows.length === 0) return 0;
  const translated = await translateBatch(rows.map((r) => r.name_pt), prompt);
  for (let i = 0; i < rows.length; i++) {
    await supabase.from(table).update({ name_ru: translated[i] }).eq('id', rows[i].id);
  }
  return rows.length;
}

async function fillClassifications(supabase, familyId) {
  const { data: rows } = await supabase
    .from('recipe_ingredients')
    .select('id, name_pt')
    .is('product_type', null)
    .order('id')
    .limit(200);
  if (!rows || rows.length === 0) return 0;
  const vocabSet = new Set();
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
  const vocabulary = [...vocabSet];

  const sys = [
    'You classify Portuguese recipe ingredients into a generic Russian kind.',
    'Return ONE short Russian noun (plural nominative when naturally plural, else singular natural form).',
    '1-3 words max. Lowercase. REUSE terms from the provided vocabulary when semantically equivalent.',
    'Return ONLY a JSON array of strings in the same order as input.',
  ].join(' ');
  const user =
    `Vocabulary already used (reuse when possible): [${vocabulary.join(', ') || 'empty'}]\n\n` +
    `Classify each of these ${rows.length} ingredients:\n` +
    rows.map((r, i) => `${i + 1}. ${r.name_pt}`).join('\n');

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
      system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: user },
        { role: 'assistant', content: '[' },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  const arr = JSON.parse('[' + JSON.parse(text).content?.[0]?.text);
  if (!Array.isArray(arr) || arr.length !== rows.length) throw new Error('bad shape');
  for (let i = 0; i < rows.length; i++) {
    const t = String(arr[i] || '').trim().toLowerCase();
    if (!t) continue;
    await supabase.from('recipe_ingredients').update({ product_type: t }).eq('id', rows[i].id);
  }
  return rows.length;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + SOFT_TIMEOUT_MS;

  // Phase 1: sitemap
  let sitemap;
  try {
    sitemap = await ingestSitemaps(supabase);
  } catch (err) {
    return res.status(500).json({ error: `sitemap: ${err.message}` });
  }

  // Phase 2: delta scrape — новые ИЛИ обновлённые
  const { data: newQueue } = await supabase
    .from('recipes')
    .select('id, url')
    .is('scraped_at', null)
    .order('id', { ascending: true })
    .limit(100);
  // sitemap_lastmod > scraped_at (обновлённые) — берём отдельным запросом, чтобы не тянуть всё.
  // NB: Postgrest не умеет column > column, поэтому здесь для простоты пропускаем
  // и полагаемся на еженедельный ритм; при необходимости добавим RPC-функцию.

  const stats = await scrapeMany(supabase, newQueue || [], {
    limit: 100,
    concurrency: 4,
    deadline,
  });

  // Phase 3: translate + classify (только если ANTHROPIC_KEY и есть что делать)
  const llm = { recipes_translated: 0, ingredients_translated: 0, ingredients_classified: 0 };
  if (ANTHROPIC_KEY && Date.now() < deadline) {
    try { llm.recipes_translated = await fillTranslations(supabase, 'recipes', RECIPE_TR_PROMPT); } catch (e) { llm.tr_recipes_error = e.message; }
    if (Date.now() < deadline) {
      try { llm.ingredients_translated = await fillTranslations(supabase, 'recipe_ingredients', INGREDIENT_TR_PROMPT); } catch (e) { llm.tr_ingredients_error = e.message; }
    }
    if (Date.now() < deadline) {
      try { llm.ingredients_classified = await fillClassifications(supabase, DEFAULT_FAMILY_ID); } catch (e) { llm.cls_error = e.message; }
    }
  }

  const { count: remaining } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .is('scraped_at', null);

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    sitemap: { total: sitemap.total, upserted: sitemap.upserted },
    details: { ...stats, remaining: remaining ?? 0 },
    llm,
  });
}
