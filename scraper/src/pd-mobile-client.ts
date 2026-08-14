import { encryptCookies, decryptCookies } from './crypto.js';
import { getServiceSupabase } from './supabase.js';

// Reversed from decompiled O Meu Pingo Doce Android app (pt.pingodoce, native Kotlin).
// See memory: project_pd_scraper_pivot.md "Mobile-API v2 REVERSE COMPLETE".

const BASE = 'https://app.pingodoce.pt';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'OMPD/3.0 (Android)',
  'Accept': 'application/json',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
};

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
}

export interface PurchaseSummary {
  transactionNumber: string;
  transactionId: string;
  transactionStoreId: number;
  transactionStoreName: string;
  totalItems: number;
  totalDiscount: number;
  total: number;
  transactionDate: string; // ISO8601
  surveyState?: string;
}

export interface PurchaseItem {
  name: string;
  brandName: string | null;
  brandId: number | null;
  purchasePrice: number;
  purchaseQuantity: number;
  measureUnitCode: string; // "UN" | "KG" | ...
  storePrice: number;
  productInternalCode: number;
  elasticID: string;
  categoryId: number | null;
  hasLowerPrice: boolean;
}

export interface PurchaseDetail {
  transactionNumber: string;
  transactionStoreName: string;
  transactionDate: string;
  total: number;
  totalDiscount: number;
  totalItems: number;
  items: PurchaseItem[];
}

interface LoginResponse {
  profile: { userId: string; [k: string]: unknown };
  token: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Parses "2,79" or "1.234,56" (PT locale) → 2.79 / 1234.56
function parsePtMoney(s: string | number | null | undefined): number {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

async function jsonFetch<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new PdMobileError(`${init.method || 'GET'} ${url} → ${res.status}: ${text.slice(0, 500)}`, res.status, text);
  }
  return JSON.parse(text) as T;
}

export class PdMobileError extends Error {
  constructor(msg: string, public status: number, public body: string) {
    super(msg);
    this.name = 'PdMobileError';
  }
}

export class PdMobileClient {
  constructor(private tokens: OAuthTokens, private readonly familyId: number) {}

  getTokens(): OAuthTokens {
    return { ...this.tokens };
  }

  static async loginWithPin(phoneNumberE164: string, pin: string): Promise<OAuthTokens> {
    const data = await jsonFetch<LoginResponse>(
      `${BASE}/api/v2/identity/onboarding/login`,
      {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumberE164, password: pin }),
      },
    );
    const now = Math.floor(Date.now() / 1000);
    return {
      accessToken: data.token.access_token,
      refreshToken: data.token.refresh_token,
      expiresAt: now + data.token.expires_in,
    };
  }

  async refresh(): Promise<void> {
    // /connect/refreshtoken (controlled) does not require client_id — only Bearer + refresh_token.
    // Rotation: each call returns a new refresh_token; old one becomes invalid.
    const body = new URLSearchParams({ refresh_token: this.tokens.refreshToken });
    const data = await jsonFetch<RefreshResponse>(
      `${BASE}/connect/refreshtoken`,
      {
        method: 'POST',
        headers: {
          ...DEFAULT_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.tokens.accessToken}`,
        },
        body: body.toString(),
      },
    );
    const now = Math.floor(Date.now() / 1000);
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: now + data.expires_in,
    };
  }

  // Refresh if less than 5 min of TTL left.
  async ensureFresh(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokens.expiresAt - now < 300) {
      await this.refresh();
    }
  }

  private async authedGet<T>(path: string): Promise<T> {
    await this.ensureFresh();
    return jsonFetch<T>(`${BASE}${path}`, {
      method: 'GET',
      headers: { ...DEFAULT_HEADERS, Authorization: `Bearer ${this.tokens.accessToken}` },
    });
  }

  async listTransactions(pageNumber: number, pageSize: number): Promise<PurchaseSummary[]> {
    return this.authedGet<PurchaseSummary[]>(
      `/api/v2/user/transactions?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    );
  }

  async getTransactionDetail(transactionId: string, storeId: number): Promise<PurchaseDetail> {
    interface RawDetail {
      transactionNumber: string;
      transactionStoreName: string;
      transactionDate: string;
      details: { total: number; totalDiscount: number; totalItems: number };
      products: {
        list: Array<{
          name: string;
          brand: { id: number; name: string } | null;
          purchasePrice: string;
          purchaseQuantity: string;
          measureUnitCode: string;
          storePrice: string;
          productInternalCode: number;
          elasticID: string;
          categoryId: number | null;
          hasLowerPrice: boolean;
        }>;
      };
    }
    const raw = await this.authedGet<RawDetail>(
      `/api/v2/user/transactions/details?id=${encodeURIComponent(transactionId)}&storeId=${storeId}`,
    );
    return {
      transactionNumber: raw.transactionNumber,
      transactionStoreName: raw.transactionStoreName,
      transactionDate: raw.transactionDate,
      total: raw.details.total,
      totalDiscount: raw.details.totalDiscount,
      totalItems: raw.details.totalItems,
      items: (raw.products?.list ?? []).map((p) => ({
        name: p.name,
        brandName: p.brand?.name ?? null,
        brandId: p.brand?.id ?? null,
        purchasePrice: parsePtMoney(p.purchasePrice),
        purchaseQuantity: parsePtMoney(p.purchaseQuantity),
        measureUnitCode: p.measureUnitCode,
        storePrice: parsePtMoney(p.storePrice),
        productInternalCode: p.productInternalCode,
        elasticID: p.elasticID,
        categoryId: p.categoryId,
        hasLowerPrice: p.hasLowerPrice,
      })),
    };
  }
}

// ---------- persistence ----------

function toBytea(buf: Buffer): string {
  return '\\x' + buf.toString('hex');
}

function fromBytea(raw: unknown): Buffer {
  if (raw == null) return Buffer.alloc(0);
  if (typeof raw !== 'string') return Buffer.from(raw as ArrayBuffer);
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}

export interface StoredCredentials {
  phoneNumberE164: string;
  pin: string;
  tokens: OAuthTokens | null;
}

export async function loadCredentials(familyId: number): Promise<StoredCredentials> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('pd_session')
    .select('phone_local, pin_encrypted, access_token_encrypted, refresh_token_encrypted, access_token_expires_at')
    .eq('family_id', familyId)
    .single();
  if (error || !data) throw new Error(`No pd_session row for family_id=${familyId}: ${error?.message}`);
  if (!data.phone_local) throw new Error('phone_local not set — seed via seed-mobile-credentials.ts');
  if (!data.pin_encrypted) throw new Error('pin_encrypted not set — seed via seed-mobile-credentials.ts');
  const pin = decryptCookies(fromBytea(data.pin_encrypted));
  const tokens: OAuthTokens | null =
    data.access_token_encrypted && data.refresh_token_encrypted && data.access_token_expires_at
      ? {
          accessToken: decryptCookies(fromBytea(data.access_token_encrypted)),
          refreshToken: decryptCookies(fromBytea(data.refresh_token_encrypted)),
          expiresAt: Math.floor(new Date(data.access_token_expires_at).getTime() / 1000),
        }
      : null;
  return { phoneNumberE164: `+351${String(data.phone_local).trim()}`, pin, tokens };
}

export async function saveTokens(familyId: number, tokens: OAuthTokens): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase
    .from('pd_session')
    .update({
      access_token_encrypted: toBytea(encryptCookies(tokens.accessToken)),
      refresh_token_encrypted: toBytea(encryptCookies(tokens.refreshToken)),
      access_token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
      status: 'ok',
      last_success_at: new Date().toISOString(),
    })
    .eq('family_id', familyId);
}

// Bootstraps a working PdMobileClient: uses stored tokens, refreshes if stale,
// falls back to phone+PIN login if refresh_token has expired (30-90d cycle).
export async function getMobileClient(familyId: number): Promise<PdMobileClient> {
  const creds = await loadCredentials(familyId);
  const now = Math.floor(Date.now() / 1000);

  if (creds.tokens && creds.tokens.expiresAt - now > 300) {
    return new PdMobileClient(creds.tokens, familyId);
  }

  if (creds.tokens) {
    const client = new PdMobileClient(creds.tokens, familyId);
    try {
      await client.refresh();
      await saveTokens(familyId, client.getTokens());
      return client;
    } catch (err) {
      if (!(err instanceof PdMobileError) || err.status !== 400) throw err;
      // fall through to full login
    }
  }

  const fresh = await PdMobileClient.loginWithPin(creds.phoneNumberE164, creds.pin);
  await saveTokens(familyId, fresh);
  return new PdMobileClient(fresh, familyId);
}
