-- Исправление триггера удаления чеков
-- Проблема: в функцию recalculate_monthly_stats передается неправильный формат месяца
-- Было: v_year || '-' || v_month (например "2025-10")
-- Должно быть: v_month (например "10")

-- 1. Исправляем функцию для пересчета статистики после удаления чека
CREATE OR REPLACE FUNCTION recalculate_stats_after_receipt_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month VARCHAR(10);
BEGIN
    -- Получаем год и месяц удаленного чека
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца удаленного чека
    -- ИСПРАВЛЕНО: передаем v_month вместо v_year || '-' || v_month
    PERFORM recalculate_monthly_stats(OLD.family_id, v_month, v_year);
    
    RAISE NOTICE 'Пересчитана статистика за %-% после удаления чека #%', v_year, v_month, OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Исправляем функцию для пересчета статистики после удаления истории покупок
CREATE OR REPLACE FUNCTION recalculate_stats_on_history_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
BEGIN
    v_family_id := OLD.family_id;
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца удаленной покупки
    -- ИСПРАВЛЕНО: передаем v_month вместо v_year || '-' || v_month
    PERFORM recalculate_monthly_stats(v_family_id, v_month, v_year);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Проверяем, что триггеры существуют
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'recalculate_stats_on_receipt_delete') THEN
        RAISE NOTICE '✅ Триггер recalculate_stats_on_receipt_delete существует';
    ELSE
        RAISE NOTICE '❌ Триггер recalculate_stats_on_receipt_delete НЕ найден';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cleanup_products_after_history_delete') THEN
        RAISE NOTICE '✅ Триггер cleanup_products_after_history_delete существует';
    ELSE
        RAISE NOTICE '❌ Триггер cleanup_products_after_history_delete НЕ найден';
    END IF;
END $$;

-- Успешное завершение
DO $$
BEGIN
    RAISE NOTICE '✅ Исправление применено!';
    RAISE NOTICE '📝 Теперь при удалении чека функция recalculate_monthly_stats будет получать правильный формат месяца';
END $$;

