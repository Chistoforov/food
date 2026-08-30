// Reclassify products.product_type into granular subtypes defined by
// data/product_type_taxonomy.json. Types whose taxonomy entry is empty
// or missing are left untouched. Deduplicates by lower(name); one LLM call
// per current type (batched by 40 unique names). If Claude returns a value
// outside the allowed subtype list, the row is left unchanged.
//
// POST Bearer CRON_SECRET. Body optional: { familyId?, batchSize?, dryRun? }

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

function loadTaxonomy() {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, '..', '..', 'data', 'product_type_taxonomy.json');
  const raw = readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

const SYSTEM_PROMPT = [
  'You assign a granular subtype to Pingo Doce grocery products.',
  'For each item you get: the product name (Portuguese, sometimes with Russian gloss)',
  'and a fixed list of allowed subtypes (in Russian). Pick exactly ONE.',
  'Rules:',
  '  - Return the chosen subtype verbatim from the allowed list. No new keys.',
  '  - Lowercase, exact match required — the caller will reject values outside the list.',
  '  - If none of the subtypes fits, return the string "__none__".',
  '  - Do not use packaging, brand or size — only semantic subtype.',
  '  - Ignore preparation form when possible ("frango bife" and "frango peito"',
  '    are both "курица грудка" if that is the closest subtype).',
].join('\n');

async function assignBatch(items, currentType, allowed) {
  const numbered = items.map((it, i) => `${i + 1}. ${it.name}`).join('\n');
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
        description: 'Store the chosen subtype (or __none__) for each item in order.',
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
        content: `Current generic type: "${currentType}"\nAllowed subtypes: [${allowed.join(', ')}]\n\nAssign for ${items.length} products:\n${numbered}`,
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
    if (items.length === 1) return ['']; // skip this one
    const mid = Math.floor(items.length / 2);
    const left = await assignRobust(items.slice(0, mid), currentType, allowed);
    const right = await assignRobust(items.slice(mid), currentType, allowed);
    return [...left, ...right];
  }
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
  const batchSize = Math.min(80, Math.max(5, Number(body?.batchSize || 40)));
  const dryRun = Boolean(body?.dryRun);

  let taxonomy;
  try { taxonomy = loadTaxonomy(); }
  catch (err) { return res.status(500).json({ error: `taxonomy load: ${err.message}` }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + 240_000;

  const { data: products, error: selErr } = await supabase
    .from('products')
    .select('id, name, name_ru, product_type')
    .eq('family_id', familyId)
    .not('product_type', 'is', null);
  if (selErr) return res.status(500).json({ error: `select: ${selErr.message}` });

  // Group by current type, then dedup by lower(name).
  const byType = new Map(); // type -> Map(key -> {name, ids: []})
  for (const p of products || []) {
    const t = p.product_type;
    const displayName = p.name_ru ? `${p.name} (${p.name_ru})` : p.name;
    const key = (p.name || '').toLowerCase();
    if (!byType.has(t)) byType.set(t, new Map());
    const inner = byType.get(t);
    if (!inner.has(key)) inner.set(key, { name: displayName, ids: [] });
    inner.get(key).ids.push(p.id);
  }

  const stats = {
    total_products: (products || []).length,
    types_processed: 0,
    types_skipped_atomic: 0,
    types_skipped_missing: 0,
    unique_names: 0,
    rows_updated: 0,
    unchanged_none_match: 0,
    samples: [],
  };
  const perTypeResults = {};

  for (const [currentType, inner] of byType.entries()) {
    if (Date.now() >= deadline) break;
    const subtypes = taxonomy[currentType];
    if (!Array.isArray(subtypes)) { stats.types_skipped_missing++; continue; }
    if (subtypes.length === 0) { stats.types_skipped_atomic++; continue; }

    const items = [...inner.entries()].map(([key, v]) => ({ key, name: v.name, ids: v.ids }));
    stats.unique_names += items.length;
    const perBatchResults = [];

    for (let i = 0; i < items.length; i += batchSize) {
      if (Date.now() >= deadline) break;
      const chunk = items.slice(i, i + batchSize);
      const chosen = await assignRobust(chunk, currentType, subtypes);
      for (let j = 0; j < chunk.length; j++) {
        const c = chosen[j];
        const it = chunk[j];
        if (!c || c === '__none__' || !subtypes.includes(c)) {
          stats.unchanged_none_match += it.ids.length;
          perBatchResults.push({ name: it.name, chosen: c || null, applied: null });
          continue;
        }
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from('products')
            .update({ product_type: c })
            .in('id', it.ids);
          if (upErr) throw new Error(`update: ${upErr.message}`);
        }
        stats.rows_updated += it.ids.length;
        perBatchResults.push({ name: it.name, chosen: c, applied: c });
        if (stats.samples.length < 8) stats.samples.push({ from: currentType, to: c, name: it.name });
      }
    }
    perTypeResults[currentType] = {
      subtypes,
      processed: items.length,
      applied: perBatchResults.filter((r) => r.applied).length,
    };
    stats.types_processed++;
  }

  if (!dryRun && stats.rows_updated > 0) {
    await supabase.rpc('recalculate_product_type_stats', { p_family_id: familyId });
  }

  return res.status(200).json({
    ok: true,
    dry_run: dryRun,
    family_id: familyId,
    elapsed_ms: Date.now() - started,
    ...stats,
    per_type: perTypeResults,
  });
}
