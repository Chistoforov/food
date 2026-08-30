-- Shelf-life cap for calculate_product_type_status.
-- Problem: median-based forecast keeps rarely-bought perishables (fresh greens,
-- opened sauces, fresh meat) in 'ok' long after they physically expired, because
-- the median gap between purchases is larger than the fridge/pantry shelf life.
-- Fix: introduce perishable_shelf_life(product_type, days) and cap the effective
-- interval used in the recent-grace check and forecast:
--   v_effective_interval := LEAST(v_median_interval, COALESCE(v_shelf_life, v_median_interval))
-- The regularity gate keeps using the raw median — cap must not turn ok→irregular.

CREATE TABLE IF NOT EXISTS perishable_shelf_life (
  product_type    TEXT PRIMARY KEY,
  shelf_life_days INTEGER NOT NULL CHECK (shelf_life_days BETWEEN 1 AND 90),
  source          TEXT,                                       -- 'llm' | 'manual'
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR
) RETURNS VARCHAR
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  c_min_purchases         CONSTANT INTEGER := 6;
  c_max_median_interval   CONSTANT NUMERIC := 18;
  c_staleness_mult        CONSTANT NUMERIC := 2.0;
  c_staleness_grace       CONSTANT INTEGER := 3;
  c_min_first_seen        CONSTANT INTEGER := 30;
  c_lookback_days         CONSTANT INTEGER := 365;
  c_recent_gap_window     CONSTANT INTEGER := 10;
  c_min_valid_gaps        CONSTANT INTEGER := 3;
  c_ending_threshold      CONSTANT INTEGER := 2;

  v_today                 DATE := CURRENT_DATE;
  v_since_date            DATE := CURRENT_DATE - c_lookback_days;
  v_is_early_depletion    BOOLEAN := false;
  v_n                     INTEGER;
  v_median_interval       NUMERIC;
  v_effective_interval    NUMERIC;
  v_shelf_life            INTEGER;
  v_q1                    NUMERIC;
  v_q3                    NUMERIC;
  v_iqr                   NUMERIC;
  v_lower_fence           NUMERIC;
  v_upper_fence           NUMERIC;
  v_valid_count           INTEGER;
  v_last_date             DATE;
  v_first_date            DATE;
  v_days_since_last       INTEGER;
  v_first_seen_ago        INTEGER;
  v_predicted_end         DATE;
  v_days_until_end        INTEGER;
BEGIN
  -- Rule 1: early-depletion override (user pressed "закончилось").
  SELECT EXISTS (
    SELECT 1 FROM product_history ph
      JOIN products p ON p.id = ph.product_id
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND ph.id IN (
         SELECT DISTINCT ON (ph2.product_id) ph2.id
           FROM product_history ph2
           JOIN products p2 ON p2.id = ph2.product_id
          WHERE p2.family_id = p_family_id
            AND p2.product_type = p_product_type
          ORDER BY ph2.product_id, ph2.date DESC, ph2.id DESC
       )
       AND ph.quantity = -1
  ) INTO v_is_early_depletion;

  IF v_is_early_depletion THEN
    RETURN 'ending-soon';
  END IF;

  -- Aggregate n / first / last across all real purchases in the lookback.
  WITH dated AS (
    SELECT DISTINCT ph.date
      FROM product_history ph
      JOIN products p ON p.id = ph.product_id
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND ph.quantity > 0
       AND ph.date >= v_since_date
  )
  SELECT
      (SELECT COUNT(*) FROM dated),
      (SELECT MIN(date) FROM dated),
      (SELECT MAX(date) FROM dated)
    INTO v_n, v_first_date, v_last_date;

  IF v_n IS NULL OR v_n < 2 THEN
    RETURN 'calculating';
  END IF;

  v_days_since_last := v_today - v_last_date;
  v_first_seen_ago  := v_today - v_first_date;

  -- Compute IQR-fenced median from the last N gaps.
  WITH dated AS (
    SELECT DISTINCT ph.date
      FROM product_history ph
      JOIN products p ON p.id = ph.product_id
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND ph.quantity > 0
       AND ph.date >= v_since_date
  ),
  ordered AS (
    SELECT date, LAG(date) OVER (ORDER BY date) AS prev_date FROM dated
  ),
  gaps AS (
    SELECT date, (date - prev_date)::integer AS gap
      FROM ordered
     WHERE prev_date IS NOT NULL AND (date - prev_date) > 0
  ),
  recent_gaps AS (
    SELECT gap FROM gaps ORDER BY date DESC LIMIT c_recent_gap_window
  ),
  fences AS (
    SELECT
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gap) AS q1,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gap) AS q3
    FROM recent_gaps
  )
  SELECT
      q1,
      q3,
      (q3 - q1) AS iqr
    INTO v_q1, v_q3, v_iqr
    FROM fences;

  v_lower_fence := COALESCE(v_q1 - 1.5 * v_iqr, 0);
  v_upper_fence := COALESCE(v_q3 + 1.5 * v_iqr, c_max_median_interval);

  WITH dated AS (
    SELECT DISTINCT ph.date
      FROM product_history ph
      JOIN products p ON p.id = ph.product_id
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND ph.quantity > 0
       AND ph.date >= v_since_date
  ),
  ordered AS (
    SELECT date, LAG(date) OVER (ORDER BY date) AS prev_date FROM dated
  ),
  gaps AS (
    SELECT date, (date - prev_date)::integer AS gap
      FROM ordered
     WHERE prev_date IS NOT NULL AND (date - prev_date) > 0
  ),
  recent_gaps AS (
    SELECT gap FROM gaps ORDER BY date DESC LIMIT c_recent_gap_window
  ),
  filtered_gaps AS (
    SELECT gap FROM recent_gaps
     WHERE gap BETWEEN v_lower_fence AND v_upper_fence
  )
  SELECT
      (SELECT COUNT(*) FROM filtered_gaps),
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap) FROM filtered_gaps)
    INTO v_valid_count, v_median_interval;

  -- Regularity gate — uses the RAW median (cap must not turn ok into irregular).
  IF v_n < c_min_purchases
     OR v_valid_count IS NULL
     OR v_valid_count < c_min_valid_gaps
     OR v_median_interval IS NULL
     OR v_median_interval > c_max_median_interval
     OR v_days_since_last > (c_staleness_mult * v_median_interval + c_staleness_grace)
     OR v_first_seen_ago < c_min_first_seen
  THEN
    RETURN 'irregular';
  END IF;

  -- Shelf-life cap. For perishables the effective horizon is min(median, shelf_life).
  SELECT shelf_life_days INTO v_shelf_life
    FROM perishable_shelf_life
   WHERE product_type = p_product_type;

  v_effective_interval := LEAST(
    v_median_interval,
    COALESCE(v_shelf_life::NUMERIC, v_median_interval)
  );

  -- Dynamic recent-grace: still inside last effective cycle → ok.
  IF v_days_since_last <= v_effective_interval THEN
    RETURN 'ok';
  END IF;

  -- Stage B — forecast (also capped).
  v_predicted_end := v_last_date + v_effective_interval::INTEGER;
  v_days_until_end := v_predicted_end - v_today;

  IF v_days_until_end <= c_ending_threshold THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

-- Refresh cache for all active families so the UI reflects the new cap immediately.
DO $$
DECLARE
  v_family_id INTEGER;
BEGIN
  FOR v_family_id IN SELECT id FROM families WHERE is_active = true LOOP
    PERFORM recalculate_product_type_stats(v_family_id);
  END LOOP;
END $$;
