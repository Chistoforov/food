-- =============================================
-- СКРИПТ ДЛЯ ВКЛЮЧЕНИЯ REALTIME ДЛЯ PENDING_RECEIPTS
-- =============================================

-- Шаг 1: Проверяем текущий статус Realtime
SELECT 
  'Текущие таблицы с Realtime:' as status,
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Шаг 2: Включаем Realtime для pending_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE pending_receipts;

-- Шаг 3: Проверяем что Realtime включен
SELECT 
  'После включения:' as status,
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'pending_receipts';

-- Шаг 4: Проверяем RLS политики
SELECT 
  'RLS политики для pending_receipts:' as status,
  policyname, 
  cmd as command,
  permissive
FROM pg_policies
WHERE tablename = 'pending_receipts';

-- =============================================
-- РЕЗУЛЬТАТ
-- =============================================
-- Если в последнем запросе вы видите:
-- schemaname | tablename
-- -----------+------------------
-- public     | pending_receipts
--
-- Значит Realtime успешно включен! ✅
-- =============================================

