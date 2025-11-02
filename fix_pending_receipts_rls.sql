-- Исправление RLS политик для таблицы pending_receipts
-- Проблема: некорректные условия в политиках блокируют вставку данных

-- Удаляем ВСЕ существующие политики (старые и новые)
DROP POLICY IF EXISTS "Users can view their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Users can insert pending receipts for their family" ON pending_receipts;
DROP POLICY IF EXISTS "Users can update their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow read access to all pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow insert access to pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow update access to pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Allow delete access to pending receipts" ON pending_receipts;

-- Создаем правильные политики (как в других таблицах)

-- Разрешаем чтение всех pending_receipts
CREATE POLICY "Allow read access to all pending receipts" ON pending_receipts
    FOR SELECT
    USING (true);

-- Разрешаем вставку новых pending_receipts
CREATE POLICY "Allow insert access to pending receipts" ON pending_receipts
    FOR INSERT
    WITH CHECK (true);

-- Разрешаем обновление pending_receipts
CREATE POLICY "Allow update access to pending receipts" ON pending_receipts
    FOR UPDATE
    USING (true);

-- Разрешаем удаление pending_receipts
CREATE POLICY "Allow delete access to pending receipts" ON pending_receipts
    FOR DELETE
    USING (true);

-- Проверка: просмотр созданных политик
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'pending_receipts'
ORDER BY policyname;

