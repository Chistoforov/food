import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');
const BASE = 'https://app.pingodoce.pt';
const UA = 'OMPD/3.0 (Android)';

// Max receipts per cron run. Each hit ~200-400ms + Supabase inserts.
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
  if (raw == null) return Buffer.alloc(0);
  if (typeof raw !== 'string') return Buffer.from(raw);
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}
const toBytea = (b) => '\\x' + b.toString('hex');

// ---------- mobile API auth ----------
// See memory: project_pd_scraper_pivot.md "Mobile-API v2 REVERSE COMPLETE".
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

// /connect/refreshtoken: only Bearer + refresh_token. Rotates refresh_token on each call.
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
  if (!res.ok) {
    const err = new Error(`refresh ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

// Returns { accessToken, refreshToken, expiresAt } and syncs pd_session as side effect.
async function ensureFreshTokens(supabase) {
  const { data: session, error } = await supabase
    .from('pd_session')
    .select('phone_local, pin_encrypted, access_token_encrypted, refresh_token_encrypted, access_token_expires_at')
    .eq('family_id', PD_FAMILY_ID)
    .single();
  if (error || !session) throw new Error(`No pd_session for family_id=${PD_FAMILY_ID}: ${error?.message}`);
  if (!session.phone_local || !session.pin_encrypted) {
    throw new Error('pd_session not seeded — POST /api/admin/seed-mobile first');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.access_token_expires_at
    ? Math.floor(new Date(session.access_token_expires_at).getTime() / 1000)
    : 0;

  // Path 1: token still fresh (>5 min).
  if (session.access_token_encrypted && expiresAt - now > 300) {
    return {
      accessToken: decrypt(decodeBytea(session.access_token_encrypted)),
      refreshToken: decrypt(decodeBytea(session.refresh_token_encrypted)),
      expiresAt,
    };
  }

  // Path 2: refresh (rotation).
  if (session.access_token_encrypted && session.refresh_token_encrypted) {
    try {
      const r = await refreshTokens(
        decrypt(decodeBytea(session.access_token_encrypted)),
        decrypt(decodeBytea(session.refresh_token_encrypted)),
      );
      const tokens = {
        accessToken: r.access_token,
        refreshToken: r.refresh_token,
        expiresAt: now + r.expires_in,
      };
      await persistTokens(supabase, tokens);
      return tokens;
    } catch (err) {
      if (err.status !== 400 && err.status !== 401) throw err;
      // fall through to PIN login
    }
  }

  // Path 3: refresh_token expired (30-90d cycle) → re-login with stored PIN.
  const pin = decrypt(decodeBytea(session.pin_encrypted));
  const login = await loginWithPin(`+351${String(session.phone_local).trim()}`, pin);
  const tokens = {
    accessToken: login.token.access_token,
    refreshToken: login.token.refresh_token,
    expiresAt: now + login.token.expires_in,
  };
  await persistTokens(supabase, tokens);
  return tokens;
}

async function persistTokens(supabase, tokens) {
  await supabase
    .from('pd_session')
    .update({
      access_token_encrypted: toBytea(encrypt(tokens.accessToken)),
      refresh_token_encrypted: toBytea(encrypt(tokens.refreshToken)),
      access_token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
      status: 'ok',
      last_success_at: new Date().toISOString(),
    })
    .eq('family_id', PD_FAMILY_ID);
}

// ---------- PD mobile API ----------
async function listTransactions(accessToken, pageNumber, pageSize) {
  const res = await fetch(
    `${BASE}/api/v2/user/transactions?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' } },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`list ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function getTransactionDetail(accessToken, transactionId, storeId) {
  const url = `${BASE}/api/v2/user/transactions/details?id=${encodeURIComponent(transactionId)}&storeId=${storeId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`detail ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// "2,79" → 2.79 (PT locale)
function parsePtMoney(s) {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeName(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------- DB ----------
// Best-effort PT→RU translation for a single fresh product name.
// Never throws — if OpenAI is down or key missing, we insert without name_ru
// (backfill via /api/admin/translate-products later).
async function translateSingle(name) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Translate a Portuguese grocery product name (from Pingo Doce receipt) to Russian. Keep brand names in Latin, keep units (g, kg, ml, L, cl). Common abbreviations: V.ALENT=Vinho Alentejano, PD=Pingo Doce, QJ=Queijo, FLC=Flocos, INT=Integral, SDR=Sem Doses de Redução. Return JSON {"ru": "..."}.',
          },
          { role: 'user', content: name },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    return typeof parsed.ru === 'string' ? parsed.ru : null;
  } catch {
    return null;
  }
}

async function findOrCreateProduct(supabase, familyId, name) {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('family_id', familyId)
    .ilike('name', name)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;
  const nameRu = await translateSingle(name);
  const { data: created, error } = await supabase
    .from('products')
    .insert({ name, original_name: name, name_ru: nameRu, family_id: familyId })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

// Fetches catalog_product_id by external_id == productInternalCode.
// Cache to avoid N+1: pass a Map<internal_code:string, catalog_id:number>.
async function catalogIdFor(supabase, cache, internalCode) {
  if (internalCode == null) return null;
  const k = String(internalCode);
  if (cache.has(k)) return cache.get(k);
  const { data } = await supabase
    .from('catalog_products')
    .select('id')
    .eq('external_id', k)
    .limit(1)
    .maybeSingle();
  const id = data?.id ?? null;
  cache.set(k, id);
  return id;
}

async function processReceipt(supabase, familyId, summary, detail, catalogCache) {
  const { data: existing } = await supabase
    .from('receipts')
    .select('id')
    .eq('external_id', summary.transactionNumber)
    .maybeSingle();
  if (existing) return { skipped: true, receiptId: existing.id };

  const dateOnly = String(summary.transactionDate).slice(0, 10);
  const { data: receipt, error: recErr } = await supabase
    .from('receipts')
    .insert({
      external_id: summary.transactionNumber,
      date: dateOnly,
      items_count: detail.details?.totalItems ?? detail.products?.list?.length ?? 0,
      total_amount: detail.details?.total ?? summary.total ?? 0,
      status: 'processed',
      family_id: familyId,
    })
    .select('id')
    .single();
  if (recErr) throw recErr;

  const items = detail.products?.list ?? [];
  for (const it of items) {
    const productId = await findOrCreateProduct(supabase, familyId, it.name);
    if (dateOnly) {
      const { data: prod } = await supabase
        .from('products')
        .select('last_purchase')
        .eq('id', productId)
        .maybeSingle();
      if (!prod?.last_purchase || prod.last_purchase < dateOnly) {
        await supabase.from('products').update({ last_purchase: dateOnly }).eq('id', productId);
      }
    }
    const catalogId = await catalogIdFor(supabase, catalogCache, it.productInternalCode);
    await supabase.from('product_history').insert({
      product_id: productId,
      catalog_product_id: catalogId,
      date: dateOnly,
      quantity: parsePtMoney(it.purchaseQuantity) || 1,
      family_id: familyId,
      receipt_id: receipt.id,
      purchase_price: parsePtMoney(it.purchasePrice),
      store_price: parsePtMoney(it.storePrice),
      product_internal_code: it.productInternalCode ?? null,
    });
  }

  return { skipped: false, receiptId: receipt.id, itemsInserted: items.length };
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

  const started = Date.now();
  let tokens;
  try {
    tokens = await ensureFreshTokens(supabase);
  } catch (err) {
    await supabase.from('pd_session').update({ status: 'expired' }).eq('family_id', PD_FAMILY_ID);
    return res.status(500).json({ ok: false, error: `auth: ${err.message}` });
  }

  // Fetch page 1 = latest 50 receipts. Assumes new receipts appear at the top;
  // older ones already in DB will be skipped by external_id check.
  // If more than 50 new appear (unlikely for daily cron), self-chained pagination TBD.
  let summaries;
  try {
    summaries = await listTransactions(tokens.accessToken, 1, 50);
  } catch (err) {
    return res.status(500).json({ ok: false, error: `list: ${err.message}` });
  }

  const externals = summaries.map((s) => s.transactionNumber);
  const { data: existingRows } = await supabase
    .from('receipts')
    .select('external_id')
    .eq('family_id', PD_FAMILY_ID)
    .in('external_id', externals);
  const existingSet = new Set((existingRows || []).map((r) => r.external_id));

  const toProcess = summaries.filter((s) => !existingSet.has(s.transactionNumber)).slice(0, batchSize);
  const results = [];
  let errors = 0;
  const catalogCache = new Map();

  for (const summary of toProcess) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const detail = await getTransactionDetail(tokens.accessToken, summary.transactionId, summary.transactionStoreId);
      const r = await processReceipt(supabase, PD_FAMILY_ID, summary, detail, catalogCache);
      results.push({ tx: summary.transactionNumber, ...r });
    } catch (err) {
      errors++;
      results.push({ tx: summary.transactionNumber, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return res.status(200).json({
    ok: true,
    family_id: PD_FAMILY_ID,
    total_on_page1: summaries.length,
    already_in_db: existingSet.size,
    processed_this_run: results.filter((r) => !r.error && !r.skipped).length,
    skipped_existing: results.filter((r) => r.skipped).length,
    errors,
    error_details: results.filter((r) => r.error).slice(0, 5),
    elapsed_ms: Date.now() - started,
    sample_results: results.slice(0, 5),
  });
}
