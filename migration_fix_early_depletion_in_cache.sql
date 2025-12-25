-- Migration: Fix early depletion detection in product_type_stats cache
-- Problem: When user marks product as "ended early", the cache still shows status='ok'
-- because calculate_product_type_status() only checks last_purchase date and applies
-- the "2-day rule", but doesn't check if the last history entry is early depletion (quantity=-1)

-- Drop and recreate the calculate_product_type_status function with early depletion check
CREATE OR REPLACE FUNCTION calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR(255)
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_status VARCHAR(20) := 'calculating';
  v_has_recent_purchase BOOLEAN := false;
  v_product_record RECORD;
  v_history_count INTEGER;
  v_avg_days DECIMAL;
  v_last_purchase_date DATE;
  v_predicted_end DATE;
  v_days_since_purchase INTEGER;
  v_days_until_end INTEGER;
  v_today DATE;
  v_last_history_quantity DECIMAL;
  v_is_early_depletion BOOLEAN := false;
BEGIN
  v_today := CURRENT_DATE;
  
  -- ВАЖНО: Сначала проверяем, есть ли хотя бы один продукт этого типа
  -- с досрочным окончанием (последняя запись в истории = quantity=-1)
  FOR v_product_record IN
    SELECT p.id, p.last_purchase
    FROM products p
    WHERE p.family_id = p_family_id 
      AND p.product_type = p_product_type
      AND p.last_purchase IS NOT NULL
  LOOP
    -- Получаем последнюю запись в истории для этого продукта
    SELECT ph.quantity INTO v_last_history_quantity
    FROM product_history ph
    WHERE ph.product_id = v_product_record.id
      AND ph.family_id = p_family_id
    ORDER BY ph.date DESC, ph.id DESC
    LIMIT 1;
    
    -- Если последняя запись = -1, это досрочное окончание
    IF v_last_history_quantity = -1 THEN
      v_is_early_depletion := true;
      EXIT; -- Найден продукт с досрочным окончанием
    END IF;
  END LOOP;
  
  -- ПРИОРИТЕТ 1: Если хотя бы один продукт отмечен как досрочно закончившийся,
  -- весь тип должен показывать статус 'ending-soon'
  IF v_is_early_depletion THEN
    RETURN 'ending-soon';
  END IF;
  
  -- ПРИОРИТЕТ 2: Проверяем правило 2 дней (только если НЕ досрочное окончание)
  -- If any product of this type was purchased recently (< 2 days ago), status is 'ok'
  FOR v_product_record IN
    SELECT id, last_purchase
    FROM products
    WHERE family_id = p_family_id 
      AND product_type = p_product_type
      AND last_purchase IS NOT NULL
  LOOP
    v_days_since_purchase := v_today - v_product_record.last_purchase;
    
    IF v_days_since_purchase < 2 THEN
      -- Дополнительная проверка: это действительно обычная покупка, а не досрочное окончание?
      SELECT ph.quantity INTO v_last_history_quantity
      FROM product_history ph
      WHERE ph.product_id = v_product_record.id
        AND ph.family_id = p_family_id
      ORDER BY ph.date DESC, ph.id DESC
      LIMIT 1;
      
      -- Применяем правило 2 дней только если это НЕ досрочное окончание
      IF v_last_history_quantity != -1 THEN
        v_has_recent_purchase := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  IF v_has_recent_purchase THEN
    RETURN 'ok';
  END IF;
  
  -- ПРИОРИТЕТ 3: Обычная логика на основе avg_days и predicted_end
  -- Get all products of this type
  SELECT COUNT(*) INTO v_history_count
  FROM product_history ph
  JOIN products p ON ph.product_id = p.id
  WHERE p.family_id = p_family_id 
    AND p.product_type = p_product_type;
  
  -- Need at least 2 purchases to calculate
  IF v_history_count < 2 THEN
    RETURN 'calculating';
  END IF;
  
  -- Calculate average days between purchases for this type
  WITH purchase_intervals AS (
    SELECT 
      date,
      LAG(date) OVER (ORDER BY date) AS prev_date
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE p.family_id = p_family_id 
      AND p.product_type = p_product_type
  )
  SELECT AVG(date - prev_date)::DECIMAL
  INTO v_avg_days
  FROM purchase_intervals
  WHERE prev_date IS NOT NULL AND (date - prev_date) > 0;
  
  IF v_avg_days IS NULL THEN
    RETURN 'calculating';
  END IF;
  
  -- Find the most recent purchase of any product of this type
  SELECT MAX(last_purchase) INTO v_last_purchase_date
  FROM products
  WHERE family_id = p_family_id 
    AND product_type = p_product_type;
  
  IF v_last_purchase_date IS NULL THEN
    RETURN 'calculating';
  END IF;
  
  -- Calculate predicted end date
  v_predicted_end := v_last_purchase_date + v_avg_days::INTEGER;
  v_days_until_end := v_predicted_end - v_today;
  
  -- Determine status: ending-soon if <= 2 days until predicted end
  IF v_days_until_end <= 2 THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the change
COMMENT ON FUNCTION calculate_product_type_status(INTEGER, VARCHAR) IS 
'Calculates status for a product type with early depletion support. 
Priority 1: If any product has quantity=-1 as last history entry, status is ending-soon.
Priority 2: If any product was purchased in last 2 days (and NOT early depletion), status is ok.
Priority 3: Based on avg_days and predicted_end calculation.';





