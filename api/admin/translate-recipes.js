// Batch-translate recipes.name_pt / recipe_ingredients.name_pt / recipes.instructions_pt
// из PT → RU через Claude Haiku 4.5.
//
// Идемпотентно: заполняет только строки где целевая RU колонка IS NULL.
//
// Дедуп: для recipe_ingredients — только уникальные lower(name_pt); одна переводка
// разливается на все дубликаты. Для recipes.name_pt/instructions_pt дедуп бесполезен
// (уникальны).
//
// POST Bearer CRON_SECRET. Body optional: { batchSize?, maxBatches?, target?, instructionsPerCall? }
//   target: 'recipes' | 'ingredients' | 'instructions' | 'all' (default 'all')

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const RECIPE_SYSTEM_PROMPT = [
  'You translate Portuguese recipe titles from Pingo Doce (portuguese supermarket) to Russian.',
  'Recipe titles are short and descriptive of a dish.',
  'Keep proper nouns/brand names in Latin script. Keep units (g, ml, cl, L, kg) in Latin.',
  'Return ONLY a JSON array of strings in the same order as the input.',
  'Example input: ["Caldo-verde sem chouriço","Tarte de pêssego com amêndoa","Bolo de Natal Dinamarquês"]',
  'Example output: ["Калду-верде без чоурису","Тарт с персиком и миндалём","Датский рождественский кекс"]',
].join(' ');

const INGREDIENT_SYSTEM_PROMPT = [
  'You translate Portuguese cooking-ingredient names to Russian.',
  'Inputs come from Pingo Doce recipes: short (1-4 words), typically no quantities.',
  'Return a natural Russian ingredient name suitable for a shopping list.',
  'Keep brand names in Latin. Keep units if present.',
  'Return ONLY a JSON array of strings in the same order as the input.',
  'Example input: ["cebola","alho","azeite virgem extra","flocos de aveia","noz picadas","q.b. sal"]',
  'Example output: ["лук","чеснок","оливковое масло extra virgin","овсяные хлопья","грецкий орех дроблёный","соль по вкусу"]',
].join(' ');

const INSTRUCTIONS_SYSTEM_PROMPT = [
  'You translate Portuguese cooking-step instructions from Pingo Doce recipes to Russian.',
  'Input is a JSON array of arrays: each inner array is the ordered steps of one recipe.',
  'Return a JSON array of arrays with the same shape (same outer length, same inner lengths, same order).',
  'Translate each step as one natural Russian sentence/paragraph — keep the imperative cooking-instruction voice.',
  'Keep units (g, ml, cl, L, kg, °C) in Latin. Keep brand/product names in Latin.',
  'Do NOT renumber, do NOT add prefixes like "Шаг 1:". Just translate the text.',
  'Return ONLY the JSON — no markdown fences, no commentary.',
].join(' ');

async function anthropicTranslate(userText, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      temperature: 0.2,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: userText },
        { role: 'assistant', content: '[' },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const content = data.content?.[0]?.text;
  if (typeof content !== 'string') throw new Error(`Unexpected response: ${text.slice(0, 300)}`);
  return JSON.parse('[' + content);
}

async function translateStrings(names, systemPrompt) {
  const arr = await anthropicTranslate(JSON.stringify(names), systemPrompt);
  if (!Array.isArray(arr) || arr.length !== names.length) {
    throw new Error(`Expected ${names.length} translations, got ${JSON.stringify(arr).slice(0, 200)}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)));
}

async function translateStepArrays(stepArrays, systemPrompt) {
  const arr = await anthropicTranslate(JSON.stringify(stepArrays), systemPrompt);
  if (!Array.isArray(arr) || arr.length !== stepArrays.length) {
    throw new Error(`Expected ${stepArrays.length} step-arrays, got ${JSON.stringify(arr).slice(0, 200)}`);
  }
  return arr.map((sub, i) => {
    const expected = stepArrays[i].length;
    if (!Array.isArray(sub) || sub.length !== expected) {
      throw new Error(`Recipe ${i}: expected ${expected} steps, got ${JSON.stringify(sub).slice(0, 200)}`);
    }
    return sub.map((s) => (typeof s === 'string' ? s : String(s)));
  });
}

// Загружает все pending строки (пагинация 1000 за раз).
async function fetchAllPending(supabase, table, selectCols, filterCol) {
  const out = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .is(filterCol, null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw new Error(`${table} select: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return out;
}

// Recipes.name_pt → recipes.name_ru. Названия почти уникальны, дедуп не нужен.
async function runRecipeTitles(supabase, batchSize, maxBatches, deadline) {
  const rows = await fetchAllPending(supabase, 'recipes', 'id, name_pt', 'name_ru');
  const stats = { pending: rows.length, translated: 0, batches: 0, sample: null };
  for (let i = 0; i < rows.length; i += batchSize) {
    if (stats.batches >= maxBatches || Date.now() >= deadline) break;
    const chunk = rows.slice(i, i + batchSize);
    const translations = await translateStrings(chunk.map((r) => r.name_pt), RECIPE_SYSTEM_PROMPT);
    await Promise.all(
      chunk.map((r, j) => supabase.from('recipes').update({ name_ru: translations[j] }).eq('id', r.id))
    );
    stats.translated += chunk.length;
    stats.batches++;
    if (!stats.sample) stats.sample = [chunk[0].name_pt, translations[0]];
  }
  stats.remaining = rows.length - stats.translated;
  return stats;
}

// Ingredients.name_pt → name_ru c дедупом по lower(name_pt).
async function runIngredientNames(supabase, batchSize, maxBatches, deadline) {
  const rows = await fetchAllPending(supabase, 'recipe_ingredients', 'id, name_pt', 'name_ru');
  const idsByKey = new Map();
  const nameByKey = new Map();
  for (const r of rows) {
    const key = (r.name_pt || '').toLowerCase();
    if (!key) continue;
    if (!nameByKey.has(key)) nameByKey.set(key, r.name_pt);
    const arr = idsByKey.get(key) ?? [];
    arr.push(r.id);
    idsByKey.set(key, arr);
  }
  const uniqueKeys = [...nameByKey.keys()];
  const stats = {
    pending_rows: rows.length,
    unique_names: uniqueKeys.length,
    unique_translated: 0,
    rows_updated: 0,
    batches: 0,
    sample: null,
  };
  for (let i = 0; i < uniqueKeys.length; i += batchSize) {
    if (stats.batches >= maxBatches || Date.now() >= deadline) break;
    const keyChunk = uniqueKeys.slice(i, i + batchSize);
    const nameChunk = keyChunk.map((k) => nameByKey.get(k));
    const translations = await translateStrings(nameChunk, INGREDIENT_SYSTEM_PROMPT);
    await Promise.all(
      keyChunk.map(async (key, j) => {
        const ids = idsByKey.get(key);
        const { error } = await supabase
          .from('recipe_ingredients')
          .update({ name_ru: translations[j] })
          .in('id', ids);
        if (error) throw new Error(`update: ${error.message}`);
        stats.rows_updated += ids.length;
      })
    );
    stats.unique_translated += keyChunk.length;
    stats.batches++;
    if (!stats.sample) stats.sample = [nameChunk[0], translations[0]];
  }
  stats.remaining_rows = rows.length - stats.rows_updated;
  return stats;
}

// Recipes.instructions_pt → instructions_ru. Уникальны, дедуп не нужен;
// каждый батч содержит N рецептов, шаги — nested JSON array.
async function runInstructions(supabase, recipesPerBatch, maxBatches, deadline) {
  const rows = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, instructions_pt')
      .not('instructions_pt', 'is', null)
      .is('instructions_ru', null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw new Error(`recipes select: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < step) break;
    from += step;
  }
  const stats = { pending: rows.length, translated: 0, batches: 0 };
  for (let i = 0; i < rows.length; i += recipesPerBatch) {
    if (stats.batches >= maxBatches || Date.now() >= deadline) break;
    const chunk = rows.slice(i, i + recipesPerBatch);
    const stepArrays = chunk.map((r) => r.instructions_pt);
    const translations = await translateStepArrays(stepArrays, INSTRUCTIONS_SYSTEM_PROMPT);
    await Promise.all(
      chunk.map((r, j) =>
        supabase.from('recipes').update({ instructions_ru: translations[j] }).eq('id', r.id)
      )
    );
    stats.translated += chunk.length;
    stats.batches++;
  }
  stats.remaining = rows.length - stats.translated;
  return stats;
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
  const batchSize = Math.min(80, Math.max(1, Number(body?.batchSize || 40)));
  const maxBatches = Math.min(30, Math.max(1, Number(body?.maxBatches || 8)));
  const instructionsPerCall = Math.min(20, Math.max(1, Number(body?.instructionsPerCall || 6)));
  const target = String(body?.target || 'all');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + 240_000;
  const result = { ok: true };

  try {
    if (target === 'recipes' || target === 'all') {
      result.recipes = await runRecipeTitles(supabase, batchSize, maxBatches, deadline);
    }
    if ((target === 'ingredients' || target === 'all') && Date.now() < deadline) {
      result.ingredients = await runIngredientNames(supabase, batchSize, maxBatches, deadline);
    }
    if ((target === 'instructions' || target === 'all') && Date.now() < deadline) {
      result.instructions = await runInstructions(supabase, instructionsPerCall, maxBatches, deadline);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, partial: result });
  }

  result.elapsed_ms = Date.now() - started;
  const remR = result.recipes?.remaining ?? 0;
  const remIrows = result.ingredients?.remaining_rows ?? 0;
  const remIns = result.instructions?.remaining ?? 0;
  result.hint = (remR + remIrows + remIns) > 0
    ? `Re-run (recipes: ${remR}, ingredient rows: ${remIrows}, instructions: ${remIns}).`
    : 'All translated.';
  return res.status(200).json(result);
}
