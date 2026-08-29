// Batch-translate recipes и recipe_ingredients из PT → RU через Claude Haiku 4.5.
// Идемпотентно: заполняет только строки где name_ru IS NULL.
// POST Bearer CRON_SECRET. Body optional: { batchSize?, maxBatches?, target? }
//   target: 'recipes' | 'ingredients' | 'both' (default 'both')

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
  'Inputs come from Pingo Doce recipes: they are short (1-4 words), typically no quantities.',
  'Return a natural Russian ingredient name suitable for a shopping list.',
  'Keep brand names in Latin. Keep units if present.',
  'Return ONLY a JSON array of strings in the same order as the input.',
  'Example input: ["cebola","alho","azeite virgem extra","flocos de aveia","noz picadas","q.b. sal"]',
  'Example output: ["лук","чеснок","оливковое масло extra virgin","овсяные хлопья","грецкий орех дроблёный","соль по вкусу"]',
].join(' ');

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
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const content = data.content?.[0]?.text;
  if (typeof content !== 'string') throw new Error(`Unexpected response: ${text.slice(0, 300)}`);
  const arr = JSON.parse('[' + content);
  if (!Array.isArray(arr) || arr.length !== names.length) {
    throw new Error(`Expected ${names.length} translations, got ${JSON.stringify(arr).slice(0, 200)}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)));
}

async function runTable(supabase, table, systemPrompt, batchSize, maxBatches, deadline) {
  const stats = { rows: 0, batches: 0, errors: 0, sample: null };
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .is('name_ru', null);
  const remainingBefore = count ?? 0;

  for (let i = 0; i < maxBatches; i++) {
    if (Date.now() >= deadline) break;
    const { data: rows, error } = await supabase
      .from(table)
      .select('id, name_pt')
      .is('name_ru', null)
      .order('id', { ascending: true })
      .limit(batchSize);
    if (error) throw new Error(`${table} select: ${error.message}`);
    if (!rows || rows.length === 0) break;
    try {
      const translations = await translateBatch(rows.map((r) => r.name_pt), systemPrompt);
      for (let j = 0; j < rows.length; j++) {
        await supabase.from(table).update({ name_ru: translations[j] }).eq('id', rows[j].id);
      }
      stats.rows += rows.length;
      stats.batches++;
      if (!stats.sample) stats.sample = [rows[0].name_pt, translations[0]];
    } catch (err) {
      stats.errors++;
      return { ...stats, remainingBefore, remainingAfter: remainingBefore - stats.rows, error: err.message };
    }
  }
  return { ...stats, remainingBefore, remainingAfter: Math.max(0, remainingBefore - stats.rows) };
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
  const target = String(body?.target || 'both'); // 'recipes' | 'ingredients' | 'both'

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + 240_000;
  const result = { ok: true, elapsed_ms: 0 };

  if (target === 'recipes' || target === 'both') {
    result.recipes = await runTable(
      supabase, 'recipes', RECIPE_SYSTEM_PROMPT, batchSize, maxBatches, deadline
    );
  }
  if ((target === 'ingredients' || target === 'both') && Date.now() < deadline) {
    result.ingredients = await runTable(
      supabase, 'recipe_ingredients', INGREDIENT_SYSTEM_PROMPT, batchSize, maxBatches, deadline
    );
  }
  result.elapsed_ms = Date.now() - started;
  const remR = result.recipes?.remainingAfter ?? 0;
  const remI = result.ingredients?.remainingAfter ?? 0;
  result.hint = (remR + remI) > 0
    ? `Re-run to continue (recipes left: ${remR}, ingredients left: ${remI}).`
    : 'All names translated.';
  return res.status(200).json(result);
}
