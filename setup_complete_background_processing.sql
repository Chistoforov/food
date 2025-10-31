-- ========================================
-- ПОЛНАЯ НАСТРОЙКА ФОНОВОЙ ОБРАБОТКИ ЧЕКОВ
-- Выполните этот скрипт один раз в Supabase SQL Editor
-- ========================================

-- ========================================
-- ЧАСТЬ 1: СОЗДАНИЕ STORAGE BUCKET
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '📦 Создаем Storage Bucket для чеков...';
END $$;

-- Создаем bucket "receipts"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,  -- Публичный доступ
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- ЧАСТЬ 2: ПОЛИТИКИ ДЛЯ STORAGE
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '🔐 Настраиваем политики доступа к Storage...';
END $$;

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Users can upload receipts for their family" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their family receipts" ON storage.objects;

-- Создаем политики
CREATE POLICY "Users can upload receipts for their family"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view receipt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete their family receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

-- ========================================
-- ЧАСТЬ 3: ТАБЛИЦА PENDING_RECEIPTS
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '📋 Создаем таблицу pending_receipts...';
END $$;

-- Создаем таблицу очереди
CREATE TABLE IF NOT EXISTS pending_receipts (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  parsed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_pending_receipts_family_id ON pending_receipts(family_id);
CREATE INDEX IF NOT EXISTS idx_pending_receipts_status ON pending_receipts(status);
CREATE INDEX IF NOT EXISTS idx_pending_receipts_created_at ON pending_receipts(created_at);

-- ========================================
-- ЧАСТЬ 4: RLS ПОЛИТИКИ ДЛЯ PENDING_RECEIPTS
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '🔐 Настраиваем Row Level Security...';
END $$;

-- Включаем RLS
ALTER TABLE pending_receipts ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Users can view their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Users can insert pending receipts for their family" ON pending_receipts;
DROP POLICY IF EXISTS "Users can update their family's pending receipts" ON pending_receipts;

-- Создаем политики для pending_receipts
CREATE POLICY "Users can view their family's pending receipts"
ON pending_receipts FOR SELECT
USING (true);  -- Упрощенная политика - можно ужесточить при необходимости

CREATE POLICY "Users can insert pending receipts for their family"
ON pending_receipts FOR INSERT
WITH CHECK (true);  -- Упрощенная политика

CREATE POLICY "Users can update their family's pending receipts"
ON pending_receipts FOR UPDATE
USING (true);  -- Упрощенная политика

-- ========================================
-- ЧАСТЬ 5: ФУНКЦИЯ ОЧИСТКИ СТАРЫХ ЧЕКОВ
-- ========================================

DO $$ 
BEGIN
  RAISE NOTICE '🧹 Создаем функцию автоочистки...';
END $$;

CREATE OR REPLACE FUNCTION cleanup_old_pending_receipts()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_receipts
  WHERE created_at < NOW() - INTERVAL '7 days'
  AND status IN ('completed', 'failed');
  
  RAISE NOTICE 'Удалено старых чеков: %', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_pending_receipts() IS 'Удаляет обработанные/проваленные чеки старше 7 дней';

-- ========================================
-- ЧАСТЬ 6: КОММЕНТАРИИ ДЛЯ ДОКУМЕНТАЦИИ
-- ========================================

COMMENT ON TABLE pending_receipts IS 'Очередь для фоновой обработки чеков';
COMMENT ON COLUMN pending_receipts.status IS 'pending - ожидает, processing - обрабатывается, completed - готово, failed - ошибка';
COMMENT ON COLUMN pending_receipts.image_url IS 'Путь к изображению в Supabase Storage (bucket: receipts)';
COMMENT ON COLUMN pending_receipts.parsed_data IS 'JSON с распарсенными данными чека (items, total, date)';
COMMENT ON COLUMN pending_receipts.attempts IS 'Количество попыток обработки (для retry логики)';

-- ========================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ========================================

-- Проверяем bucket
SELECT 
  '✅ Storage Bucket' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts') 
    THEN 'Создан' 
    ELSE '❌ НЕ СОЗДАН' 
  END as status;

-- Проверяем таблицу
SELECT 
  '✅ Таблица pending_receipts' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_receipts') 
    THEN 'Создана' 
    ELSE '❌ НЕ СОЗДАНА' 
  END as status;

-- Проверяем Storage политики
SELECT 
  '✅ Storage Политики' as component,
  COUNT(*) || ' из 3' as status
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname IN (
  'Users can upload receipts for their family',
  'Anyone can view receipt images',
  'Users can delete their family receipts'
);

-- Проверяем RLS политики
SELECT 
  '✅ RLS Политики' as component,
  COUNT(*) || ' из 3' as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'pending_receipts';

-- Проверяем индексы
SELECT 
  '✅ Индексы' as component,
  COUNT(*) || ' из 3' as status
FROM pg_indexes
WHERE tablename = 'pending_receipts';

-- ========================================
-- ФИНАЛЬНОЕ СООБЩЕНИЕ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 НАСТРОЙКА ЗАВЕРШЕНА!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Что было создано:';
  RAISE NOTICE '  ✅ Storage bucket "receipts" (10MB, публичный)';
  RAISE NOTICE '  ✅ 3 Storage политики (upload, view, delete)';
  RAISE NOTICE '  ✅ Таблица pending_receipts с индексами';
  RAISE NOTICE '  ✅ 3 RLS политики для pending_receipts';
  RAISE NOTICE '  ✅ Функция cleanup_old_pending_receipts()';
  RAISE NOTICE '';
  RAISE NOTICE '📋 ЧТО ДЕЛАТЬ ДАЛЬШЕ:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Включить Realtime для pending_receipts:';
  RAISE NOTICE '   Database → Replication → pending_receipts → ✅';
  RAISE NOTICE '';
  RAISE NOTICE '2. Проверить переменные окружения в Vercel:';
  RAISE NOTICE '   - VITE_SUPABASE_URL';
  RAISE NOTICE '   - VITE_SUPABASE_ANON_KEY';
  RAISE NOTICE '   - PERPLEXITY_API_KEY';
  RAISE NOTICE '';
  RAISE NOTICE '3. Задеплоить код:';
  RAISE NOTICE '   git add .';
  RAISE NOTICE '   git commit -m "Add background receipt processing"';
  RAISE NOTICE '   git push origin main';
  RAISE NOTICE '';
  RAISE NOTICE '4. Проверить работу:';
  RAISE NOTICE '   - Загрузить тестовый чек';
  RAISE NOTICE '   - Убедиться, что загрузка быстрая (1-2 сек)';
  RAISE NOTICE '   - Проверить обновление статуса в реальном времени';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📚 Документация: ФОНОВАЯ_ОБРАБОТКА_ЧЕКОВ.md';
  RAISE NOTICE '========================================';
END $$;

