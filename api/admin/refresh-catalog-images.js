// Retry image_url scrape for catalog_products where the category-page scan
// missed the tile image but we have the PDP url. Fetches the product detail
// page and pulls the first static.pingodoce.pt image whose filename includes
// the external_id (that's how PD names its product images).
//
// GET/POST /api/admin/refresh-catalog-images?limit=200
// Bearer CRON_SECRET (same as other admin endpoints).
// Rate-limited to ~2.8 req/sec; each invocation processes up to
// SOFT_TIMEOUT_MS / RATE_LIMIT_MS ≈ 680 rows and returns counts + samples.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RATE_LIMIT_MS = 350;
const SOFT_TIMEOUT_MS = 240_000;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchImageUrl(url, externalId) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (r.status !== 200) return { status: r.status, imageUrl: null };
  const html = await r.text();
  const re = new RegExp(
    `https://static\\.pingodoce\\.pt/[^"'\\s]+${escapeRegex(String(externalId))}[^"'\\s]+\\.(?:jpg|png)`,
    'i',
  );
  const m = html.match(re);
  return { status: 200, imageUrl: m ? m[0] : null };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE env' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const limit = Math.min(Number(req.query?.limit || 200), 1000);

  const { data: rows, error } = await supabase
    .from('catalog_products')
    .select('id, external_id, url')
    .is('image_url', null)
    .not('url', 'is', null)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });

  const deadline = Date.now() + SOFT_TIMEOUT_MS;
  const started = Date.now();
  let processed = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  const sampleErrors = [];

  for (const row of rows) {
    if (Date.now() >= deadline) break;
    processed++;
    try {
      const { imageUrl, status } = await fetchImageUrl(row.url, row.external_id);
      if (status !== 200) {
        errors++;
        if (sampleErrors.length < 3) sampleErrors.push({ id: row.id, http: status });
      } else if (imageUrl) {
        const { error: upErr } = await supabase
          .from('catalog_products')
          .update({ image_url: imageUrl })
          .eq('id', row.id);
        if (upErr) {
          errors++;
          if (sampleErrors.length < 3) sampleErrors.push({ id: row.id, db: upErr.message });
        } else {
          updated++;
        }
      } else {
        notFound++;
      }
    } catch (err) {
      errors++;
      if (sampleErrors.length < 3) sampleErrors.push({ id: row.id, err: String(err).slice(0, 120) });
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    candidates_in_batch: rows.length,
    processed,
    updated,
    not_found: notFound,
    errors,
    sampleErrors,
  });
}
