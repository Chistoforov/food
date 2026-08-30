// Reclassify recipe_ingredients.product_type into granular subtypes from
// data/product_type_taxonomy.json. Resumable: rows whose current product_type
// is already a granular subtype (present in taxonomy values) are skipped.
// Dedup by lower(name_pt) → 45k → ~8k unique.
//
// POST Bearer CRON_SECRET. Body optional: { batchSize?, maxBatches? }

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

function loadTaxonomy() {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, '..', '..', 'data', 'product_type_taxonomy.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

const SYSTEM_PROMPT = [
  'You assign a granular subtype to Portuguese recipe ingredients from Pingo Doce.',
  'For each item you get: Portuguese name (name_pt), a Russian gloss (name_ru if present),',
  'and a fixed list of allowed subtypes (Russian). Pick exactly ONE subtype from the list.',
  'Rules:',
  '  - Return the chosen subtype verbatim, lowercase, exact string.',
  '  - If none fits, return "__none__".',
  '  - Choose the most specific option: "leite de coco" → "молоко кокосовое" (if present),',
  '    "leite" alone → the generic "молоко" style entry if the taxonomy has it, else __none__.',
  '  - Consider Portuguese qualifiers: "branco/branca" (white), "encarnado/vermelho" (red),',
  '    "verde" (green), "de coco" (coconut), etc.',
  '  - Ignore package size, brand, cooking method.',
].join('\n');

async function assignBatch(items, currentType, allowed) {
  const numbered = items.map((it, i) =>
    `${i + 1}. ${it.name_pt}${it.name_ru ? ` — ${it.name_ru}` : ''}`
  ).join('\n');
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
        name: 'store_subtypes',
        description: 'Store the chosen subtype for each ingredient in order.',
        input_schema: {
          type: 'object',
          properties: {
            subtypes: {
              type: 'array',
              minItems: items.length,
              maxItems: items.length,
              items: { type: 'string' },
            },
          },
          required: ['subtypes'],
        },
      }],
      tool_choice: { type: 'tool', name: 'store_subtypes' },
      messages: [{
        role: 'user',
        content: `Current generic type: "${currentType}"\nAllowed subtypes: [${allowed.join(', ')}]\n\nAssign for ${items.length} ingredients:\n${numbered}`,
      }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use');
  const arr = toolUse?.input?.subtypes;
  if (!Array.isArray(arr) || arr.length !== items.length) {
    throw new Error(`Expected ${items.length} subtypes, got ${Array.isArray(arr) ? arr.length : 'nothing'}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''));
}

async function assignRobust(items, currentType, allowed) {
  try { return await assignBatch(items, currentType, allowed); }
  catch (err) {
    if (items.length === 1) return [''];
    const mid = Math.floor(items.length / 2);
    const left = await assignRobust(items.slice(0, mid), currentType, allowed);
    const right = await assignRobust(items.slice(mid), currentType, allowed);
    return [...left, ...right];
  }
}

async function fetchAllRows(supabase) {
  const out = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('id, name_pt, name_ru, product_type')
      .not('product_type', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw new Error(`select: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
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
  const batchSize = Math.min(80, Math.max(10, Number(body?.batchSize || 40)));
  const maxBatches = Math.min(60, Math.max(1, Number(body?.maxBatches || 20)));

  let taxonomy;
  try { taxonomy = loadTaxonomy(); }
  catch (err) { return res.status(500).json({ error: `taxonomy load: ${err.message}` }); }

  // Union of all granular subtype values — used to detect already-granular rows.
  const granularSet = new Set();
  for (const arr of Object.values(taxonomy)) for (const s of arr) granularSet.add(s);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + 240_000;

  const allRows = await fetchAllRows(supabase);

  // Pending = rows whose product_type is a generic key with non-empty taxonomy AND not yet granular.
  const pending = allRows.filter((r) => {
    if (granularSet.has(r.product_type)) return false;
    const subs = taxonomy[r.product_type];
    return Array.isArray(subs) && subs.length > 0;
  });

  // Group pending by generic type, then dedup by lower(name_pt).
  const byType = new Map(); // type -> Map(key -> {name_pt, name_ru, ids: []})
  for (const r of pending) {
    const t = r.product_type;
    const key = (r.name_pt || '').toLowerCase();
    if (!key) continue;
    if (!byType.has(t)) byType.set(t, new Map());
    const inner = byType.get(t);
    if (!inner.has(key)) inner.set(key, { name_pt: r.name_pt, name_ru: r.name_ru, ids: [] });
    inner.get(key).ids.push(r.id);
  }

  const stats = {
    total_rows: allRows.length,
    already_granular: allRows.length - pending.length - allRows.filter((r) => {
      const subs = taxonomy[r.product_type];
      return !Array.isArray(subs) || subs.length === 0;
    }).length,
    atomic_or_missing: allRows.filter((r) => {
      const subs = taxonomy[r.product_type];
      return !Array.isArray(subs) || subs.length === 0;
    }).length,
    pending_rows: pending.length,
    pending_types: byType.size,
    unique_names: 0,
    rows_updated: 0,
    unchanged_none_match: 0,
    batches: 0,
    samples: [],
  };

  outer:
  for (const [currentType, inner] of byType.entries()) {
    const items = [...inner.entries()].map(([key, v]) => ({ key, ...v }));
    stats.unique_names += items.length;
    const allowed = taxonomy[currentType];

    for (let i = 0; i < items.length; i += batchSize) {
      if (stats.batches >= maxBatches || Date.now() >= deadline) break outer;
      const chunk = items.slice(i, i + batchSize);
      const chosen = await assignRobust(chunk, currentType, allowed);
      await Promise.all(chunk.map(async (it, j) => {
        const c = chosen[j];
        if (!c || c === '__none__' || !allowed.includes(c)) {
          stats.unchanged_none_match += it.ids.length;
          return;
        }
        const { error: upErr } = await supabase
          .from('recipe_ingredients')
          .update({ product_type: c })
          .in('id', it.ids);
        if (upErr) throw new Error(`update: ${upErr.message}`);
        stats.rows_updated += it.ids.length;
        if (stats.samples.length < 10) stats.samples.push({ from: currentType, to: c, name: it.name_pt });
      }));
      stats.batches++;
    }
  }

  // Count still-pending after this run.
  const remainingPending = pending.length - stats.rows_updated - stats.unchanged_none_match;

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    ...stats,
    remaining_rows: Math.max(0, remainingPending),
    hint: remainingPending > 0
      ? `Re-run to continue (${remainingPending} rows remaining).`
      : 'All granular reclassification done.',
  });
}
