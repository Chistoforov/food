-- Forecast v2.2 — regularity gate + median-of-recent + dynamic grace.
-- Detects impulse/rare product types and hides them from HomePage; regulars get
-- a median-based forecast. Rollback: rollback_forecast_v2.sql.
--
-- Threshold history:
--   v2.0 (e6234be): mean over 365d, max_mean_interval=30, fixed recent_grace=2d
--   v2.1 (bce25a6): switched to MEDIAN of last 5 intervals; max=18d
--                   (mean over year смoothes recent outliers — see "вода" test case)
--   v2.2 (this):    recent-grace now = median_interval (dynamic, not fixed 2d)
--                   — item is "ok" while within one median cycle of last purchase,
--                     so арбузы@6d/median=6 don't flip to ending-soon prematurely.
--
-- Config (hardcoded — retune via new migration):
--   MIN_PURCHASES        = 6      покупок за LOOKBACK, иначе irregular
--   MAX_MEDIAN_INTERVAL  = 18     дней между покупками (~2.5 недели), иначе irregular
--   STALENESS_MULT       = 2.0    days_since_last <= mult*median + grace, иначе irregular
--   STALENESS_GRACE      = 3      дни-запас для staleness gate
--   MIN_FIRST_SEEN       = 30     дней с первой покупки (защита от кластера пробных)
--   LOOKBACK             = 365    окно анализа
--   RECENT_GAP_WINDOW    = 5      последних интервалов для медианы
--   ENDING_THRESHOLD     = 2      predicted_end - today <= X → ending-soon

-- 1. Extend CHECK on both status columns.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('ending-soon', 'ok', 'calculating', 'irregular'));

ALTER TABLE product_type_stats DROP CONSTRAINT IF EXISTS product_type_stats_status_check;
ALTER TABLE product_type_stats ADD CONSTRAINT product_type_stats_status_check
  CHECK (status IN ('ending-soon', 'ok', 'calculating', 'irregular'));

-- 2. Function body.
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
  c_recent_gap_window     CONSTANT INTEGER := 5;
  c_ending_threshold      CONSTANT INTEGER := 2;

  v_today                 DATE := CURRENT_DATE;
  v_since_date            DATE := CURRENT_DATE - c_lookback_days;
  v_is_early_depletion    BOOLEAN := false;
  v_n                     INTEGER;
  v_median_interval       NUMERIC;
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

  -- Aggregate: median over last N intervals, plus n/first/last.
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
  )
  SELECT
      (SELECT COUNT(*) FROM dated),
      (SELECT MIN(date) FROM dated),
      (SELECT MAX(date) FROM dated),
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap) FROM recent_gaps)
    INTO v_n, v_first_date, v_last_date, v_median_interval;

  IF v_n IS NULL OR v_n < 2 THEN
    RETURN 'calculating';
  END IF;

  v_days_since_last := v_today - v_last_date;
  v_first_seen_ago  := v_today - v_first_date;

  -- Regularity gate.
  IF v_n < c_min_purchases
     OR v_median_interval IS NULL
     OR v_median_interval > c_max_median_interval
     OR v_days_since_last > (c_staleness_mult * v_median_interval + c_staleness_grace)
     OR v_first_seen_ago < c_min_first_seen
  THEN
    RETURN 'irregular';
  END IF;

  -- Dynamic recent-grace: still inside last median cycle → ok.
  IF v_days_since_last <= v_median_interval THEN
    RETURN 'ok';
  END IF;

  -- Stage B — forecast.
  v_predicted_end := v_last_date + v_median_interval::INTEGER;
  v_days_until_end := v_predicted_end - v_today;

  IF v_days_until_end <= c_ending_threshold THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

-- 3. Refresh cache.
DO $$
DECLARE
  v_family_id INTEGER;
BEGIN
  FOR v_family_id IN SELECT id FROM families WHERE is_active = true LOOP
    PERFORM recalculate_product_type_stats(v_family_id);
  END LOOP;
END $$;
