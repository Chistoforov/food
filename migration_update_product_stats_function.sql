-- Функция для пересчета статистики продукта
-- Вызывается после каждой покупки для обновления avg_days, predicted_end и status

CREATE OR REPLACE FUNCTION update_product_analytics(p_product_id INTEGER, p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_product_type VARCHAR(255);
    v_last_purchase DATE;
    v_history_count INTEGER;
    v_avg_days INTEGER;
    v_predicted_end DATE;
    v_status VARCHAR(20);
    v_days_since_purchase INTEGER;
    v_days_until_end INTEGER;
    v_intervals INTEGER[];
    v_interval INTEGER;
    v_prev_date DATE;
    v_curr_date DATE;
    v_days_diff INTEGER;
BEGIN
    -- Получаем информацию о продукте
    SELECT product_type, last_purchase 
    INTO v_product_type, v_last_purchase
    FROM products
    WHERE id = p_product_id AND family_id = p_family_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    -- Собираем историю покупок
    -- Если у продукта есть тип, используем историю ВСЕХ продуктов этого типа
    -- Иначе используем только историю конкретного продукта
    IF v_product_type IS NOT NULL THEN
        -- Групповая история по типу
        SELECT COUNT(*)
        INTO v_history_count
        FROM product_history ph
        JOIN products p ON p.id = ph.product_id
        WHERE p.product_type = v_product_type
          AND p.family_id = p_family_id
        ORDER BY ph.date ASC;
    ELSE
        -- Индивидуальная история продукта
        SELECT COUNT(*)
        INTO v_history_count
        FROM product_history
        WHERE product_id = p_product_id
          AND family_id = p_family_id;
    END IF;

    -- Если меньше 2 покупок, статус = calculating
    IF v_history_count < 2 THEN
        UPDATE products
        SET status = 'calculating',
            avg_days = NULL,
            predicted_end = NULL,
            updated_at = NOW()
        WHERE id = p_product_id;
        RETURN;
    END IF;

    -- Вычисляем интервалы между покупками
    v_intervals := ARRAY[]::INTEGER[];
    
    IF v_product_type IS NOT NULL THEN
        -- Групповая история
        FOR v_prev_date, v_curr_date IN
            SELECT 
                LAG(ph.date) OVER (ORDER BY ph.date),
                ph.date
            FROM product_history ph
            JOIN products p ON p.id = ph.product_id
            WHERE p.product_type = v_product_type
              AND p.family_id = p_family_id
            ORDER BY ph.date ASC
        LOOP
            IF v_prev_date IS NOT NULL THEN
                v_days_diff := v_curr_date - v_prev_date;
                -- Игнорируем покупки в один день
                IF v_days_diff > 0 THEN
                    v_intervals := array_append(v_intervals, v_days_diff);
                END IF;
            END IF;
        END LOOP;
    ELSE
        -- Индивидуальная история
        FOR v_prev_date, v_curr_date IN
            SELECT 
                LAG(date) OVER (ORDER BY date),
                date
            FROM product_history
            WHERE product_id = p_product_id
              AND family_id = p_family_id
            ORDER BY date ASC
        LOOP
            IF v_prev_date IS NOT NULL THEN
                v_days_diff := v_curr_date - v_prev_date;
                IF v_days_diff > 0 THEN
                    v_intervals := array_append(v_intervals, v_days_diff);
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Если нет валидных интервалов, статус = calculating
    IF array_length(v_intervals, 1) IS NULL OR array_length(v_intervals, 1) = 0 THEN
        UPDATE products
        SET status = 'calculating',
            avg_days = NULL,
            predicted_end = NULL,
            updated_at = NOW()
        WHERE id = p_product_id;
        RETURN;
    END IF;

    -- Вычисляем средний интервал
    SELECT ROUND(AVG(unnest)::NUMERIC)::INTEGER
    INTO v_avg_days
    FROM unnest(v_intervals);

    -- Прогнозируем дату окончания
    v_predicted_end := v_last_purchase + v_avg_days;

    -- Определяем статус
    v_days_since_purchase := CURRENT_DATE - v_last_purchase;
    v_days_until_end := v_predicted_end - CURRENT_DATE;

    -- Если продукт куплен недавно (меньше 2 дней назад), статус = 'ok'
    -- Иначе если до окончания <= 2 дней, статус = 'ending-soon'
    IF v_days_since_purchase < 2 THEN
        v_status := 'ok';
        RAISE NOTICE 'Продукт #% куплен % дней назад, статус = ok', p_product_id, v_days_since_purchase;
    ELSIF v_days_until_end <= 2 THEN
        v_status := 'ending-soon';
        RAISE NOTICE 'Продукт #%: до окончания % дней, статус = ending-soon', p_product_id, v_days_until_end;
    ELSE
        v_status := 'ok';
    END IF;

    -- Обновляем продукт
    UPDATE products
    SET avg_days = v_avg_days,
        predicted_end = v_predicted_end,
        status = v_status,
        updated_at = NOW()
    WHERE id = p_product_id;

    RAISE NOTICE 'Обновлена статистика продукта #%: avg_days=%, predicted_end=%, status=%', 
        p_product_id, v_avg_days, v_predicted_end, v_status;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION update_product_analytics(INTEGER, INTEGER) IS 
'Пересчитывает статистику продукта (avg_days, predicted_end, status) на основе истории покупок. 
Если у продукта указан product_type, использует историю всех продуктов этого типа.
Если продукт куплен недавно (< 2 дней), статус всегда = ok.';













