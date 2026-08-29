// Backfill Pingo Doce recipes. Две фазы в одном эндпоинте:
//   1. Sitemap ingest — читает 5 shards и создаёт скелеты recipes(external_id, url, sitemap_lastmod).
//      Дешёвое, идемпотентное — гоняется каждый вызов.
//   2. Detail scrape — берёт recipes без scraped_at, тянет каждую детальную страницу,
//      парсит JSON-LD Recipe → name/image/category/ingredients. Отрубается по soft
//      timeout, возвращает remaining count.
//
// POST Bearer CRON_SECRET. Body optional: { limit?, concurrency? }.
// Перевод и классификация — отдельно: translate-recipes, classify-recipe-ingredients.

import { createClient } from '@supabase/supabase-js';
import { ingestSitemaps, scrapeMany } from '../_shared/recipes-helpers.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOFT_TIMEOUT_MS = 240_000;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE env' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const limit = Math.max(1, Math.min(2000, Number(body?.limit || 500)));
  const concurrency = Math.max(1, Math.min(8, Number(body?.concurrency || 4)));

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const deadline = started + SOFT_TIMEOUT_MS;

  let sitemap;
  try {
    sitemap = await ingestSitemaps(supabase);
  } catch (err) {
    return res.status(500).json({ error: `sitemap: ${err.message || String(err)}` });
  }

  const { data: work, error: qErr } = await supabase
    .from('recipes')
    .select('id, url')
    .is('scraped_at', null)
    .order('id', { ascending: true })
    .limit(Math.min(limit, 2000));
  if (qErr) return res.status(500).json({ error: `queue: ${qErr.message}`, sitemap });

  const stats = await scrapeMany(supabase, work || [], { limit, concurrency, deadline });

  const { count: remaining } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .is('scraped_at', null);

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    sitemap,
    details: { ...stats, remaining: remaining ?? 0 },
    hint: (remaining ?? 0) > 0
      ? `Re-run this endpoint to continue (${remaining} recipes left).`
      : 'All recipes scraped. Next: POST /api/admin/translate-recipes and /api/admin/classify-recipe-ingredients.',
  });
}
