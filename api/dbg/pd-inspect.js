// Debug endpoint: возвращает имена cookies + response от Order-Detail для указанного trNumber.
// Использование: GET /api/dbg/pd-inspect?tr=<20-30 цифр>
// Bearer auth обязателен. Timeout ~15 сек. Только для расследования.
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_HEX = process.env.PD_COOKIE_ENCRYPTION_KEY || '';
const PD_FAMILY_ID = Number(process.env.PD_FAMILY_ID || '1');

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

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const listMode = req.query?.list === '1';
  const tr = req.query?.tr;
  if (!listMode && !tr) return res.status(400).json({ error: 'need ?tr=<trNumber> or ?list=1' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: session } = await supabase
    .from('pd_session')
    .select('cookies_encrypted')
    .eq('family_id', PD_FAMILY_ID)
    .single();
  const cookies = JSON.parse(decrypt(decodeBytea(session.cookies_encrypted)));

  const cookieNames = cookies.map((c) => c.name).sort();
  const hasSecureToken = cookieNames.includes('dwsecuretoken');
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  if (listMode) {
    const r = await fetch('https://www.pingodoce.pt/home/area-pessoal?menu=orders', {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: cookieHeader,
      },
    });
    const html = await r.text();
    const seen = new Set();
    const re = /trNumber=(\d{20,30})/g;
    let m;
    while ((m = re.exec(html))) seen.add(m[1]);
    // Забираем ВСЕ (сортировка PD — по дате desc, но проверим через возврат)
    const all = [...seen];
    // Возьмём 5 первых и 5 последних, чтобы увидеть диапазон
    return res.status(200).json({
      status: r.status,
      final_url: r.url,
      total: all.length,
      first_5: all.slice(0, 5),
      last_5: all.slice(-5),
    });
  }

  const withList = req.query?.withList === '1';

  const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
  const commonHeaders = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    Cookie: cookieHeader,
  };

  let listStep = null;
  if (withList) {
    const rl = await fetch('https://www.pingodoce.pt/home/area-pessoal?menu=orders', {
      redirect: 'follow',
      headers: commonHeaders,
    });
    const listSetCookie = rl.headers.getSetCookie ? rl.headers.getSetCookie() : [];
    const bodyHead = (await rl.text()).slice(0, 200);
    listStep = {
      status: rl.status,
      final_url: rl.url,
      set_cookie_headers: listSetCookie,
      body_head_200: bodyHead,
    };
  }

  const path = `/on/demandware.store/Sites-pingo-doce-Site/default/Order-Detail?trNumber=${encodeURIComponent(tr)}&digitalReceipt=`;
  const r = await fetch('https://www.pingodoce.pt' + path, {
    redirect: 'follow',
    headers: {
      ...commonHeaders,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.pingodoce.pt/home/area-pessoal?menu=orders',
    },
  });
  const setCookieHeaders = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  const body = await r.text();

  return res.status(200).json({
    tr,
    cookie_names_in_jar: cookieNames,
    has_dwsecuretoken: hasSecureToken,
    list_step: listStep,
    order_detail: {
      status: r.status,
      final_url: r.url,
      content_type: r.headers.get('content-type'),
      body_head_600: body.slice(0, 600),
      body_length: body.length,
      set_cookie_headers: setCookieHeaders,
    },
  });
}
