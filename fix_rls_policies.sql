-- ИСПРАВЛЕНИЕ ПРОБЛЕМЫ УДАЛЕНИЯ ЧЕКОВ
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Включаем RLS для всех таблиц
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем все существующие политики (если есть)
DROP POLICY IF EXISTS "Allow all operations on receipts" ON receipts;
DROP POLICY IF EXISTS "Allow all operations on product_history" ON product_history;
DROP POLICY IF EXISTS "Allow all operations on products" ON products;
DROP POLICY IF EXISTS "Allow all operations on families" ON families;
DROP POLICY IF EXISTS "Allow all operations on monthly_stats" ON monthly_stats;

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Allow read access to all receipts" ON receipts;
DROP POLICY IF EXISTS "Allow insert access to receipts" ON receipts;
DROP POLICY IF EXISTS "Allow update access to receipts" ON receipts;
DROP POLICY IF EXISTS "Allow delete access to receipts" ON receipts;

DROP POLICY IF EXISTS "Allow read access to all product history" ON product_history;
DROP POLICY IF EXISTS "Allow insert access to product history" ON product_history;
DROP POLICY IF EXISTS "Allow update access to product history" ON product_history;
DROP POLICY IF EXISTS "Allow delete access to product history" ON product_history;

DROP POLICY IF EXISTS "Allow read access to all products" ON products;
DROP POLICY IF EXISTS "Allow insert access to products" ON products;
DROP POLICY IF EXISTS "Allow update access to products" ON products;
DROP POLICY IF EXISTS "Allow delete access to products" ON products;

DROP POLICY IF EXISTS "Allow read access to all families" ON families;
DROP POLICY IF EXISTS "Allow insert access to families" ON families;
DROP POLICY IF EXISTS "Allow update access to families" ON families;
DROP POLICY IF EXISTS "Allow delete access to families" ON families;

DROP POLICY IF EXISTS "Allow read access to all monthly stats" ON monthly_stats;
DROP POLICY IF EXISTS "Allow insert access to monthly stats" ON monthly_stats;
DROP POLICY IF EXISTS "Allow update access to monthly stats" ON monthly_stats;
DROP POLICY IF EXISTS "Allow delete access to monthly stats" ON monthly_stats;

-- 3. Создаем новые простые политики
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);
CREATE POLICY "Allow all operations on products" ON products USING (true);
CREATE POLICY "Allow all operations on families" ON families USING (true);
CREATE POLICY "Allow all operations on monthly_stats" ON monthly_stats USING (true);

-- 4. Проверяем результат
SELECT 
    'receipts' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'receipts'

UNION ALL

SELECT 
    'product_history' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'product_history'

UNION ALL

SELECT 
    'products' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'products'

UNION ALL

SELECT 
    'families' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'families'

UNION ALL

SELECT 
    'monthly_stats' as table_name,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'monthly_stats';

-- 5. Проверяем политики
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('receipts', 'product_history', 'products', 'families', 'monthly_stats')
ORDER BY tablename, policyname;
