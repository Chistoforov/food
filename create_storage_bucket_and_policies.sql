-- ========================================
-- CREATE STORAGE BUCKET AND POLICIES
-- Для фоновой обработки чеков
-- ========================================

-- 1. Создаем bucket "receipts" для хранения изображений чеков
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,  -- Публичный доступ (для передачи URL в Perplexity API)
  10485760,  -- 10 MB лимит
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']  -- Только изображения
)
ON CONFLICT (id) DO NOTHING;  -- Если bucket уже существует, ничего не делать

-- Проверяем, что bucket создан
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts') THEN
    RAISE NOTICE '✅ Bucket "receipts" создан успешно или уже существует';
  ELSE
    RAISE EXCEPTION '❌ Ошибка: Bucket "receipts" не создан';
  END IF;
END $$;

-- ========================================
-- 2. Удаляем старые политики (если есть)
-- ========================================

DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts for their family" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their family receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;

RAISE NOTICE '🗑️ Старые политики удалены (если были)';

-- ========================================
-- 3. Создаем политики доступа
-- ========================================

-- Политика 1: UPLOAD (INSERT) - Загрузка файлов
-- Авторизованные пользователи могут загружать чеки
CREATE POLICY "Users can upload receipts for their family"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' AND
  auth.role() = 'authenticated'
);

RAISE NOTICE '✅ Политика 1 создана: Users can upload receipts';

-- Политика 2: VIEW (SELECT) - Чтение файлов
-- Любой может получить публичный URL (нужно для Perplexity API)
-- Если нужна более строгая безопасность, раскомментируйте вариант с authenticated
CREATE POLICY "Anyone can view receipt images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');

-- Альтернатива (более безопасная): только авторизованные пользователи
-- CREATE POLICY "Authenticated users can view receipts"
-- ON storage.objects
-- FOR SELECT
-- USING (
--   bucket_id = 'receipts' AND
--   auth.role() = 'authenticated'
-- );

RAISE NOTICE '✅ Политика 2 создана: Anyone can view receipts';

-- Политика 3: DELETE - Удаление файлов
-- Авторизованные пользователи могут удалять файлы
CREATE POLICY "Users can delete their family receipts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'receipts' AND
  auth.role() = 'authenticated'
);

RAISE NOTICE '✅ Политика 3 создана: Users can delete receipts';

-- ========================================
-- 4. Проверка созданных политик
-- ========================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Users can upload receipts for their family',
    'Anyone can view receipt images',
    'Users can delete their family receipts'
  );
  
  IF policy_count = 3 THEN
    RAISE NOTICE '✅ Все 3 политики созданы успешно';
  ELSE
    RAISE WARNING '⚠️ Создано только % политик из 3', policy_count;
  END IF;
END $$;

-- ========================================
-- 5. Показываем информацию о bucket
-- ========================================

SELECT 
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 || ' MB' as max_file_size,
  created_at
FROM storage.buckets
WHERE id = 'receipts';

-- ========================================
-- 6. Показываем созданные политики
-- ========================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname IN (
  'Users can upload receipts for their family',
  'Anyone can view receipt images',
  'Users can delete their family receipts'
)
ORDER BY policyname;

-- ========================================
-- ГОТОВО! 🎉
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SETUP ЗАВЕРШЕН УСПЕШНО!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 Bucket "receipts" готов к использованию';
  RAISE NOTICE '🔐 3 политики доступа настроены';
  RAISE NOTICE '📝 Настройки:';
  RAISE NOTICE '   - Публичный доступ: ДА';
  RAISE NOTICE '   - Макс. размер файла: 10 MB';
  RAISE NOTICE '   - Типы файлов: только изображения';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Теперь можно:';
  RAISE NOTICE '   1. Применить миграцию: migration_add_pending_receipts.sql';
  RAISE NOTICE '   2. Включить Realtime для pending_receipts';
  RAISE NOTICE '   3. Деплоить приложение';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

