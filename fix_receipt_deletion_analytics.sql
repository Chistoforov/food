-- Исправление пересчета аналитики при удалении чеков
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Сначала убедимся, что функция recalculate_monthly_stats существует
CREATE OR REPLACE FUNCTION recalculate_monthly_stats(p_family_id INTEGER, p_month VARCHAR(10), p_year INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total_spent DECIMAL(10,2) := 0;
    v_total_calories INTEGER := 0;
    v_avg_calories_per_day INTEGER := 0;
    v_receipts_count INTEGER := 0;
    v_days_in_month INTEGER;
BEGIN
    -- Получаем количество дней в месяце
    v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', (p_year || '-' || LPAD(p_month, 2, '0') || '-01')::DATE) + INTERVAL '1 month - 1 day'));
    
    -- Вычисляем общую сумму потраченную в месяце
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_spent
    FROM receipts
    WHERE family_id = p_family_id
        AND EXTRACT(YEAR FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = LPAD(p_month, 2, '0')::INTEGER;
    
    -- Вычисляем общее количество калорий
    SELECT COALESCE(SUM(ph.quantity * p.calories), 0)
    INTO v_total_calories
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE ph.family_id = p_family_id
        AND EXTRACT(YEAR FROM ph.date) = p_year
        AND EXTRACT(MONTH FROM ph.date) = LPAD(p_month, 2, '0')::INTEGER;
    
    -- Вычисляем среднее количество калорий в день
    v_avg_calories_per_day := ROUND(v_total_calories / v_days_in_month);
    
    -- Вычисляем количество чеков
    SELECT COUNT(*)
    INTO v_receipts_count
    FROM receipts
    WHERE family_id = p_family_id
        AND EXTRACT(YEAR FROM date) = p_year
        AND EXTRACT(MONTH FROM date) = LPAD(p_month, 2, '0')::INTEGER;
    
    -- Обновляем или создаем запись статистики
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    VALUES (p_family_id, p_year || '-' || p_month, p_year, v_total_spent, v_total_calories, v_avg_calories_per_day, v_receipts_count)
    ON CONFLICT (family_id, month, year)
    DO UPDATE SET
        total_spent = EXCLUDED.total_spent,
        total_calories = EXCLUDED.total_calories,
        avg_calories_per_day = EXCLUDED.avg_calories_per_day,
        receipts_count = EXCLUDED.receipts_count,
        updated_at = NOW();
END;
$$ language 'plpgsql';

-- 2. Удаляем старые триггеры (если есть)
DROP TRIGGER IF EXISTS recalculate_stats_on_history_delete_trigger ON product_history;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_delete ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_insert ON receipts;
DROP TRIGGER IF EXISTS trigger_recalculate_stats_on_receipt_update ON receipts;

-- 3. Создаем функцию для пересчета статистики при удалении записей из product_history
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
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. Создаем функцию для пересчета статистики при удалении чеков
CREATE OR REPLACE FUNCTION recalculate_stats_on_receipt_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
BEGIN
    v_family_id := OLD.family_id;
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца удаленного чека
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. Создаем триггер для пересчета статистики при удалении записей из product_history
CREATE TRIGGER recalculate_stats_on_history_delete_trigger
    AFTER DELETE ON product_history
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_history_delete();

-- 6. Создаем триггер для пересчета статистики при удалении чеков
CREATE TRIGGER recalculate_stats_on_receipt_delete_trigger
    AFTER DELETE ON receipts
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_receipt_delete();

-- 7. Добавляем комментарии
COMMENT ON FUNCTION recalculate_monthly_stats(INTEGER, VARCHAR(10), INTEGER) IS 'Пересчитывает месячную статистику для указанной семьи, месяца и года';
COMMENT ON FUNCTION recalculate_stats_on_history_delete() IS 'Пересчитывает статистику при удалении записей из product_history';
COMMENT ON FUNCTION recalculate_stats_on_receipt_delete() IS 'Пересчитывает статистику при удалении чеков';
COMMENT ON TRIGGER recalculate_stats_on_history_delete_trigger ON product_history IS 'Автоматически пересчитывает месячную статистику при удалении покупок';
COMMENT ON TRIGGER recalculate_stats_on_receipt_delete_trigger ON receipts IS 'Автоматически пересчитывает месячную статистику при удалении чеков';

-- 8. Проверяем, что все создано корректно
SELECT 'Функции и триггеры для пересчета аналитики при удалении чеков созданы успешно!' as status;
