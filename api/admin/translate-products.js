// Batch-translate products.name (PT) → products.name_ru via OpenAI gpt-4o-mini.
// Idempotent: only fills rows where name_ru IS NULL. Safe to rerun.
// POST with {batchSize?, maxBatches?} for chunked progress; defaults 40/5 (~200 products/call).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const SYSTEM_PROMPT = [
  'You translate Portuguese grocery product names to Russian.',
  'The names come from Pingo Doce (Portuguese supermarket) cash-register receipts,',
  'so they may contain abbreviations (V.ALENT = Vinho Alentejano, PD = Pingo Doce,',
  'CCP = Cartão, SDR = Sem Doses de Redução, INT = Integral, QJ = Queijo, FLC = Flocos, etc).',
  'Return a natural Russian name suitable for a shopping list. Keep brand names in Latin script,',
  'keep weight/volume units (g, kg, ml, L, cl), keep the number.',
  'Return ONLY a JSON array of strings in the same order as the input, no comments, no extra keys.',
  'Example input: ["V.ALENT.RAVASQUEIRA SUPERIOR BCO 75CL","Leite UHT Magro Pingo Doce 1 L"]',
  'Example output: ["Вино Alentejo Ravasqueira Superior белое 75 cl","Молоко UHT обезжиренное Pingo Doce 1 л"]',
].join(' ');

async function translateBatch(names) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + ' Wrap the array in {"translations": [...]}.' },
        { role: 'user', content: JSON.stringify(names) },
      ],
      temperature: 0.2,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Unexpected OpenAI response: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(content);
  const arr = parsed.translations || parsed.result || parsed.data;
  if (!Array.isArray(arr) || arr.length !== names.length) {
    throw new Error(`Expected array of ${names.length} translations, got ${JSON.stringify(parsed).slice(0, 300)}`);
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const batchSize = Math.min(80, Math.max(1, Number(body?.batchSize || 40)));
  const maxBatches = Math.min(20, Math.max(1, Number(body?.maxBatches || 5)));

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  const totalNeed = await (async () => {
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', PD_FAMILY_ID)
      .is('name_ru', null);
    return count ?? 0;
  })();

  let translatedTotal = 0;
  let errors = 0;
  const batches = [];

  for (let i = 0; i < maxBatches; i++) {
    const { data: rows, error: selErr } = await supabase
      .from('products')
      .select('id, name')
      .eq('family_id', PD_FAMILY_ID)
      .is('name_ru', null)
      .order('id')
      .limit(batchSize);
    if (selErr) return res.status(500).json({ error: `select: ${selErr.message}` });
    if (!rows || rows.length === 0) break;

    try {
      const translations = await translateBatch(rows.map((r) => r.name));
      // Bulk update via upsert on primary key (unset only name_ru per row).
      // Since Postgrest doesn't support multi-row UPDATE with different values in one call
      // without upsert, we do it one-by-one. ~40 rows is quick.
      for (let j = 0; j < rows.length; j++) {
        await supabase.from('products').update({ name_ru: translations[j] }).eq('id', rows[j].id);
      }
      translatedTotal += rows.length;
      batches.push({ batch: i + 1, rows: rows.length, sample: [rows[0].name, translations[0]] });
    } catch (err) {
      errors++;
      batches.push({ batch: i + 1, rows: rows.length, error: err.message });
      break;
    }
  }

  return res.status(200).json({
    ok: true,
    family_id: PD_FAMILY_ID,
    remaining_before: totalNeed,
    translated_this_run: translatedTotal,
    remaining_after: Math.max(0, totalNeed - translatedTotal),
    batches,
    errors,
    elapsed_ms: Date.now() - started,
  });
}
