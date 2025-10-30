-- Создание функции recalculate_monthly_stats
-- Выполните этот скрипт в Supabase SQL Editor

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

-- Проверяем, что функция создана
SELECT 
    proname as function_name,
    proargnames as argument_names,
    proargtypes as argument_types
FROM pg_proc 
WHERE proname = 'recalculate_monthly_stats';
