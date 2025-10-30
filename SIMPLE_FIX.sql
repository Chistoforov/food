-- ПРОСТОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМЫ УДАЛЕНИЯ ЧЕКОВ
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

-- 3. Создаем новые политики
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);
CREATE POLICY "Allow all operations on products" ON products USING (true);
CREATE POLICY "Allow all operations on families" ON families USING (true);
CREATE POLICY "Allow all operations on monthly_stats" ON monthly_stats USING (true);

-- 4. Добавляем поле receipt_id (если еще нет)
ALTER TABLE product_history 
ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE;

-- 5. Создаем индекс
CREATE INDEX IF NOT EXISTS idx_product_history_receipt_id ON product_history(receipt_id);

-- 6. Проверяем результат
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
WHERE schemaname = 'public' AND tablename = 'product_history';

-- 7. Проверяем политики
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('receipts', 'product_history')
ORDER BY tablename, policyname;
