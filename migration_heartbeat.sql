-- ============================================================================
-- Migration: Heartbeat (keepalive для Supabase free tier)
-- Дата: 2026-08-29
-- Контекст: free tier паузит проект после 7 дней отсутствия активности.
-- Отдельная таблица + cron `api/cron/keepalive.js` каждые 5 дней делают upsert
-- одной строки (id=1), чтобы гарантированно был write.
-- Идемпотентно.
-- ============================================================================

CREATE TABLE IF NOT EXISTS heartbeat (
  id         INTEGER PRIMARY KEY,
  pinged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO heartbeat (id, pinged_at) VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;
