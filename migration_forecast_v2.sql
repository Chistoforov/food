-- Forecast v2 — regularity gate for product-type ending-soon detection.
-- Adds 'irregular' status for types that are impulse buys, one-offs, or once-regular
-- but abandoned. HomePage hides 'irregular'; ProductsPage still shows them.
-- Rollback: rollback_forecast_v2.sql

-- 1. Extend the CHECK constraint on both status-bearing tables.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('ending-soon', 'ok', 'calculating', 'irregular'));

ALTER TABLE product_type_stats
  DROP CONSTRAINT IF EXISTS product_type_stats_status_check;
ALTER TABLE product_type_stats
  ADD CONSTRAINT product_type_stats_status_check
  CHECK (status IN ('ending-soon', 'ok', 'calculating', 'irregular'));

-- 2. Replace calculate_product_type_status with v2 body.
--
-- Thresholds are hardcoded (per user decision — retune via migration):
--   MIN_PURCHASES        = 6      покупок за LOOKBACK, иначе irregular
--   MAX_MEAN_INTERVAL    = 18     дней между покупками (~2.5 недели), иначе irregular
--                                 (ужесточено с 30 → 18 после первого прогона: 20-27д типы
--                                 типа "яблоки/черника/вода/хлопья" ощущались как импульсные)
--   STALENESS_MULT       = 2.0    days_since_last <= mult*mean + grace, иначе irregular
--   STALENESS_GRACE      = 3      дни-запас для staleness gate
--   MIN_FIRST_SEEN       = 30     дней с первой покупки (защита от кластера пробных)
--   LOOKBACK             = 365    окно анализа
--   ENDING_THRESHOLD     = 2      predicted_end - today <= X → ending-soon
--   RECENT_GRACE         = 2      days_since_last < X → форс ok (regulars)
--
-- Пороги подобраны на реальных данных family_id=1:
--   Regular pass:   молоко (n=120,mean=3,ds=0), курица (n=88,mean=4,ds=7),
--                   йогурт (n=64,mean=6,ds=3), хлеб (n=48,mean=7,ds=13),
--                   вино (n=39,mean=10,ds=2), помидоры (n=31,mean=12,ds=7).
--   Impulse cut:    манго (n=19,mean=17,ds=63 → 63>2*17+3=37),
--                   зубная щётка (n=3<6, mean=65>30),
--                   пицца (n=4<6), кофе (n=15,mean=8,ds=251).
--
-- Только `product_history.quantity > 0` учитывается для интервалов
-- (virtual=0 не считаем; -1 = early depletion — обрабатывается отдельно как раньше).

CREATE OR REPLACE FUNCTION public.calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR
) RETURNS VARCHAR
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  -- Hardcoded config
  c_min_purchases     CONSTANT INTEGER := 6;
  c_max_mean_interval CONSTANT NUMERIC := 18;
  c_staleness_mult    CONSTANT NUMERIC := 2.0;
  c_staleness_grace   CONSTANT INTEGER := 3;
  c_min_first_seen    CONSTANT INTEGER := 30;
  c_lookback_days     CONSTANT INTEGER := 365;
  c_ending_threshold  CONSTANT INTEGER := 2;
  c_recent_grace      CONSTANT INTEGER := 2;

  v_today             DATE := CURRENT_DATE;
  v_since_date        DATE := CURRENT_DATE - c_lookback_days;

  v_is_early_depletion BOOLEAN := false;

  v_n                 INTEGER;
  v_mean_interval     NUMERIC;
  v_last_date         DATE;
  v_first_date        DATE;
  v_days_since_last   INTEGER;
  v_first_seen_ago    INTEGER;

  v_predicted_end     DATE;
  v_days_until_end    INTEGER;
BEGIN
  -- Rule 1: early-depletion override (unchanged behavior — user pressed "закончилось").
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

  -- Aggregate purchase stats within lookback window (positive quantity only).
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
  )
  SELECT COUNT(*), MIN(date), MAX(date),
         AVG(NULLIF(date - prev_date, 0))
    INTO v_n, v_first_date, v_last_date, v_mean_interval
    FROM ordered;

  IF v_n IS NULL OR v_n < 2 THEN
    RETURN 'calculating';
  END IF;

  v_days_since_last := v_today - v_last_date;
  v_first_seen_ago  := v_today - v_first_date;

  -- Rule 2: recent-purchase grace (regulars we just bought).
  IF v_days_since_last < c_recent_grace THEN
    RETURN 'ok';
  END IF;

  -- Regularity gate — all four conditions must hold.
  IF v_n < c_min_purchases
     OR v_mean_interval IS NULL
     OR v_mean_interval > c_max_mean_interval
     OR v_days_since_last > (c_staleness_mult * v_mean_interval + c_staleness_grace)
     OR v_first_seen_ago < c_min_first_seen
  THEN
    RETURN 'irregular';
  END IF;

  -- Stage B — forecast for regulars.
  v_predicted_end := v_last_date + v_mean_interval::INTEGER;
  v_days_until_end := v_predicted_end - v_today;

  IF v_days_until_end <= c_ending_threshold THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

-- 3. Refresh cache for all active families so 'irregular' propagates immediately.
DO $$
DECLARE
  v_family_id INTEGER;
BEGIN
  FOR v_family_id IN SELECT id FROM families WHERE is_active = true LOOP
    PERFORM recalculate_product_type_stats(v_family_id);
  END LOOP;
END $$;
