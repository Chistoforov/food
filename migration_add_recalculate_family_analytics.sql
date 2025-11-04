-- Функция для пересчета всей аналитики семьи
-- Пересчитывает статистику продуктов и месячную статистику для всех месяцев с покупками

CREATE OR REPLACE FUNCTION recalculate_family_analytics(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_product_record RECORD;
    v_month_record RECORD;
BEGIN
    RAISE NOTICE 'Начинаем пересчет аналитики для семьи %', p_family_id;
    
    -- 1. Пересчитываем статистику для всех продуктов семьи
    RAISE NOTICE 'Пересчитываем статистику продуктов...';
    FOR v_product_record IN 
        SELECT id FROM products WHERE family_id = p_family_id
    LOOP
        BEGIN
            -- Вызываем функцию пересчета статистики продукта
            -- Эта функция должна существовать (update_product_analytics)
            PERFORM update_product_analytics(v_product_record.id, p_family_id);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Ошибка при пересчете продукта %: %', v_product_record.id, SQLERRM;
        END;
    END LOOP;
    
    -- 2. Получаем все уникальные месяцы из истории покупок и чеков
    RAISE NOTICE 'Пересчитываем месячную статистику...';
    FOR v_month_record IN 
        SELECT DISTINCT
            EXTRACT(YEAR FROM date)::INTEGER as year,
            TO_CHAR(date, 'YYYY-MM') as month_str
        FROM (
            -- Месяцы из истории покупок
            SELECT date FROM product_history WHERE family_id = p_family_id
            UNION
            -- Месяцы из чеков
            SELECT date FROM receipts WHERE family_id = p_family_id
        ) dates
        ORDER BY year DESC, month_str DESC
    LOOP
        BEGIN
            -- Вызываем функцию пересчета месячной статистики
            -- Передаем month_str в формате 'YYYY-MM' и year отдельно
            PERFORM recalculate_monthly_stats(
                p_family_id, 
                v_month_record.month_str,
                v_month_record.year
            );
            
            RAISE NOTICE 'Пересчитана статистика за %', v_month_record.month_str;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Ошибка при пересчете месяца %: %', v_month_record.month_str, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Аналитика для семьи % успешно пересчитана', p_family_id;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION recalculate_family_analytics(INTEGER) IS 
'Полный пересчет всей аналитики для семьи: статистика продуктов (avg_days, predicted_end, status) и месячная статистика для всех месяцев с покупками';

-- Функция для пересчета аналитики для всех семей (опционально)
CREATE OR REPLACE FUNCTION recalculate_all_analytics()
RETURNS VOID AS $$
DECLARE
    v_family_record RECORD;
BEGIN
    RAISE NOTICE 'Начинаем пересчет аналитики для всех семей';
    
    FOR v_family_record IN 
        SELECT id FROM families WHERE is_active = true
    LOOP
        BEGIN
            PERFORM recalculate_family_analytics(v_family_record.id);
            RAISE NOTICE 'Аналитика пересчитана для семьи %', v_family_record.id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Ошибка при пересчете семьи %: %', v_family_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Аналитика для всех семей успешно пересчитана';
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION recalculate_all_analytics() IS 
'Полный пересчет всей аналитики для всех активных семей';

