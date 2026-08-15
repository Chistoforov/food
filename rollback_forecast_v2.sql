-- Rollback for migration_forecast_v2.sql
-- Restores calculate_product_type_status to its pre-v2 body (mean-interval prediction
-- with 2-day ending threshold, no regularity gate). Enum constraint stays extended —
-- 'irregular' rows simply won't be produced anymore; drop them out manually if desired:
--   UPDATE product_type_stats SET status='calculating' WHERE status='irregular';
--   UPDATE products           SET status='calculating' WHERE status='irregular';

CREATE OR REPLACE FUNCTION public.calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR
) RETURNS VARCHAR
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
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

  FOR v_product_record IN
    SELECT p.id, p.last_purchase
      FROM products p
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND p.last_purchase IS NOT NULL
  LOOP
    SELECT ph.quantity INTO v_last_history_quantity
      FROM product_history ph
     WHERE ph.product_id = v_product_record.id
       AND ph.family_id = p_family_id
     ORDER BY ph.date DESC, ph.id DESC
     LIMIT 1;

    IF v_last_history_quantity = -1 THEN
      v_is_early_depletion := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_is_early_depletion THEN
    RETURN 'ending-soon';
  END IF;

  FOR v_product_record IN
    SELECT id, last_purchase
      FROM products
     WHERE family_id = p_family_id
       AND product_type = p_product_type
       AND last_purchase IS NOT NULL
  LOOP
    v_days_since_purchase := v_today - v_product_record.last_purchase;

    IF v_days_since_purchase < 2 THEN
      SELECT ph.quantity INTO v_last_history_quantity
        FROM product_history ph
       WHERE ph.product_id = v_product_record.id
         AND ph.family_id = p_family_id
       ORDER BY ph.date DESC, ph.id DESC
       LIMIT 1;

      IF v_last_history_quantity != -1 THEN
        v_has_recent_purchase := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_has_recent_purchase THEN
    RETURN 'ok';
  END IF;

  SELECT COUNT(*) INTO v_history_count
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
   WHERE p.family_id = p_family_id
     AND p.product_type = p_product_type;

  IF v_history_count < 2 THEN
    RETURN 'calculating';
  END IF;

  WITH purchase_intervals AS (
    SELECT ph.date, LAG(ph.date) OVER (ORDER BY ph.date) AS prev_date
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

  SELECT MAX(last_purchase) INTO v_last_purchase_date
    FROM products
   WHERE family_id = p_family_id
     AND product_type = p_product_type;

  IF v_last_purchase_date IS NULL THEN
    RETURN 'calculating';
  END IF;

  v_predicted_end := v_last_purchase_date + v_avg_days::INTEGER;
  v_days_until_end := v_predicted_end - v_today;

  IF v_days_until_end <= 2 THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;
