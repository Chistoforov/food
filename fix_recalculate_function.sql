-- Исправленная функция пересчета месячной статистики
-- Заменяет существующую функцию recalculate_monthly_stats

CREATE OR REPLACE FUNCTION recalculate_monthly_stats(p_family_id INTEGER, p_month VARCHAR(10), p_year INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total_spent DECIMAL(10,2) := 0;
    v_total_calories INTEGER := 0;
    v_avg_calories_per_day INTEGER := 0;
    v_receipts_count INTEGER := 0;
    v_days_in_month INTEGER;
    v_month_key VARCHAR(10);
BEGIN
    -- Формируем ключ месяца
    v_month_key := p_year || '-' || LPAD(p_month, 2, '0');
    
    -- Получаем количество дней в месяце
    v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', (p_year || '-' || p_month || '-01')::DATE) + INTERVAL '1 month - 1 day'));
    
    -- Вычисляем общую сумму потраченную в месяце
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_spent
    FROM receipts 
    WHERE family_id = p_family_id 
    AND EXTRACT(YEAR FROM date) = p_year 
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Вычисляем общее количество калорий в месяце
    SELECT COALESCE(SUM(p.calories * ph.quantity), 0)
    INTO v_total_calories
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE ph.family_id = p_family_id 
    AND EXTRACT(YEAR FROM ph.date) = p_year 
    AND EXTRACT(MONTH FROM ph.date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Вычисляем среднее количество калорий в день
    v_avg_calories_per_day := CASE 
        WHEN v_days_in_month > 0 THEN v_total_calories / v_days_in_month 
        ELSE 0 
    END;
    
    -- Подсчитываем количество чеков
    SELECT COUNT(*)
    INTO v_receipts_count
    FROM receipts 
    WHERE family_id = p_family_id 
    AND EXTRACT(YEAR FROM date) = p_year 
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Обновляем или создаем запись статистики
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    VALUES (p_family_id, v_month_key, p_year, v_total_spent, v_total_calories, v_avg_calories_per_day, v_receipts_count)
    ON CONFLICT (family_id, month, year) 
    DO UPDATE SET 
        total_spent = EXCLUDED.total_spent,
        total_calories = EXCLUDED.total_calories,
        avg_calories_per_day = EXCLUDED.avg_calories_per_day,
        receipts_count = EXCLUDED.receipts_count,
        updated_at = NOW();
        
    -- Логируем результат
    RAISE NOTICE 'Статистика для %: потрачено=%, калории=%, чеков=%', 
        v_month_key, v_total_spent, v_total_calories, v_receipts_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для пересчета всех месяцев с чеками
CREATE OR REPLACE FUNCTION recalculate_all_months_with_receipts(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
    receipt_record RECORD;
    v_year INTEGER;
    v_month VARCHAR(2);
    processed_months TEXT[] := '{}';
BEGIN
    -- Проходим по всем чекам и собираем уникальные месяцы
    FOR receipt_record IN 
        SELECT DISTINCT 
            EXTRACT(YEAR FROM date)::INTEGER as year,
            LPAD(EXTRACT(MONTH FROM date)::TEXT, 2, '0') as month
        FROM receipts 
        WHERE family_id = p_family_id
        ORDER BY year DESC, month DESC
    LOOP
        v_year := receipt_record.year;
        v_month := receipt_record.month;
        
        -- Проверяем, не обрабатывали ли мы уже этот месяц
        IF NOT (v_year || '-' || v_month = ANY(processed_months)) THEN
            -- Пересчитываем статистику для этого месяца
            PERFORM recalculate_monthly_stats(p_family_id, v_month, v_year);
            
            -- Добавляем месяц в список обработанных
            processed_months := array_append(processed_months, v_year || '-' || v_month);
            
            RAISE NOTICE 'Обработан месяц: %-%', v_year, v_month;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Всего обработано месяцев: %', array_length(processed_months, 1);
END;
$$ LANGUAGE plpgsql;

-- Тестируем функции
SELECT 'Функции пересчета статистики обновлены!' as status;

-- Пересчитываем все месяцы с чеками для семьи 1
SELECT recalculate_all_months_with_receipts(1);

-- Показываем результат
SELECT * FROM monthly_stats WHERE family_id = 1 ORDER BY year DESC, month DESC;
