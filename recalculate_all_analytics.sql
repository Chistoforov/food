-- Функция для полного пересчета всей аналитики
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Создаем функцию для полного пересчета аналитики семьи
CREATE OR REPLACE FUNCTION recalculate_family_analytics(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_year INTEGER;
    v_month VARCHAR(10);
    v_current_date DATE;
BEGIN
    -- Получаем текущую дату
    v_current_date := CURRENT_DATE;
    v_year := EXTRACT(YEAR FROM v_current_date);
    v_month := LPAD(EXTRACT(MONTH FROM v_current_date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для всех месяцев, где есть данные
    FOR v_year, v_month IN 
        SELECT DISTINCT 
            EXTRACT(YEAR FROM date)::INTEGER,
            LPAD(EXTRACT(MONTH FROM date)::TEXT, 2, '0')
        FROM receipts 
        WHERE family_id = p_family_id
        UNION
        SELECT DISTINCT 
            EXTRACT(YEAR FROM date)::INTEGER,
            LPAD(EXTRACT(MONTH FROM date)::TEXT, 2, '0')
        FROM product_history 
        WHERE family_id = p_family_id
    LOOP
        PERFORM recalculate_monthly_stats(p_family_id, v_year || '-' || v_month, v_year);
    END LOOP;
    
    -- Пересчитываем статистику для текущего месяца
    PERFORM recalculate_monthly_stats(p_family_id, v_year || '-' || v_month, v_year);
END;
$$ LANGUAGE plpgsql;

-- 2. Создаем функцию для полного пересчета аналитики всех семей
CREATE OR REPLACE FUNCTION recalculate_all_analytics()
RETURNS VOID AS $$
DECLARE
    v_family_id INTEGER;
BEGIN
    -- Пересчитываем аналитику для всех активных семей
    FOR v_family_id IN 
        SELECT id FROM families WHERE is_active = true
    LOOP
        PERFORM recalculate_family_analytics(v_family_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Добавляем комментарии
COMMENT ON FUNCTION recalculate_family_analytics(INTEGER) IS 'Пересчитывает всю аналитику для указанной семьи';
COMMENT ON FUNCTION recalculate_all_analytics() IS 'Пересчитывает всю аналитику для всех активных семей';

-- 4. Проверяем, что функции созданы
SELECT 'Функции для полного пересчета аналитики созданы успешно!' as status;
