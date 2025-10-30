-- Удаление оставшегося триггера recalculate_stats_on_history_delete_trigger
-- Выполните этот скрипт в Supabase SQL Editor

-- Удаляем проблемный триггер
DROP TRIGGER IF EXISTS recalculate_stats_on_history_delete_trigger ON product_history;

-- Проверяем, что триггер удален
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table IN ('receipts', 'product_history', 'products', 'families', 'monthly_stats')
ORDER BY event_object_table, trigger_name;
