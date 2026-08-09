import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

const IV_LEN = 12;
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

function filterPdCookies(cookies) {
  return (cookies || []).filter((c) => {
    const d = String(c.domain || '').replace(/^\./, '');
    return d === 'pingodoce.pt' || d.endsWith('.pingodoce.pt');
  });
}

// Normalize CDP Network.getCookies shape into our PdCookie shape
function normalizeCdpCookie(c) {
  const out = {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
  };
  if (typeof c.expires === 'number' && c.expires > 0) out.expires = c.expires;
  if (c.httpOnly) out.httpOnly = true;
  if (c.secure) out.secure = true;
  if (c.sameSite) {
    const s = String(c.sameSite);
    const norm = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (norm === 'Strict' || norm === 'Lax' || norm === 'None') out.sameSite = norm;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  const rawCookies = body?.cookies;
  if (!Array.isArray(rawCookies) || rawCookies.length === 0) {
    return res.status(400).json({ error: 'Body must be { cookies: [...] } with at least one cookie' });
  }

  const cookies = filterPdCookies(rawCookies.map(normalizeCdpCookie));
  if (cookies.length === 0) {
    return res.status(400).json({ error: 'No pingodoce.pt cookies in payload' });
  }

  let encrypted;
  try {
    encrypted = encrypt(JSON.stringify(cookies));
  } catch (err) {
    return res.status(500).json({ error: `Encryption failed: ${err.message}` });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from('pd_session')
    .upsert({
      family_id: PD_FAMILY_ID,
      cookies_encrypted: encrypted,
      status: 'ok',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'family_id' });

  if (error) {
    return res.status(500).json({ error: `DB upsert failed: ${error.message}` });
  }

  return res.status(200).json({
    ok: true,
    family_id: PD_FAMILY_ID,
    cookies_saved: cookies.length,
    cookie_names: cookies.map(c => c.name),
  });
}
