-- Удаление ВСЕХ триггеров, связанных с пересчетом статистики
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Сначала посмотрим, какие триггеры есть
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
    AND event_object_table IN ('receipts', 'product_history', 'products', 'families', 'monthly_stats')
ORDER BY event_object_table, trigger_name;

-- 2. Удаляем ВСЕ возможные триггеры
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_delete ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_insert ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_update ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_insert_update ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_delete_update ON receipts;

DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_delete ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_insert ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_update ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_insert_update ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_delete_update ON product_history;

DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_product_delete ON products;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_product_insert ON products;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_product_update ON products;

DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_family_delete ON families;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_family_insert ON families;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_family_update ON families;

-- 3. Удаляем функцию recalculate_monthly_stats (если есть)
DROP FUNCTION IF EXISTS recalculate_monthly_stats(INTEGER, VARCHAR(10), INTEGER);
DROP FUNCTION IF EXISTS recalculate_monthly_stats(INTEGER, TEXT, INTEGER);

-- 4. Проверяем, что триггеры удалены
SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
    AND event_object_table IN ('receipts', 'product_history', 'products', 'families', 'monthly_stats')
ORDER BY event_object_table, trigger_name;
