-- Скрипт для проверки и очистки полуобработанных чеков
-- Используется для диагностики проблем после ошибок загрузки

-- 1. Проверить текущий тип поля quantity
SELECT 
    table_name,
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'product_history' 
AND column_name = 'quantity';

-- Если data_type = 'integer', нужно применить миграцию из apply_quantity_fix.sql
-- Если data_type = 'numeric', всё в порядке

-- 2. Найти чеки со статусом "processed", но без связанных товаров
-- (это чеки, которые создались, но товары не добавились из-за ошибки)
SELECT 
    r.id,
    r.date,
    r.items_count,
    r.total_amount,
    r.status,
    COUNT(ph.id) as actual_items
FROM receipts r
LEFT JOIN product_history ph ON r.id = ph.receipt_id
WHERE r.family_id = 1
GROUP BY r.id, r.date, r.items_count, r.total_amount, r.status
HAVING COUNT(ph.id) = 0 OR COUNT(ph.id) < r.items_count
ORDER BY r.created_at DESC;

-- Если найдены чеки с несоответствием (actual_items = 0 или меньше items_count),
-- их можно удалить через интерфейс приложения

-- 3. Проверить последние 10 чеков и их товары
SELECT 
    r.id as receipt_id,
    r.date,
    r.items_count,
    r.total_amount,
    COUNT(ph.id) as products_added,
    ARRAY_AGG(p.name) as product_names
FROM receipts r
LEFT JOIN product_history ph ON r.id = ph.receipt_id
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1
GROUP BY r.id, r.date, r.items_count, r.total_amount
ORDER BY r.created_at DESC
LIMIT 10;

-- 4. Проверить последние записи в product_history с дробными количествами
SELECT 
    ph.id,
    ph.date,
    ph.quantity,
    ph.price,
    ph.unit_price,
    p.name as product_name,
    r.id as receipt_id,
    r.date as receipt_date
FROM product_history ph
JOIN products p ON ph.product_id = p.id
LEFT JOIN receipts r ON ph.receipt_id = r.id
WHERE ph.family_id = 1
AND ph.quantity <> FLOOR(ph.quantity)  -- Только дробные количества
ORDER BY ph.created_at DESC
LIMIT 20;

-- 5. Проверить статистику по всем чекам
SELECT 
    COUNT(*) as total_receipts,
    SUM(items_count) as expected_items,
    (SELECT COUNT(*) FROM product_history WHERE family_id = 1) as actual_items,
    SUM(total_amount) as total_spent
FROM receipts 
WHERE family_id = 1;

-- Если expected_items значительно больше actual_items,
-- значит были ошибки при обработке чеков

-- 6. ОПЦИОНАЛЬНОЕ ДЕЙСТВИЕ: Удалить проблемные чеки
-- ВНИМАНИЕ: Используйте только если точно знаете, какие чеки нужно удалить
-- Замените 123 на ID проблемного чека из запроса #2
-- DELETE FROM receipts WHERE id = 123;

-- После удаления проблемных чеков:
-- - Загрузите чеки заново через интерфейс приложения
-- - Нажмите кнопку "Обновить" статистику на главной странице

