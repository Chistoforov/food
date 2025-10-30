-- Настройка Row Level Security (RLS) политик для всех таблиц
-- Эти политики необходимы для работы с Supabase

-- ============================================
-- ВАЖНО: Выполните этот скрипт в SQL Editor 
-- вашего проекта Supabase
-- ============================================

-- Включаем RLS для всех таблиц
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Политики для таблицы families
-- ============================================

-- Разрешить чтение всех семей
CREATE POLICY "Allow read access to all families" ON families
    FOR SELECT
    USING (true);

-- Разрешить вставку новых семей
CREATE POLICY "Allow insert access to families" ON families
    FOR INSERT
    WITH CHECK (true);

-- Разрешить обновление семей
CREATE POLICY "Allow update access to families" ON families
    FOR UPDATE
    USING (true);

-- Разрешить удаление семей
CREATE POLICY "Allow delete access to families" ON families
    FOR DELETE
    USING (true);

-- ============================================
-- Политики для таблицы products
-- ============================================

-- Разрешить чтение всех продуктов
CREATE POLICY "Allow read access to all products" ON products
    FOR SELECT
    USING (true);

-- Разрешить вставку новых продуктов
CREATE POLICY "Allow insert access to products" ON products
    FOR INSERT
    WITH CHECK (true);

-- Разрешить обновление продуктов
CREATE POLICY "Allow update access to products" ON products
    FOR UPDATE
    USING (true);

-- Разрешить удаление продуктов
CREATE POLICY "Allow delete access to products" ON products
    FOR DELETE
    USING (true);

-- ============================================
-- Политики для таблицы receipts
-- ============================================

-- Разрешить чтение всех чеков
CREATE POLICY "Allow read access to all receipts" ON receipts
    FOR SELECT
    USING (true);

-- Разрешить вставку новых чеков
CREATE POLICY "Allow insert access to receipts" ON receipts
    FOR INSERT
    WITH CHECK (true);

-- Разрешить обновление чеков
CREATE POLICY "Allow update access to receipts" ON receipts
    FOR UPDATE
    USING (true);

-- Разрешить удаление чеков
CREATE POLICY "Allow delete access to receipts" ON receipts
    FOR DELETE
    USING (true);

-- ============================================
-- Политики для таблицы product_history
-- ============================================

-- Разрешить чтение всей истории продуктов
CREATE POLICY "Allow read access to all product history" ON product_history
    FOR SELECT
    USING (true);

-- Разрешить вставку новой истории
CREATE POLICY "Allow insert access to product history" ON product_history
    FOR INSERT
    WITH CHECK (true);

-- Разрешить обновление истории
CREATE POLICY "Allow update access to product history" ON product_history
    FOR UPDATE
    USING (true);

-- Разрешить удаление истории
CREATE POLICY "Allow delete access to product history" ON product_history
    FOR DELETE
    USING (true);

-- ============================================
-- Политики для таблицы monthly_stats
-- ============================================

-- Разрешить чтение всей статистики
CREATE POLICY "Allow read access to all monthly stats" ON monthly_stats
    FOR SELECT
    USING (true);

-- Разрешить вставку новой статистики
CREATE POLICY "Allow insert access to monthly stats" ON monthly_stats
    FOR INSERT
    WITH CHECK (true);

-- Разрешить обновление статистики
CREATE POLICY "Allow update access to monthly stats" ON monthly_stats
    FOR UPDATE
    USING (true);

-- Разрешить удаление статистики
CREATE POLICY "Allow delete access to monthly stats" ON monthly_stats
    FOR DELETE
    USING (true);

-- ============================================
-- Проверка успешности применения политик
-- ============================================

-- Проверяем, что RLS включен
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('families', 'products', 'receipts', 'product_history', 'monthly_stats');

-- Проверяем созданные политики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

