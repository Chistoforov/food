export interface PdCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function filterPdCookies(cookies: PdCookie[]): PdCookie[] {
  return cookies.filter((c) => {
    const d = c.domain.replace(/^\./, '');
    return d === 'pingodoce.pt' || d.endsWith('.pingodoce.pt');
  });
}

export function serializeForCookieHeader(cookies: PdCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export function mergeSetCookie(existing: PdCookie[], setCookieHeaders: string[]): PdCookie[] {
  const map = new Map(existing.map((c) => [`${c.domain}|${c.path}|${c.name}`, c]));
  for (const raw of setCookieHeaders) {
    const parsed = parseSetCookie(raw);
    if (!parsed) continue;
    map.set(`${parsed.domain}|${parsed.path}|${parsed.name}`, parsed);
  }
  return [...map.values()];
}

function parseSetCookie(raw: string): PdCookie | null {
  const parts = raw.split(';').map((p) => p.trim());
  if (parts.length === 0) return null;
  const [nameValue, ...attrs] = parts;
  const eq = nameValue.indexOf('=');
  if (eq < 0) return null;
  const cookie: PdCookie = {
    name: nameValue.slice(0, eq),
    value: nameValue.slice(eq + 1),
    domain: '.pingodoce.pt',
    path: '/',
  };
  for (const attr of attrs) {
    const [k, v] = attr.split('=');
    const key = k.toLowerCase();
    if (key === 'domain' && v) cookie.domain = v.startsWith('.') ? v : `.${v}`;
    else if (key === 'path' && v) cookie.path = v;
    else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'expires' && v) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) cookie.expires = t / 1000;
    } else if (key === 'max-age' && v) {
      cookie.expires = Date.now() / 1000 + parseInt(v, 10);
    } else if (key === 'samesite' && v) {
      const s = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
      if (s === 'Strict' || s === 'Lax' || s === 'None') cookie.sameSite = s;
    }
  }
  return cookie;
}
