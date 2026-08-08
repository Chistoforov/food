import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

// Soft timeout: возвращаем ответ раньше 300с Vercel timeout, чтобы завершить
// текущий upsert и вернуть cursor для следующего запуска.
const SOFT_TIMEOUT_MS = 240_000;
const PAGE_SIZE = 100;
const RATE_LIMIT_MS = 350;

// Известные leaf-категории верхнего уровня PD. Полный обход = ~1000-2500 товаров каждый.
// Можно расширить/сузить; после первого прогона поймём что реально есть.
const LEAF_CATEGORIES = [
  'frutas-e-vegetais',
  'talho',
  'peixaria',
  'padaria-e-pastelaria',
  'charcutaria-e-queijos',
  'laticinios-e-ovos',
  'mercearia',
  'congelados',
  'bebidas',
  'saude-e-beleza',
  'higiene-e-limpeza',
  'bebe',
  'animais',
  'lar',
  'brinquedos-e-livros',
];

// ---------- crypto ----------
function decrypt(blob) {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(12, blob.length - 16);
  const d = createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY_HEX, 'hex'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
function decodeBytea(raw) {
  if (typeof raw !== 'string') return Buffer.from(raw);
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}

// ---------- fetch ----------
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const BASE = 'https://www.pingodoce.pt';

async function pdFetch(path, cookieHeader, extraHeaders = {}) {
  const r = await fetch(path.startsWith('http') ? path : BASE + path, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      Cookie: cookieHeader,
      ...extraHeaders,
    },
  });
  return { status: r.status, url: r.url, body: await r.text() };
}

// ---------- HTML parsing ----------

// Извлекает cgid из data-url кнопки "Ver mais" (Search-UpdateGrid?cgid=X&...)
function extractCgid(html) {
  const m = html.match(/[?&]cgid=([^&"'\s]+)/);
  return m ? m[1] : null;
}

// Все tiles на странице → массив item-объектов из data-gtm-info.items[0]
function parseTiles(html) {
  const items = [];
  const re = /data-gtm-info="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const decoded = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const gtm = JSON.parse(decoded);
      const item = gtm.items?.[0];
      if (item && item.item_id) {
        items.push({
          external_id: String(item.item_id),
          name: item.item_name || '',
          brand: item.item_brand || null,
          category1: item.item_category || null, // подкатегория
          category2: item.item_category2 || null, // главная категория
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || null,
        });
      }
    } catch {}
  }
  return items;
}

// Извлекает URL и image_url для конкретного product_id из HTML (best-effort).
// Не критично — используется только для доп полей catalog_products.
function extractDetailsMap(html) {
  const map = new Map();
  // <img class="product-tile-component-image" src="...994265_...">
  const imgRe = /<img[^>]+class="product-tile-component-image"[^>]+src="([^"]+)"/g;
  const linkRe = /<a[^>]+class="product-tile-image-link"[^>]+href="([^"]+)"/g;
  const imgs = [...html.matchAll(imgRe)].map((m) => m[1]);
  const links = [...html.matchAll(linkRe)].map((m) => m[1]);
  // Мапим по product_id найденному в URL/img (последовательность должна совпадать со списком tiles)
  for (const src of imgs) {
    const idM = src.match(/\/(\d{5,10})_[a-f0-9]{16,}/);
    if (idM) map.set(idM[1], { ...(map.get(idM[1]) || {}), image_url: src });
  }
  for (const href of links) {
    const idM = href.match(/-(\d{5,10})\.html/);
    if (idM) map.set(idM[1], { ...(map.get(idM[1]) || {}), url: href.startsWith('http') ? href : BASE + href });
  }
  return map;
}

// ---------- DB upsert ----------
async function upsertBatch(supabase, batch) {
  if (batch.length === 0) return { upserted: 0, priceChanges: 0 };

  // Дедуплицируем по external_id — PD часто показывает один продукт дважды
  // на странице (featured + обычный слот). Postgres ON CONFLICT не любит
  // дубли в одном INSERT.
  const seen = new Set();
  const uniqBatch = [];
  for (const b of batch) {
    if (seen.has(b.external_id)) continue;
    seen.add(b.external_id);
    uniqBatch.push(b);
  }
  batch = uniqBatch;

  // 1. Upsert catalog_products by external_id
  const rows = batch.map((b) => ({
    external_id: b.external_id,
    name: b.name,
    brand: b.brand,
    category1: b.category1,
    category2: b.category2,
    url: b.url || null,
    image_url: b.image_url || null,
    last_seen_at: new Date().toISOString(),
    is_active: true,
  }));
  const { error: upErr } = await supabase
    .from('catalog_products')
    .upsert(rows, { onConflict: 'external_id' });
  if (upErr) throw upErr;

  // 2. Fetch ids for these external_ids
  const externalIds = batch.map((b) => b.external_id);
  const { data: idRows, error: idErr } = await supabase
    .from('catalog_products')
    .select('id, external_id')
    .in('external_id', externalIds);
  if (idErr) throw idErr;
  const idMap = new Map(idRows.map((r) => [r.external_id, r.id]));

  // 3. Fetch latest price snapshot per catalog_product_id
  const catalogIds = [...idMap.values()];
  const { data: lastPrices } = await supabase
    .from('catalog_price_history')
    .select('catalog_product_id, price, captured_at')
    .in('catalog_product_id', catalogIds)
    .order('captured_at', { ascending: false });
  const lastByProduct = new Map();
  for (const row of lastPrices || []) {
    if (!lastByProduct.has(row.catalog_product_id)) {
      lastByProduct.set(row.catalog_product_id, Number(row.price));
    }
  }

  // 4. Build new price snapshots for changed prices
  const newSnapshots = [];
  for (const b of batch) {
    if (b.price == null) continue;
    const cpId = idMap.get(b.external_id);
    if (!cpId) continue;
    const last = lastByProduct.get(cpId);
    if (last == null || Math.abs(last - b.price) > 0.001) {
      newSnapshots.push({ catalog_product_id: cpId, price: b.price });
    }
  }
  if (newSnapshots.length > 0) {
    const { error: histErr } = await supabase.from('catalog_price_history').insert(newSnapshots);
    if (histErr) throw histErr;
  }

  return { upserted: rows.length, priceChanges: newSnapshots.length };
}

// ---------- category walker ----------

async function walkCategory(supabase, cookieHeader, categorySlug, deadline) {
  const stats = { pagesFetched: 0, tilesParsed: 0, upserted: 0, priceChanges: 0, cgid: null, dbg: {} };

  // 1. Initial fetch — получить cgid + первые tiles
  const first = await pdFetch(`/home/produtos/${categorySlug}`, cookieHeader);
  stats.pagesFetched++;
  stats.dbg.firstStatus = first.status;
  stats.dbg.firstUrl = first.url;
  stats.dbg.firstBytes = first.body.length;
  stats.dbg.firstTilesInHtml = (first.body.match(/data-gtm-info=/g) || []).length;
  const cgid = extractCgid(first.body);
  stats.cgid = cgid;
  const tiles = parseTiles(first.body);
  const details = extractDetailsMap(first.body);
  for (const t of tiles) {
    const d = details.get(t.external_id);
    if (d) Object.assign(t, d);
  }
  stats.tilesParsed += tiles.length;
  if (tiles.length > 0) {
    const r = await upsertBatch(supabase, tiles);
    stats.upserted += r.upserted;
    stats.priceChanges += r.priceChanges;
  }

  // 2. Pagination через Search-UpdateGrid (только если знаем cgid)
  if (!cgid) return stats;

  let start = tiles.length; // продолжаем с офсета первой страницы
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    const url = `/on/demandware.store/Sites-pingo-doce-Site/default/Search-UpdateGrid?cgid=${encodeURIComponent(cgid)}&start=${start}&sz=${PAGE_SIZE}`;
    const r = await pdFetch(url, cookieHeader, {
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${BASE}/home/produtos/${categorySlug}`,
    });
    stats.pagesFetched++;
    if (!stats.dbg.grid) {
      stats.dbg.grid = { status: r.status, url: r.url, bytes: r.body.length, tilesInHtml: (r.body.match(/data-gtm-info=/g) || []).length };
    }
    const pageTiles = parseTiles(r.body);
    const pageDetails = extractDetailsMap(r.body);
    for (const t of pageTiles) {
      const d = pageDetails.get(t.external_id);
      if (d) Object.assign(t, d);
    }
    if (pageTiles.length === 0) break;
    stats.tilesParsed += pageTiles.length;
    const ur = await upsertBatch(supabase, pageTiles);
    stats.upserted += ur.upserted;
    stats.priceChanges += ur.priceChanges;
    start += pageTiles.length;
    if (pageTiles.length < PAGE_SIZE) break;
  }

  return stats;
}

// ---------- handler ----------
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

  // Cookies (не обязательно для каталога, но помогает выглядеть как browser)
  let cookieHeader = '';
  try {
    const { data: session } = await supabase
      .from('pd_session')
      .select('cookies_encrypted')
      .eq('family_id', PD_FAMILY_ID)
      .single();
    if (session?.cookies_encrypted) {
      const cookies = JSON.parse(decrypt(decodeBytea(session.cookies_encrypted)));
      cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
  } catch {}

  // Cursor: какие категории обработать. Query ?categories=a,b,c — override дефолта.
  const requested = req.query?.categories ? String(req.query.categories).split(',') : LEAF_CATEGORIES;
  const skipFirst = Number(req.query?.skip || 0);
  const categories = requested.slice(skipFirst);

  const deadline = Date.now() + SOFT_TIMEOUT_MS;
  const started = Date.now();
  const results = [];
  let processedIndex = 0;

  for (const slug of categories) {
    if (Date.now() >= deadline) break;
    try {
      const s = await walkCategory(supabase, cookieHeader, slug, deadline);
      results.push({ category: slug, ...s });
    } catch (err) {
      results.push({ category: slug, error: err instanceof Error ? (err.stack || err.message) : JSON.stringify(err) });
    }
    processedIndex++;
  }

  const remaining = categories.slice(processedIndex);
  return res.status(200).json({
    ok: true,
    elapsed_ms: Date.now() - started,
    processed_categories: processedIndex,
    remaining_categories: remaining,
    totals: {
      tiles: results.reduce((s, r) => s + (r.tilesParsed || 0), 0),
      upserted: results.reduce((s, r) => s + (r.upserted || 0), 0),
      price_changes: results.reduce((s, r) => s + (r.priceChanges || 0), 0),
      pages: results.reduce((s, r) => s + (r.pagesFetched || 0), 0),
    },
    per_category: results,
  });
}
