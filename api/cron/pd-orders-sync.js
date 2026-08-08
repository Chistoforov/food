import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

// Максимум чеков за один вызов (Vercel timeout 300s, каждый чек ~1.2s + inserts).
// 40 чеков ~ 60-80 сек с запасом.
const DEFAULT_BATCH = Number(process.env.PD_ORDERS_BATCH || '40');

// ---------- crypto ----------
const IV_LEN = 12;
const TAG_LEN = 16;
function key() {
  if (ENC_KEY_HEX.length !== 64) throw new Error('PD_COOKIE_ENCRYPTION_KEY must be 64-char hex');
  return Buffer.from(ENC_KEY_HEX, 'hex');
}
function encrypt(plain) {
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}
function decrypt(blob) {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(IV_LEN, blob.length - TAG_LEN);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
function decodeBytea(raw) {
  if (typeof raw !== 'string') return Buffer.from(raw);
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}

// ---------- cookies ----------
function serializeCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
function parseSetCookie(raw) {
  const parts = raw.split(';').map((p) => p.trim());
  const [nv, ...attrs] = parts;
  const eq = nv.indexOf('=');
  if (eq < 0) return null;
  const c = { name: nv.slice(0, eq), value: nv.slice(eq + 1), domain: '.pingodoce.pt', path: '/' };
  for (const a of attrs) {
    const [k, v] = a.split('=');
    const key = k.toLowerCase();
    if (key === 'domain' && v) c.domain = v.startsWith('.') ? v : `.${v}`;
    else if (key === 'path' && v) c.path = v;
    else if (key === 'httponly') c.httpOnly = true;
    else if (key === 'secure') c.secure = true;
    else if (key === 'expires' && v) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) c.expires = t / 1000;
    } else if (key === 'max-age' && v) {
      c.expires = Date.now() / 1000 + parseInt(v, 10);
    }
  }
  return c;
}
function mergeSetCookie(existing, headers) {
  const map = new Map(existing.map((c) => [`${c.domain}|${c.path}|${c.name}`, c]));
  for (const raw of headers) {
    const p = parseSetCookie(raw);
    if (!p) continue;
    map.set(`${p.domain}|${p.path}|${p.name}`, p);
  }
  return [...map.values()];
}

// ---------- HTML helpers ----------
function decodeEntities(s) {
  return s
    .replace(/&Aacute;/g, 'Á').replace(/&aacute;/g, 'á')
    .replace(/&Eacute;/g, 'É').replace(/&eacute;/g, 'é')
    .replace(/&Iacute;/g, 'Í').replace(/&iacute;/g, 'í')
    .replace(/&Oacute;/g, 'Ó').replace(/&oacute;/g, 'ó')
    .replace(/&Uacute;/g, 'Ú').replace(/&uacute;/g, 'ú')
    .replace(/&Atilde;/g, 'Ã').replace(/&atilde;/g, 'ã')
    .replace(/&Otilde;/g, 'Õ').replace(/&otilde;/g, 'õ')
    .replace(/&Ntilde;/g, 'Ñ').replace(/&ntilde;/g, 'ñ')
    .replace(/&Ccedil;/g, 'Ç').replace(/&ccedil;/g, 'ç')
    .replace(/&Acirc;/g, 'Â').replace(/&acirc;/g, 'â')
    .replace(/&Ecirc;/g, 'Ê').replace(/&ecirc;/g, 'ê')
    .replace(/&Ocirc;/g, 'Ô').replace(/&ocirc;/g, 'ô')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseDateDdMmYyyy(str) {
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parsePortugueseMoney(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Список чеков → массив { trNumber, date, total, storeName, inStore }
// Разбиваем HTML по маркеру `.order-card`, для каждого блока — от текущей позиции до следующей.
function parseOrderList(html) {
  const orders = [];
  const anchor = 'class="order-card';
  const positions = [];
  let idx = 0;
  while ((idx = html.indexOf(anchor, idx)) !== -1) {
    positions.push(idx);
    idx += anchor.length;
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const block = html.slice(start, end);
    const totalMatch = block.match(/data-store-total="([^"]*)"/);
    const inStoreMatch = block.match(/data-in-store="([^"]*)"/);
    const nameMatch = block.match(/data-store-name="([^"]*)"/);
    const dateMatch = block.match(/class="order-date"[^>]*>\s*([^<]+)/);
    const trMatch = block.match(/trNumber=(\d{20,30})/);
    if (!trMatch) continue;
    orders.push({
      trNumber: trMatch[1],
      date: dateMatch ? parseDateDdMmYyyy(dateMatch[1]) : null,
      total: totalMatch ? parsePortugueseMoney(totalMatch[1]) : 0,
      storeName: nameMatch ? nameMatch[1].trim() : null,
      inStore: inStoreMatch ? inStoreMatch[1] === 'true' : true,
    });
  }
  return orders;
}

// HTML детали чека → массив { name, quantity, unit }
function parseOrderDetail(html) {
  const items = [];
  const anchor = 'class="detail-card';
  const positions = [];
  let idx = 0;
  while ((idx = html.indexOf(anchor, idx)) !== -1) {
    positions.push(idx);
    idx += anchor.length;
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const block = html.slice(start, end);
    const nameMatch = block.match(/class="product-name[^"]*"[^>]*>\s*([^<]+?)\s*</);
    const qtyMatch = block.match(/class="product-quantity[^"]*"[^>]*>\s*Qtd:\s*([\d.,]+)\s*(UN|KG|GR|L|ML)?/i);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1].trim());
    const qtyRaw = qtyMatch ? qtyMatch[1].replace(',', '.') : '1';
    const quantity = parseFloat(qtyRaw) || 1;
    const unit = qtyMatch && qtyMatch[2] ? qtyMatch[2].toUpperCase() : 'UN';
    items.push({ name, quantity, unit });
  }
  return items;
}

function normalizeName(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------- PD fetch ----------
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const BASE = 'https://www.pingodoce.pt';

async function pdFetch(path, cookies, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      Cookie: serializeCookieHeader(cookies),
      ...extraHeaders,
    },
  });
  const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const body = await res.text();
  return { status: res.status, url: res.url, body, setCookieHeaders };
}

async function fetchOrderList(cookies) {
  const r = await pdFetch('/home/area-pessoal?menu=orders', cookies);
  if (/\/home\/login/.test(r.url) || r.status !== 200) return { orders: [], setCookieHeaders: r.setCookieHeaders, expired: true };
  return { orders: parseOrderList(r.body), setCookieHeaders: r.setCookieHeaders, expired: false };
}

async function fetchOrderDetail(trNumber, cookies) {
  const path = `/on/demandware.store/Sites-pingo-doce-Site/default/Order-Detail?trNumber=${encodeURIComponent(trNumber)}&digitalReceipt=`;
  const r = await pdFetch(path, cookies, { 'X-Requested-With': 'XMLHttpRequest' });
  // Настоящий expired: редирект на login ИЛИ 401/403.
  const sessionExpired = /\/home\/login/.test(r.url) || r.status === 401 || r.status === 403;
  if (sessionExpired) return { items: [], setCookieHeaders: r.setCookieHeaders, sessionExpired: true, parseError: null };
  // Индивидуальный glitch (не-JSON, success:false и т.п.) — не роняем весь batch.
  let json;
  try {
    json = JSON.parse(r.body);
  } catch (e) {
    return { items: [], setCookieHeaders: r.setCookieHeaders, sessionExpired: false, parseError: `not-json (status=${r.status})` };
  }
  if (!json.success || !json.html) {
    return { items: [], setCookieHeaders: r.setCookieHeaders, sessionExpired: false, parseError: 'success=false or no html' };
  }
  return { items: parseOrderDetail(json.html), setCookieHeaders: r.setCookieHeaders, sessionExpired: false, parseError: null };
}

// ---------- DB ----------
async function findOrCreateProduct(supabase, familyId, name) {
  const normalized = normalizeName(name);
  // Ищем по нормализованному имени в семье
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('family_id', familyId)
    .ilike('name', name)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;
  const { data: created, error } = await supabase
    .from('products')
    .insert({ name, original_name: name, family_id: familyId })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function processOrder(supabase, familyId, listEntry, detail) {
  // Insert receipt (idempotent: external_id UNIQUE)
  const { data: existing } = await supabase
    .from('receipts')
    .select('id')
    .eq('external_id', listEntry.trNumber)
    .maybeSingle();
  if (existing) return { skipped: true, receiptId: existing.id };

  const { data: receipt, error: recErr } = await supabase
    .from('receipts')
    .insert({
      external_id: listEntry.trNumber,
      date: listEntry.date || new Date().toISOString().slice(0, 10),
      items_count: detail.items.length,
      total_amount: listEntry.total || 0,
      status: 'processed',
      family_id: familyId,
    })
    .select('id')
    .single();
  if (recErr) throw recErr;

  for (const it of detail.items) {
    const productId = await findOrCreateProduct(supabase, familyId, it.name);
    // last_purchase = MAX(existing, current) — не понижаем при бэкфилле старых чеков
    if (listEntry.date) {
      const { data: prod } = await supabase
        .from('products')
        .select('last_purchase')
        .eq('id', productId)
        .single();
      if (!prod?.last_purchase || prod.last_purchase < listEntry.date) {
        await supabase.from('products').update({ last_purchase: listEntry.date }).eq('id', productId);
      }
    }
    await supabase.from('product_history').insert({
      product_id: productId,
      catalog_product_id: null,
      date: listEntry.date || new Date().toISOString().slice(0, 10),
      quantity: it.quantity,
      family_id: familyId,
      receipt_id: receipt.id,
    });
  }

  return { skipped: false, receiptId: receipt.id, itemsInserted: detail.items.length };
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

  const batchSize = Number(req.query?.batch || DEFAULT_BATCH);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: session, error: sessErr } = await supabase
    .from('pd_session')
    .select('cookies_encrypted')
    .eq('family_id', PD_FAMILY_ID)
    .single();
  if (sessErr || !session?.cookies_encrypted) {
    return res.status(500).json({ error: 'No cookies in pd_session' });
  }

  let cookies = JSON.parse(decrypt(decodeBytea(session.cookies_encrypted)));

  const started = Date.now();
  const listResult = await fetchOrderList(cookies);
  if (listResult.expired) {
    await supabase.from('pd_session').update({ status: 'expired' }).eq('family_id', PD_FAMILY_ID);
    return res.status(200).json({ ok: false, reason: 'session-expired' });
  }
  if (listResult.setCookieHeaders.length > 0) cookies = mergeSetCookie(cookies, listResult.setCookieHeaders);

  const allOrders = listResult.orders;
  const trs = allOrders.map((o) => o.trNumber);
  const { data: existingRows } = await supabase
    .from('receipts')
    .select('external_id')
    .eq('family_id', PD_FAMILY_ID)
    .in('external_id', trs);
  const existingSet = new Set((existingRows || []).map((r) => r.external_id));

  const toProcess = allOrders.filter((o) => !existingSet.has(o.trNumber)).slice(0, batchSize);
  const results = [];
  let errors = 0;

  let sessionExpiredMid = false;
  for (const listEntry of toProcess) {
    // Rate-limit ~350ms между запросами к PD
    await new Promise((r) => setTimeout(r, 350));
    try {
      const detail = await fetchOrderDetail(listEntry.trNumber, cookies);
      if (detail.sessionExpired) {
        await supabase.from('pd_session').update({ status: 'expired' }).eq('family_id', PD_FAMILY_ID);
        sessionExpiredMid = true;
        break;
      }
      if (detail.setCookieHeaders.length > 0) cookies = mergeSetCookie(cookies, detail.setCookieHeaders);
      if (detail.parseError) {
        errors++;
        results.push({ tr: listEntry.trNumber, error: detail.parseError });
        continue;
      }
      const r = await processOrder(supabase, PD_FAMILY_ID, listEntry, detail);
      results.push({ tr: listEntry.trNumber, ...r });
    } catch (err) {
      errors++;
      results.push({ tr: listEntry.trNumber, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Сохраняем обновлённые cookies. Статус не понижаем до 'ok' если mid-run отвалилась сессия.
  await supabase
    .from('pd_session')
    .update({
      cookies_encrypted: '\\x' + encrypt(JSON.stringify(cookies)).toString('hex'),
      ...(sessionExpiredMid ? { status: 'expired' } : { status: 'ok', last_success_at: new Date().toISOString() }),
    })
    .eq('family_id', PD_FAMILY_ID);

  return res.status(200).json({
    ok: true,
    family_id: PD_FAMILY_ID,
    total_orders_in_pd: allOrders.length,
    already_in_db: existingSet.size,
    processed_this_run: results.filter((r) => !r.error && !r.skipped).length,
    skipped_existing: results.filter((r) => r.skipped).length,
    errors,
    error_details: results.filter((r) => r.error).slice(0, 5),
    remaining: Math.max(0, allOrders.length - existingSet.size - results.filter((r) => !r.error).length),
    session_expired_mid: sessionExpiredMid,
    elapsed_ms: Date.now() - started,
    sample_results: results.slice(0, 5),
  });
}
