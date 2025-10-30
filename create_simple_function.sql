-- Упрощенная функция recalculate_monthly_stats
-- Выполните этот скрипт в Supabase SQL Editor

-- Сначала удаляем старую функцию (если есть)
DROP FUNCTION IF EXISTS recalculate_monthly_stats(INTEGER, VARCHAR(10), INTEGER);

-- Создаем новую упрощенную функцию
CREATE OR REPLACE FUNCTION recalculate_monthly_stats(p_family_id INTEGER, p_month VARCHAR(10), p_year INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total_spent DECIMAL(10,2) := 0;
    v_total_calories INTEGER := 0;
    v_avg_calories_per_day INTEGER := 0;
    v_receipts_count INTEGER := 0;
    v_days_in_month INTEGER;
    v_month_int INTEGER;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Преобразуем месяц в число
    v_month_int := p_month::INTEGER;
    
    -- Создаем даты начала и конца месяца
    v_start_date := (p_year || '-' || LPAD(v_month_int::TEXT, 2, '0') || '-01')::DATE;
    v_end_date := (v_start_date + INTERVAL '1 month')::DATE;
    
    -- Получаем количество дней в месяце
    v_days_in_month := EXTRACT(DAY FROM (v_end_date - INTERVAL '1 day'));
    
    -- Вычисляем общую сумму потраченную в месяце
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_spent
    FROM receipts
    WHERE family_id = p_family_id
        AND date >= v_start_date
        AND date < v_end_date;
    
    -- Вычисляем общее количество калорий
    SELECT COALESCE(SUM(ph.quantity * p.calories), 0)
    INTO v_total_calories
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE ph.family_id = p_family_id
        AND ph.date >= v_start_date
        AND ph.date < v_end_date;
    
    -- Вычисляем среднее количество калорий в день
    IF v_days_in_month > 0 THEN
        v_avg_calories_per_day := ROUND(v_total_calories / v_days_in_month);
    ELSE
        v_avg_calories_per_day := 0;
    END IF;
    
    -- Вычисляем количество чеков
    SELECT COUNT(*)
    INTO v_receipts_count
    FROM receipts
    WHERE family_id = p_family_id
        AND date >= v_start_date
        AND date < v_end_date;
    
    -- Обновляем или создаем запись статистики
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    VALUES (p_family_id, p_year || '-' || LPAD(v_month_int::TEXT, 2, '0'), p_year, v_total_spent, v_total_calories, v_avg_calories_per_day, v_receipts_count)
    ON CONFLICT (family_id, month, year)
    DO UPDATE SET
        total_spent = EXCLUDED.total_spent,
        total_calories = EXCLUDED.total_calories,
        avg_calories_per_day = EXCLUDED.avg_calories_per_day,
        receipts_count = EXCLUDED.receipts_count,
        updated_at = NOW();
END;
$$ language 'plpgsql';

-- Проверяем, что функция создана
SELECT 
    proname as function_name,
    proargnames as argument_names
FROM pg_proc 
WHERE proname = 'recalculate_monthly_stats';
