// Keepalive для Supabase free tier: пишет одну строку в таблицу `heartbeat`
// каждые 5 дней, чтобы проект не ушёл в паузу после 7 дней inactivity.
// Миграция: migration_heartbeat.sql
// Vercel Cron: 0 6 */5 * * (каждые 5 дней в 06:00 UTC).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE env' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await supabase
    .from('heartbeat')
    .upsert({ id: 1, pinged_at: new Date().toISOString() }, { onConflict: 'id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, pinged_at: new Date().toISOString() });
}
