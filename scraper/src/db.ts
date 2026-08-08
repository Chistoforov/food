import { getServiceSupabase } from './supabase.js';
import { encryptCookies, decryptCookies } from './crypto.js';
import type { PdCookie } from './cookies.js';

export type PdSessionStatus = 'ok' | 'expired' | 'awaiting_sms' | 'unknown' | 'error';

export interface ProbeRecord {
  family_id: number;
  http_status: number | null;
  is_logged_in: boolean | null;
  orders_count: number | null;
  response_time_ms: number | null;
  error: string | null;
}

export async function loadCookies(familyId: number): Promise<PdCookie[] | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('pd_session')
    .select('cookies_encrypted')
    .eq('family_id', familyId)
    .single();
  if (error || !data?.cookies_encrypted) return null;
  const blob = decodeSupabaseBytea(data.cookies_encrypted as unknown as string);
  const json = decryptCookies(blob);
  return JSON.parse(json) as PdCookie[];
}

export async function saveCookies(
  familyId: number,
  cookies: PdCookie[],
  status: PdSessionStatus,
): Promise<void> {
  const supabase = getServiceSupabase();
  const blob = encryptCookies(JSON.stringify(cookies));
  const encoded = `\\x${blob.toString('hex')}`;
  const { error } = await supabase
    .from('pd_session')
    .upsert(
      {
        family_id: familyId,
        cookies_encrypted: encoded,
        status,
        last_success_at: status === 'ok' ? new Date().toISOString() : undefined,
      },
      { onConflict: 'family_id' },
    );
  if (error) throw error;
}

export async function updateSessionStatus(familyId: number, status: PdSessionStatus): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('pd_session')
    .update({ status })
    .eq('family_id', familyId);
  if (error) throw error;
}

export async function logProbe(record: ProbeRecord): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('pd_session_probe').insert(record);
  if (error) throw error;
}

// Supabase JS returns bytea as `\x<hex>` string when read via REST.
function decodeSupabaseBytea(raw: string): Buffer {
  if (raw.startsWith('\\x')) return Buffer.from(raw.slice(2), 'hex');
  return Buffer.from(raw, 'base64');
}
