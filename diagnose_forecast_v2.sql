-- Diagnostic query for forecast v2. Run before/after migration_forecast_v2.sql
-- to sanity-check the regularity gate. Family_id hardcoded to 1 — change if needed.
--
-- Columns:
--   type            — product_type
--   product_count   — distinct SKUs of this type
--   n_purchases     — count of distinct purchase dates in last 365 days (quantity>0)
--   mean_int        — avg interval between purchases (same-day dedup)
--   days_since_last — days since last purchase
--   first_seen_ago  — days since first purchase (in lookback window)
--   status_cache    — current cached status in product_type_stats

WITH per_type AS (
  SELECT p.product_type,
         COUNT(DISTINCT ph.date) FILTER (WHERE ph.quantity > 0 AND ph.date >= CURRENT_DATE - 365) AS n_purchases,
         MAX(ph.date) FILTER (WHERE ph.quantity > 0 AND ph.date >= CURRENT_DATE - 365) AS last_date,
         MIN(ph.date) FILTER (WHERE ph.quantity > 0 AND ph.date >= CURRENT_DATE - 365) AS first_date
    FROM products p
    JOIN product_history ph ON ph.product_id = p.id
   WHERE p.family_id = 1 AND p.product_type IS NOT NULL
   GROUP BY p.product_type
),
intervals AS (
  SELECT p.product_type, d.date - LAG(d.date) OVER (PARTITION BY p.product_type ORDER BY d.date) AS gap
    FROM products p
    JOIN (
      SELECT DISTINCT p2.product_type, ph.date
        FROM product_history ph JOIN products p2 ON p2.id = ph.product_id
       WHERE p2.family_id = 1 AND ph.quantity > 0 AND ph.date >= CURRENT_DATE - 365
    ) d ON d.product_type = p.product_type
    WHERE p.family_id = 1
),
means AS (
  SELECT product_type, AVG(NULLIF(gap,0))::numeric AS mean_int FROM intervals GROUP BY product_type
)
SELECT pt.product_type AS type,
       pts.product_count,
       pt.n_purchases,
       ROUND(m.mean_int,1) AS mean_int,
       CURRENT_DATE - pt.last_date AS days_since_last,
       CURRENT_DATE - pt.first_date AS first_seen_ago,
       pts.status AS status_cache
  FROM per_type pt
  LEFT JOIN means m ON m.product_type = pt.product_type
  LEFT JOIN product_type_stats pts ON pts.product_type = pt.product_type AND pts.family_id = 1
 ORDER BY pt.n_purchases DESC NULLS LAST, pt.product_type;
