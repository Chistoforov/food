// Backfill existing receipts through mobile API to fill in per-item prices
// (purchase_price, store_price, product_internal_code) that were missing when
// receipts were originally scraped via SFCC.
//
// Idempotent: only touches product_history rows whose purchase_price IS NULL.
// Also updates receipts.total_amount from the authoritative mobile source.
//
// POST with { pageNumber, pageSize } to control which page of latest transactions
// to walk. Default page 1, size 50. Max 100 items per call (Vercel 300s budget).
//
// Because SFCC data may have created products+history with lossy names, we do NOT
// re-create products here. We look up product_history rows for this receipt and
// update prices in-place by matching item order.

import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');
const BASE = 'https://app.pingodoce.pt';
const UA = 'OMPD/3.0 (Android)';

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
  if (raw == null) return Buffer.alloc(0);
  if (typeof raw !== 'string') return Buffer.from(raw);
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}
const toBytea = (b) => '\\x' + b.toString('hex');
function parsePtMoney(s) {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

async function loginWithPin(phoneE164, pin) {
  const res = await fetch(`${BASE}/api/v2/identity/onboarding/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ phoneNumber: phoneE164, password: pin }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`login ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function refreshTokens(accessToken, refreshToken) {
  const res = await fetch(`${BASE}/connect/refreshtoken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({ refresh_token: refreshToken }).toString(),
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(`refresh ${res.status}: ${text.slice(0, 300)}`); e.status = res.status; throw e; }
  return JSON.parse(text);
}
async function persistTokens(supabase, tokens) {
  await supabase.from('pd_session').update({
    access_token_encrypted: toBytea(encrypt(tokens.accessToken)),
    refresh_token_encrypted: toBytea(encrypt(tokens.refreshToken)),
    access_token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
    status: 'ok',
    last_success_at: new Date().toISOString(),
  }).eq('family_id', PD_FAMILY_ID);
}
async function ensureFreshTokens(supabase) {
  const { data: session } = await supabase
    .from('pd_session')
    .select('phone_local, pin_encrypted, access_token_encrypted, refresh_token_encrypted, access_token_expires_at')
    .eq('family_id', PD_FAMILY_ID)
    .single();
  if (!session?.phone_local || !session?.pin_encrypted) {
    throw new Error('pd_session not seeded — POST /api/admin/seed-mobile first');
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.access_token_expires_at
    ? Math.floor(new Date(session.access_token_expires_at).getTime() / 1000)
    : 0;
  if (session.access_token_encrypted && expiresAt - now > 300) {
    return {
      accessToken: decrypt(decodeBytea(session.access_token_encrypted)),
      refreshToken: decrypt(decodeBytea(session.refresh_token_encrypted)),
      expiresAt,
    };
  }
  if (session.access_token_encrypted && session.refresh_token_encrypted) {
    try {
      const r = await refreshTokens(
        decrypt(decodeBytea(session.access_token_encrypted)),
        decrypt(decodeBytea(session.refresh_token_encrypted)),
      );
      const t = { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: now + r.expires_in };
      await persistTokens(supabase, t);
      return t;
    } catch (err) { if (err.status !== 400 && err.status !== 401) throw err; }
  }
  const login = await loginWithPin(`+351${String(session.phone_local).trim()}`, decrypt(decodeBytea(session.pin_encrypted)));
  const t = { accessToken: login.token.access_token, refreshToken: login.token.refresh_token, expiresAt: now + login.token.expires_in };
  await persistTokens(supabase, t);
  return t;
}

async function listTransactions(accessToken, pageNumber, pageSize) {
  const res = await fetch(`${BASE}/api/v2/user/transactions?pageNumber=${pageNumber}&pageSize=${pageSize}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`list ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function getTransactionDetail(accessToken, transactionId, storeId) {
  const url = `${BASE}/api/v2/user/transactions/details?id=${encodeURIComponent(transactionId)}&storeId=${storeId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`detail ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// Match receipt's product_history rows to mobile API items by name similarity.
// Not doing this by index because SFCC/mobile item order can drift (bagged items skipped by SFCC, etc.).
// Simple approach: for each mobile item, find first product_history row for this receipt whose
// products.name normalizes to a rough match, then mark it used.
function normalize(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function catalogIdFor(supabase, cache, internalCode) {
  if (internalCode == null) return null;
  const k = String(internalCode);
  if (cache.has(k)) return cache.get(k);
  const { data } = await supabase.from('catalog_products').select('id').eq('external_id', k).limit(1).maybeSingle();
  const id = data?.id ?? null;
  cache.set(k, id);
  return id;
}

async function backfillReceipt(supabase, familyId, receiptRow, detail, catalogCache) {
  const items = detail.products?.list ?? [];
  const { data: histRows } = await supabase
    .from('product_history')
    .select('id, product_id, products!inner(name)')
    .eq('receipt_id', receiptRow.id)
    .is('purchase_price', null);
  if (!histRows || histRows.length === 0) return { updated: 0, unmatched: items.length, receiptId: receiptRow.id };

  const used = new Set();
  let updated = 0;

  for (const it of items) {
    const target = normalize(it.name);
    let hit = null;
    for (const h of histRows) {
      if (used.has(h.id)) continue;
      const cand = normalize(h.products?.name);
      if (cand === target) { hit = h; break; }
    }
    if (!hit) {
      // Fallback: 3-first-tokens match
      const tHead = target.split(' ').slice(0, 3).join(' ');
      for (const h of histRows) {
        if (used.has(h.id)) continue;
        const cand = normalize(h.products?.name);
        if (cand.startsWith(tHead) || tHead.startsWith(cand.split(' ').slice(0, 3).join(' '))) { hit = h; break; }
      }
    }
    if (!hit) continue;

    used.add(hit.id);
    const catalogId = await catalogIdFor(supabase, catalogCache, it.productInternalCode);
    await supabase.from('product_history').update({
      purchase_price: parsePtMoney(it.purchasePrice),
      store_price: parsePtMoney(it.storePrice),
      product_internal_code: it.productInternalCode ?? null,
      ...(catalogId ? { catalog_product_id: catalogId } : {}),
    }).eq('id', hit.id);
    updated++;
  }

  // Also update receipts.total_amount from authoritative mobile source.
  if (detail.details?.total != null) {
    await supabase.from('receipts').update({
      total_amount: detail.details.total,
      items_count: detail.details.totalItems ?? items.length,
    }).eq('id', receiptRow.id);
  }

  return { updated, unmatched: items.length - updated, receiptId: receiptRow.id };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const pageNumber = Number(body?.pageNumber || 1);
  const pageSize = Math.min(50, Number(body?.pageSize || 30));
  const maxItems = Math.min(100, Number(body?.maxItems || 25));

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();

  let tokens;
  try { tokens = await ensureFreshTokens(supabase); }
  catch (err) { return res.status(500).json({ ok: false, error: `auth: ${err.message}` }); }

  let summaries;
  try { summaries = await listTransactions(tokens.accessToken, pageNumber, pageSize); }
  catch (err) { return res.status(500).json({ ok: false, error: `list: ${err.message}` }); }

  // Only backfill receipts that already exist in DB AND have any NULL prices in product_history.
  const externals = summaries.map((s) => s.transactionNumber);
  const { data: receiptRows } = await supabase
    .from('receipts')
    .select('id, external_id')
    .eq('family_id', PD_FAMILY_ID)
    .in('external_id', externals);
  const byExt = new Map((receiptRows || []).map((r) => [r.external_id, r]));

  const toProcess = summaries.filter((s) => byExt.has(s.transactionNumber)).slice(0, maxItems);
  const results = [];
  const catalogCache = new Map();

  for (const summary of toProcess) {
    await new Promise((r) => setTimeout(r, 250));
    const receiptRow = byExt.get(summary.transactionNumber);
    try {
      const detail = await getTransactionDetail(tokens.accessToken, summary.transactionId, summary.transactionStoreId);
      const r = await backfillReceipt(supabase, PD_FAMILY_ID, receiptRow, detail, catalogCache);
      results.push({ tx: summary.transactionNumber, ...r });
    } catch (err) {
      results.push({ tx: summary.transactionNumber, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return res.status(200).json({
    ok: true,
    page_summary: { pageNumber, pageSize, returned: summaries.length, in_db: byExt.size },
    processed: results.length,
    total_updated_rows: results.reduce((a, r) => a + (r.updated || 0), 0),
    total_unmatched_items: results.reduce((a, r) => a + (r.unmatched || 0), 0),
    errors: results.filter((r) => r.error).length,
    error_details: results.filter((r) => r.error).slice(0, 5),
    elapsed_ms: Date.now() - started,
    sample: results.slice(0, 5),
  });
}
