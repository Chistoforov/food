import type { PdCookie } from './cookies.js';
import { mergeSetCookie, serializeForCookieHeader } from './cookies.js';

const BASE = 'https://www.pingodoce.pt';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export interface FetchResult {
  status: number;
  url: string;
  html: string;
}

export class PdClient {
  private cookies: PdCookie[];
  private lastRequestAt = 0;
  private readonly minGapMs = 300;

  constructor(cookies: PdCookie[]) {
    this.cookies = cookies;
  }

  getCookies(): PdCookie[] {
    return this.cookies;
  }

  isSessionExpired(res: FetchResult): boolean {
    if (res.status === 401 || res.status === 403) return true;
    return /\/home\/login/.test(res.url);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = this.minGapMs - (now - this.lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  async fetch(path: string, init: RequestInit = {}): Promise<FetchResult> {
    await this.throttle();
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
      Cookie: serializeForCookieHeader(this.cookies),
    };
    const res = await fetch(url, { ...init, headers, redirect: 'follow' });
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    if (setCookieHeaders.length > 0) {
      this.cookies = mergeSetCookie(this.cookies, setCookieHeaders);
    }
    const html = await res.text();
    return { status: res.status, url: res.url, html };
  }

  async getOrders(): Promise<FetchResult> {
    return this.fetch('/home/area-pessoal?menu=orders');
  }

  async getOrderDetail(trNumber: string): Promise<FetchResult> {
    return this.fetch(
      `/on/demandware.store/Sites-pingo-doce-Site/pt_PT/Order-Detail?trNumber=${encodeURIComponent(trNumber)}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
  }
}

export function parseOrderNumbersFromListing(html: string): string[] {
  const set = new Set<string>();
  const re1 = /trNumber=(\d{18,22})/g;
  const re2 = /data-tr-number="(\d{18,22})"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html))) set.add(m[1]);
  while ((m = re2.exec(html))) set.add(m[1]);
  return [...set];
}
