// Diagnostic: dump raw /user/transactions from PD mobile API.
// Reads encrypted tokens from pd_session, refreshes if needed, prints the list.
// Read-only — writes nothing beyond token-rotation side effect in pd_session.
//
// GET /api/admin/dump-transactions
//   Authorization: Bearer <CRON_SECRET>
//   ?pageNumber=1&pageSize=50

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

async function ensureFreshTokens(supabase) {
  const { data: s } = await supabase
    .from('pd_session')
    .select('access_token_encrypted, refresh_token_encrypted, access_token_expires_at')
    .eq('family_id', PD_FAMILY_ID)
    .single();
  if (!s) throw new Error('No pd_session');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = s.access_token_expires_at
    ? Math.floor(new Date(s.access_token_expires_at).getTime() / 1000) : 0;
  if (s.access_token_encrypted && expiresAt - now > 300) {
    return decrypt(decodeBytea(s.access_token_encrypted));
  }
  const r = await refreshTokens(
    decrypt(decodeBytea(s.access_token_encrypted)),
    decrypt(decodeBytea(s.refresh_token_encrypted)),
  );
  await supabase.from('pd_session').update({
    access_token_encrypted: toBytea(encrypt(r.access_token)),
    refresh_token_encrypted: toBytea(encrypt(r.refresh_token)),
    access_token_expires_at: new Date((now + r.expires_in) * 1000).toISOString(),
  }).eq('family_id', PD_FAMILY_ID);
  return r.access_token;
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const pageNumber = Number(req.query?.pageNumber || 1);
  const pageSize = Number(req.query?.pageSize || 50);
  try {
    const accessToken = await ensureFreshTokens(supabase);
    const r = await fetch(
      `${BASE}/api/v2/user/transactions?pageNumber=${pageNumber}&pageSize=${pageSize}`,
      { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' } },
    );
    const text = await r.text();
    if (!r.ok) return res.status(500).json({ error: `list ${r.status}`, body: text.slice(0, 500) });
    const list = JSON.parse(text);
    const withDetail = Number(req.query?.detail || '1') === 1;
    const limit = Number(req.query?.limit || 15);
    const slice = list.slice(0, limit);
    const items = [];
    for (const t of slice) {
      const base = {
        transactionDate: t.transactionDate,
        transactionNumber: t.transactionNumber,
        transactionId: t.transactionId,
        transactionStoreId: t.transactionStoreId,
        transactionType: t.transactionType ?? null,
        total: t.total,
        totalItems: t.totalItems ?? null,
        summary_keys: Object.keys(t),
      };
      if (withDetail) {
        try {
          const dr = await fetch(
            `${BASE}/api/v2/user/transactions/details?id=${encodeURIComponent(t.transactionId)}&storeId=${t.transactionStoreId}`,
            { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA, Accept: 'application/json' } },
          );
          const dt = await dr.text();
          if (!dr.ok) { items.push({ ...base, detail_error: `${dr.status}: ${dt.slice(0, 200)}` }); continue; }
          const detail = JSON.parse(dt);
          const prodList = detail.products?.list ?? [];
          items.push({
            ...base,
            detail_items: prodList.length,
            detail_total: detail.details?.total ?? null,
            detail_totalItems: detail.details?.totalItems ?? null,
            detail_keys: Object.keys(detail),
            products_keys: detail.products ? Object.keys(detail.products) : null,
            first_item: prodList[0] ? { name: prodList[0].name, qty: prodList[0].purchaseQuantity, price: prodList[0].purchasePrice } : null,
          });
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          items.push({ ...base, detail_error: err.message });
        }
      } else {
        items.push(base);
      }
    }
    return res.status(200).json({ count: list.length, inspected: items.length, items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
