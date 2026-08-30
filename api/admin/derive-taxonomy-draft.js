// Derives a granular taxonomy draft from existing products.product_type.
// For each current type with >= 2 distinct products, asks Claude Haiku 4.5
// to propose 2-8 subtypes shaped as "<generic> <qualifier>". Types with a
// single semantic meaning ("соль", "вода") get an empty list — no split.
//
// POST Bearer CRON_SECRET. Body optional: { familyId?, minProducts? }
// Returns { taxonomy: { <current_type>: [<subtype>, ...] } }.
// Save to data/product_type_taxonomy.json via:
//   curl -s ... | jq '.taxonomy' > data/product_type_taxonomy.json

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const SYSTEM_PROMPT = [
  'You design a granular Russian grocery taxonomy for a Pingo Doce home inventory app.',
  'Input: current generic type (e.g. "курица") and up to 12 example product names.',
  'Output: an array of 2–8 subtype keys (Russian, lowercase, format "<generic> <qualifier>").',
  'The subtypes MUST partition the examples semantically. Use them for matching recipe',
  'ingredients to inventory — so "куриная ножка" recipe must not match a "куриная грудка"',
  'in the pantry.',
  '',
  'Rules:',
  '  - Keep the generic word from the input as the FIRST word of every subtype.',
  '    Example: input "курица" → ["курица грудка", "курица ножка", "курица крылья"].',
  '  - Subtype length ≤ 30 chars. 2–3 words.',
  '  - Lowercase, singular OR plural depending on natural form.',
  '  - No brand names, no packaging, no size, no cooking method — only the semantic subtype.',
  '  - Use adjectives / body parts / colors / preparation state only when they meaningfully',
  '    change the recipe substitutability.',
  '  - If the current type is already atomic (single semantic meaning) and cannot be',
  '    meaningfully split, return an EMPTY array []. Examples of atomic types:',
  '    "соль", "вода", "сахар", "лук", "морковь", "чеснок", "молоко", "мука" (basic),',
  '    "хлеб" (basic loaf), "яйца".',
  '  - Do not invent subtypes that would be indistinguishable in a shopping list.',
  '  - Do NOT invent subtypes not represented in the examples.',
  '',
  'Examples of good splits:',
  '  "курица" + [Peito, Perninha, Asas, Bife, Coxa, Lombinho, Cordon Bleu]',
  '    → ["курица грудка","курица ножка","курица крылья","курица стейк","курица бедро","курица фарш","курица полуфабрикат"]',
  '  "соус" + [Molho Pesto, Molho Soja, Molho Barbecue, Sweet Chili, Teriyaki, Vinagrete, Piri-Piri]',
  '    → ["соус песто","соус соевый","соус барбекю","соус чили сладкий","соус терияки","соус винегрет","соус пири-пири"]',
  '  "фасоль" + [Feijão Encarnado, Feijão Branco, Feijão Verde]',
  '    → ["фасоль красная","фасоль белая","фасоль зелёная стручковая"]',
  '  "рыба" + [Salmão, Bacalhau, Atum, Pescada]',
  '    → ["рыба лосось","рыба треска","рыба тунец","рыба хек"]',
  '  "сыр" + [Mozzarella, Ricota, Parmigiano, Feta, Cheddar, Requeijão]',
  '    → ["сыр моцарелла","сыр рикотта","сыр твёрдый","сыр фета","сыр творожный"]',
  '  "соль" + [Sal fino, Sal marinho, Sal grosso] → []',
  '  "вода" + [Água mineral, Água com gás] → []',
].join('\n');

async function splitTypeBatch(items) {
  // items: [{ current_type, examples: [names] }]
  const numbered = items.map((it, i) =>
    `${i + 1}. Type: "${it.current_type}"\n   Examples: ${it.examples.join(' | ')}`
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
        description: 'Store the proposed subtype array for each input type in the same order.',
        input_schema: {
          type: 'object',
          properties: {
            splits: {
              type: 'array',
              minItems: items.length,
              maxItems: items.length,
              items: {
                type: 'object',
                properties: {
                  current_type: { type: 'string' },
                  subtypes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Empty array means keep as-is (atomic).',
                  },
                },
                required: ['current_type', 'subtypes'],
              },
            },
          },
          required: ['splits'],
        },
      }],
      tool_choice: { type: 'tool', name: 'store_subtypes' },
      messages: [{ role: 'user', content: `Design subtypes for ${items.length} types:\n${numbered}` }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use');
  const arr = toolUse?.input?.splits;
  if (!Array.isArray(arr) || arr.length !== items.length) {
    throw new Error(`Expected ${items.length} splits, got ${Array.isArray(arr) ? arr.length : 'nothing'}`);
  }
  return arr;
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
  const minProducts = Math.max(1, Number(body?.minProducts || 1));

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  // Pull all products with product_type; group by type; keep up to 12 example names per type.
  const { data: products, error: selErr } = await supabase
    .from('products')
    .select('name, name_ru, product_type')
    .eq('family_id', familyId)
    .not('product_type', 'is', null);
  if (selErr) return res.status(500).json({ error: `select: ${selErr.message}` });

  const byType = new Map(); // type -> Set<name>
  for (const p of products || []) {
    const t = p.product_type;
    if (!t) continue;
    const name = (p.name || p.name_ru || '').trim();
    if (!name) continue;
    if (!byType.has(t)) byType.set(t, new Set());
    const s = byType.get(t);
    if (s.size < 12) s.add(name);
  }

  const items = [];
  const skipped = [];
  for (const [t, s] of byType.entries()) {
    if (s.size < minProducts) {
      skipped.push(t);
      continue;
    }
    items.push({ current_type: t, examples: [...s] });
  }

  // Sort by type for deterministic batching / caching.
  items.sort((a, b) => a.current_type.localeCompare(b.current_type));

  const batchSize = 20;
  const taxonomy = {};
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    let splits;
    try {
      splits = await splitTypeBatch(chunk);
    } catch (err) {
      // Halving fallback
      const half = Math.ceil(chunk.length / 2);
      const left = await splitTypeBatch(chunk.slice(0, half)).catch(() => chunk.slice(0, half).map((c) => ({ current_type: c.current_type, subtypes: [] })));
      const right = await splitTypeBatch(chunk.slice(half)).catch(() => chunk.slice(half).map((c) => ({ current_type: c.current_type, subtypes: [] })));
      splits = [...left, ...right];
    }
    for (const s of splits) {
      const subtypes = Array.isArray(s.subtypes)
        ? s.subtypes.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
        : [];
      taxonomy[s.current_type] = subtypes;
    }
    batches.push({ batch: batches.length + 1, size: chunk.length });
  }

  // Fill skipped types with []
  for (const t of skipped) taxonomy[t] = [];

  // Sort keys alphabetically for stable JSON output.
  const sorted = {};
  for (const k of Object.keys(taxonomy).sort()) sorted[k] = taxonomy[k];

  return res.status(200).json({
    ok: true,
    family_id: familyId,
    total_types: byType.size,
    processed: items.length,
    skipped: skipped.length,
    total_subtypes: Object.values(sorted).reduce((n, arr) => n + arr.length, 0),
    batches,
    elapsed_ms: Date.now() - started,
    taxonomy: sorted,
  });
}
