-- ========================================
-- ИСПРАВЛЕНИЕ ПОЛИТИК STORAGE BUCKET
-- Проблема: "new row violates row-level security policy"
-- Причина: политика требует auth.role() = 'authenticated'
-- ========================================

-- Удаляем ВСЕ существующие политики storage для receipts
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

-- Создаем простые политики без проверки auth.role()

-- Политика 1: Загрузка изображений
CREATE POLICY "Allow insert access to receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Политика 2: Чтение изображений (публичный доступ для Perplexity API)
CREATE POLICY "Allow read access to receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');

-- Политика 3: Удаление изображений
CREATE POLICY "Allow delete access to receipts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'receipts');

-- Политика 4: Обновление изображений
CREATE POLICY "Allow update access to receipts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'receipts');

-- ========================================
-- ПРОВЕРКА
-- ========================================

-- Показываем созданные политики
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%receipts%'
ORDER BY policyname;

-- Проверяем bucket
SELECT 
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 || ' MB' as max_file_size
FROM storage.buckets
WHERE id = 'receipts';

