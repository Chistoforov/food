-- Отключение триггера пересчета статистики
-- Выполните этот скрипт в Supabase SQL Editor

-- Отключаем триггер, который вызывает recalculate_monthly_stats
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_delete ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_insert ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_update ON receipts;

-- Отключаем триггеры для product_history
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_delete ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_insert ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_history_update ON product_history;

-- Проверяем, что триггеры отключены
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
    AND event_object_table IN ('receipts', 'product_history')
ORDER BY event_object_table, trigger_name;
