import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// ---------- env ----------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

// ---------- crypto ----------
const IV_LEN = 12;
const TAG_LEN = 16;

function key() {
  if (ENC_KEY_HEX.length !== 64) {
    throw new Error('PD_COOKIE_ENCRYPTION_KEY must be 64-char hex (32 bytes)');
  }
  return Buffer.from(ENC_KEY_HEX, 'hex');
}

function encrypt(plain) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]);
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

// Cookies we care about for auth-state tracking.
// dwsid = SFCC live session, dwac_* = customer token, sid = anonymous session,
// dwanonymous_* = long-lived anon id, cqcid/cquid = Coveo/Commerce Cloud IDs,
// RT / AWSALB* = Akamai + AWS ALB routing.
const AUTH_COOKIE_NAMES = ['dwsid', 'sid', 'cqcid', 'cquid', 'RT', 'AWSALB', 'AWSALBCORS'];
const AUTH_COOKIE_PREFIXES = ['dwac_', 'dwanonymous_'];

function isAuthCookie(name) {
  if (AUTH_COOKIE_NAMES.includes(name)) return true;
  return AUTH_COOKIE_PREFIXES.some((p) => name.startsWith(p));
}

function cookieMap(cookies) {
  const m = {};
  for (const c of cookies) {
    if (!isAuthCookie(c.name)) continue;
    m[c.name] = { value: c.value, expires: c.expires ?? null };
  }
  return m;
}

function diffAuthCookies(before, after) {
  const b = cookieMap(before);
  const a = cookieMap(after);
  const added = [];
  const removed = [];
  const changed = [];
  for (const name of Object.keys(a)) {
    if (!(name in b)) added.push(name);
    else if (b[name].value !== a[name].value) changed.push(name);
  }
  for (const name of Object.keys(b)) {
    if (!(name in a)) removed.push(name);
  }
  return {
    present_before: Object.keys(b).sort(),
    present_after: Object.keys(a).sort(),
    added,
    removed,
    changed,
    dwsid_expires_after: a.dwsid?.expires ?? null,
    dwac_expires_after: Object.entries(a).find(([n]) => n.startsWith('dwac_'))?.[1]?.expires ?? null,
  };
}

// ---------- PD deep probe ----------
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const BASE_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
};

async function get(url, cookies, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      ...BASE_HEADERS,
      ...extraHeaders,
      Cookie: serializeCookieHeader(cookies),
    },
  });
  const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const body = await res.text();
  const merged = setCookieHeaders.length > 0 ? mergeSetCookie(cookies, setCookieHeaders) : cookies;
  return { status: res.status, url: res.url, body, cookies: merged };
}

async function probe(startCookies) {
  const started = Date.now();

  const ordersRes = await get('https://www.pingodoce.pt/home/area-pessoal?menu=orders', startCookies);

  const isLogin = /\/home\/login/.test(ordersRes.url);
  const loggedIn = ordersRes.status === 200 && !isLogin;

  const trSet = new Set();
  if (loggedIn) {
    const re = /trNumber=(\d{20,30})/g;
    let m;
    while ((m = re.exec(ordersRes.body))) trSet.add(m[1]);
  }

  return {
    http_status: ordersRes.status,
    finalUrl: ordersRes.url,
    is_logged_in: loggedIn,
    orders_count: loggedIn ? trSet.size : null,
    deep_ok: null,
    response_time_ms: Date.now() - started,
    newCookies: ordersRes.cookies,
  };
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

  try {
    const { data: session, error: e1 } = await supabase
      .from('pd_session')
      .select('cookies_encrypted')
      .eq('family_id', PD_FAMILY_ID)
      .single();
    if (e1 || !session?.cookies_encrypted) {
      await supabase.from('pd_session_probe').insert({
        family_id: PD_FAMILY_ID,
        http_status: null,
        is_logged_in: false,
        orders_count: null,
        response_time_ms: null,
        error: 'No cookies in pd_session',
      });
      return res.status(200).json({ ok: false, reason: 'no-cookies' });
    }

    const blob = decodeBytea(session.cookies_encrypted);
    const before = JSON.parse(decrypt(blob));
    const result = await probe(before);
    const cookieDelta = diffAuthCookies(before, result.newCookies);

    await supabase.from('pd_session_probe').insert({
      family_id: PD_FAMILY_ID,
      http_status: result.http_status,
      is_logged_in: result.is_logged_in,
      orders_count: result.orders_count,
      response_time_ms: result.response_time_ms,
      error: null,
      cookie_delta: cookieDelta,
      deep_ok: result.deep_ok,
    });

    if (result.is_logged_in) {
      await supabase
        .from('pd_session')
        .update({
          cookies_encrypted: '\\x' + encrypt(JSON.stringify(result.newCookies)).toString('hex'),
          status: 'ok',
          last_success_at: new Date().toISOString(),
        })
        .eq('family_id', PD_FAMILY_ID);
    } else {
      await supabase.from('pd_session').update({ status: 'expired' }).eq('family_id', PD_FAMILY_ID);
    }

    return res.status(200).json({
      ok: true,
      family_id: PD_FAMILY_ID,
      http_status: result.http_status,
      is_logged_in: result.is_logged_in,
      orders_count: result.orders_count,
      deep_ok: result.deep_ok,
      final_url: result.finalUrl,
      response_time_ms: result.response_time_ms,
      cookie_delta: cookieDelta,
    });
  } catch (err) {
    await supabase.from('pd_session_probe').insert({
      family_id: PD_FAMILY_ID,
      http_status: null,
      is_logged_in: null,
      orders_count: null,
      response_time_ms: null,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
