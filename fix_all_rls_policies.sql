-- ========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ RLS ПОЛИТИК
-- Исправляет Storage bucket + pending_receipts
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Начинаем исправление RLS политик...';
  RAISE NOTICE '';
END $$;

-- ========================================
-- ЧАСТЬ 1: ИСПРАВЛЕНИЕ STORAGE BUCKET
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '📦 Шаг 1/2: Исправляем политики Storage bucket...';
END $$;

-- Удаляем ВСЕ старые политики storage для receipts
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts for their family" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their family receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow read access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access to receipts" ON storage.objects;

-- Создаем простые политики БЕЗ проверки auth.role()

CREATE POLICY "Allow insert access to receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow read access to receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Allow delete access to receipts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'receipts');

CREATE POLICY "Allow update access to receipts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'receipts');

DO $$ 
BEGIN
  RAISE NOTICE '✅ Storage политики исправлены';
END $$;

-- ========================================
-- ЧАСТЬ 2: ИСПРАВЛЕНИЕ PENDING_RECEIPTS
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '📋 Шаг 2/2: Исправляем политики pending_receipts...';
END $$;

-- Удаляем ВСЕ старые политики pending_receipts
DROP POLICY IF EXISTS "Users can view their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Users can insert pending receipts for their family" ON pending_receipts;
DROP POLICY IF EXISTS "Users can update their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow read access to all pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow insert access to pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow update access to pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow delete access to pending receipts" ON pending_receipts;

-- Создаем правильные политики

CREATE POLICY "Allow read access to all pending receipts" ON pending_receipts
    FOR SELECT
    USING (true);

CREATE POLICY "Allow insert access to pending receipts" ON pending_receipts
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update access to pending receipts" ON pending_receipts
    FOR UPDATE
    USING (true);

CREATE POLICY "Allow delete access to pending receipts" ON pending_receipts
    FOR DELETE
    USING (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Pending receipts политики исправлены';
END $$;

-- ========================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Проверяем результаты...';
  RAISE NOTICE '';
END $$;

-- Проверка Storage политик
DO $$
DECLARE
  storage_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO storage_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%receipts%';
  
  RAISE NOTICE '📦 Storage политик для receipts: %', storage_policy_count;
  
  IF storage_policy_count >= 3 THEN
    RAISE NOTICE '✅ Storage политики в порядке';
  ELSE
    RAISE WARNING '⚠️ Недостаточно Storage политик (найдено %, ожидается 3+)', storage_policy_count;
  END IF;
END $$;

-- Проверка pending_receipts политик
DO $$
DECLARE
  pending_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_policy_count
  FROM pg_policies
  WHERE tablename = 'pending_receipts';
  
  RAISE NOTICE '📋 Pending_receipts политик: %', pending_policy_count;
  
  IF pending_policy_count = 4 THEN
    RAISE NOTICE '✅ Pending_receipts политики в порядке';
  ELSE
    RAISE WARNING '⚠️ Неправильное количество pending_receipts политик (найдено %, ожидается 4)', pending_policy_count;
  END IF;
END $$;

-- ========================================
-- ИТОГОВАЯ ИНФОРМАЦИЯ
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Что было исправлено:';
  RAISE NOTICE '   1. Storage bucket политики (убрали auth.role())';
  RAISE NOTICE '   2. Pending_receipts политики (убрали циклические ссылки)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Что делать дальше:';
  RAISE NOTICE '   1. Обновите страницу приложения (Ctrl+F5)';
  RAISE NOTICE '   2. Попробуйте загрузить чек снова';
  RAISE NOTICE '   3. Проверьте консоль браузера на ошибки';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- Показываем созданные Storage политики
SELECT 
  '=== STORAGE POLICIES ===' as info,
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%receipts%'
ORDER BY policyname;

-- Показываем созданные pending_receipts политики
SELECT 
  '=== PENDING_RECEIPTS POLICIES ===' as info,
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'pending_receipts'
ORDER BY policyname;

