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
const toBytea = (b) => '\\x' + b.toString('hex');

async function loginWithPin(phoneE164, pin) {
  const res = await fetch('https://app.pingodoce.pt/api/v2/identity/onboarding/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'OMPD/3.0 (Android)' },
    body: JSON.stringify({ phoneNumber: phoneE164, password: pin }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`login ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }
  const phoneLocal = String(body?.phoneLocal || '').trim();
  const pin = String(body?.pin || '').trim();
  if (!/^\d{9}$/.test(phoneLocal)) return res.status(400).json({ error: 'phoneLocal must be 9 digits' });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'pin must be 4-6 digits' });

  let loginResp;
  try {
    loginResp = await loginWithPin(`+351${phoneLocal}`, pin);
  } catch (err) {
    return res.status(502).json({ error: `PD login failed: ${err.message}` });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + loginResp.token.expires_in) * 1000).toISOString();

  const { error } = await supabase
    .from('pd_session')
    .upsert(
      {
        family_id: PD_FAMILY_ID,
        phone_local: phoneLocal,
        pin_encrypted: toBytea(encrypt(pin)),
        access_token_encrypted: toBytea(encrypt(loginResp.token.access_token)),
        refresh_token_encrypted: toBytea(encrypt(loginResp.token.refresh_token)),
        access_token_expires_at: expiresAt,
        mobile_user_id: loginResp.profile?.userId ?? null,
        status: 'ok',
        last_success_at: new Date().toISOString(),
      },
      { onConflict: 'family_id' },
    );
  if (error) return res.status(500).json({ error: `DB upsert failed: ${error.message}` });

  return res.status(200).json({
    ok: true,
    family_id: PD_FAMILY_ID,
    userId: loginResp.profile?.userId,
    firstName: loginResp.profile?.firstName,
    ompdCard: loginResp.profile?.ompdCard,
    access_token_expires_at: expiresAt,
    scope: loginResp.token.scope,
  });
}
