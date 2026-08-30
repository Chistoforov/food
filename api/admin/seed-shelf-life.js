// Seed perishable_shelf_life table via Claude Haiku 4.5.
// Reads all product types actually in use (from products.product_type +
// product_type_stats), asks the LLM to return shelf-life days for each
// perishable, and upserts only entries where shelf_life_days is not null.
//
// The prompt spells out categories that get a cap (fresh produce, fresh
// meat/poultry/fish, dairy, berries) AND opened fridge staples (opened
// sauces, fresh pasta, soft cheeses). Categories that must return null:
// frozen, canned, dry pantry (grains/flour/pasta dry), beverages, spices,
// hard bakery.
//
// POST Bearer CRON_SECRET. Body optional: { batchSize?, dryRun?, familyId? }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const SYSTEM_PROMPT = [
  'You estimate physical shelf life (in days) for grocery product types in a home fridge/pantry.',
  'For each Russian product type, return an integer shelf_life_days OR null if it does not need a cap.',
  '',
  'CAP THESE (return an integer):',
  '  - Fresh vegetables & herbs (спаржа 4, шпинат 3, петрушка 5, укроп 5, огурцы 7, помидоры 7, салат 5, цукини 7).',
  '  - Fresh meat/poultry/fish refrigerated (курица грудка 2, курица ножка 2, лосось 2, треска 2, говядина стейк 3, свинина стейк 3, фарш 1).',
  '  - Fresh dairy (молоко 5, творог 5, сметана 7, йогурт 14, сливки 5, ricota 4, мягкий сыр 5-7).',
  '  - Berries (клубника 3, малина 2, черника 5).',
  '  - Opened refrigerated sauces (соус песто 10, соус томатный 7, соус для пасты 7, майонез 30).',
  '  - Fresh pasta (макаронные изделия свежие 5).',
  '  - Fresh bread (хлеб свежий 4, хлеб тостовый 7).',
  '  - Eggs (яйца 21).',
  '',
  'DO NOT CAP (return null):',
  '  - Frozen anything (замороженное мясо, замороженные овощи, замороженная рыба).',
  '  - Canned/jarred (консервы, консервированная фасоль, оливки в банке, tuna in oil).',
  '  - Dry pantry (крупы, рис, макаронные изделия сухие, мука, сахар, соль).',
  '  - Beverages (вода, вино, пиво, соки, чай, кофе).',
  '  - Spices (перец, паприка, специи, ваниль).',
  '  - Long-shelf sauces unopened (соевый соус 60 — treat as unopened default), oils (оливковое масло, подсолнечное масло).',
  '  - Confectionery, snacks (шоколад, печенье, чипсы).',
  '  - Hard aged cheeses (сыр твёрдый, сыр пармезан).',
  '',
  'Rules:',
  '  - Integer 1-90 or null. Prefer conservative (shorter) values for opened perishables.',
  '  - Assume the item is either in the fridge or on the counter as appropriate for its category.',
  '  - When unsure between two categories, prefer null (do not cap).',
].join('\n');

async function estimateBatch(types) {
  const numbered = types.map((t, i) => `${i + 1}. ${t}`).join('\n');
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
        name: 'store_shelf_life',
        description: 'Store shelf_life_days for each product type in the same order. Use null to skip.',
        input_schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              minItems: types.length,
              maxItems: types.length,
              items: {
                type: 'object',
                properties: {
                  product_type: { type: 'string' },
                  shelf_life_days: { type: ['integer', 'null'] },
                  reason: { type: 'string' },
                },
                required: ['product_type', 'shelf_life_days'],
              },
            },
          },
          required: ['entries'],
        },
      }],
      tool_choice: { type: 'tool', name: 'store_shelf_life' },
      messages: [{ role: 'user', content: `Estimate shelf life for ${types.length} product types:\n${numbered}` }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use');
  const arr = toolUse?.input?.entries;
  if (!Array.isArray(arr) || arr.length !== types.length) {
    throw new Error(`Expected ${types.length} entries, got ${Array.isArray(arr) ? arr.length : 'nothing'}`);
  }
  return arr;
}

async function estimateRobust(types) {
  try { return await estimateBatch(types); }
  catch (err) {
    if (types.length === 1) return [{ product_type: types[0], shelf_life_days: null, reason: 'llm-fail' }];
    const mid = Math.floor(types.length / 2);
    const left = await estimateRobust(types.slice(0, mid));
    const right = await estimateRobust(types.slice(mid));
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
  const batchSize = Math.min(60, Math.max(10, Number(body?.batchSize || 30)));
  const dryRun = Boolean(body?.dryRun);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  // Collect distinct product types from products + product_type_stats.
  const typeSet = new Set();
  const { data: prod } = await supabase
    .from('products')
    .select('product_type')
    .eq('family_id', familyId)
    .not('product_type', 'is', null);
  for (const r of prod || []) if (r.product_type) typeSet.add(r.product_type);
  const { data: stats } = await supabase
    .from('product_type_stats')
    .select('product_type')
    .eq('family_id', familyId);
  for (const r of stats || []) if (r.product_type) typeSet.add(r.product_type);

  const types = [...typeSet].sort();

  const results = [];
  for (let i = 0; i < types.length; i += batchSize) {
    const chunk = types.slice(i, i + batchSize);
    const entries = await estimateRobust(chunk);
    results.push(...entries);
  }

  const rowsToUpsert = results
    .filter((e) => Number.isInteger(e.shelf_life_days) && e.shelf_life_days > 0 && e.shelf_life_days <= 90)
    .map((e) => ({
      product_type: e.product_type,
      shelf_life_days: e.shelf_life_days,
      source: 'llm',
      notes: e.reason || null,
      updated_at: new Date().toISOString(),
    }));

  let upserted = 0;
  if (!dryRun && rowsToUpsert.length > 0) {
    const { error: upErr } = await supabase
      .from('perishable_shelf_life')
      .upsert(rowsToUpsert, { onConflict: 'product_type' });
    if (upErr) return res.status(500).json({ error: `upsert: ${upErr.message}` });
    upserted = rowsToUpsert.length;

    // Refresh cache so UI reflects new statuses.
    await supabase.rpc('recalculate_product_type_stats', { p_family_id: familyId });
  }

  return res.status(200).json({
    ok: true,
    dry_run: dryRun,
    total_types: types.length,
    perishable_count: rowsToUpsert.length,
    non_perishable_count: results.length - rowsToUpsert.length,
    upserted,
    elapsed_ms: Date.now() - started,
    sample: rowsToUpsert.slice(0, 20),
    non_perishable_sample: results.filter((e) => e.shelf_life_days == null).slice(0, 10).map((e) => e.product_type),
  });
}
