-- Прямой пересчет статистики без использования RPC функций
-- Этот скрипт можно выполнить напрямую в Supabase SQL Editor

-- Удаляем старую статистику для семьи 1
DELETE FROM monthly_stats WHERE family_id = 1;

-- Пересчитываем статистику для октября 2024
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  '2024-10' as month,
  2024 as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 31), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND EXTRACT(YEAR FROM ph.date) = 2024 
  AND EXTRACT(MONTH FROM ph.date) = 10
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND EXTRACT(YEAR FROM r.date) = 2024 
  AND EXTRACT(MONTH FROM r.date) = 10;

-- Пересчитываем статистику для ноября 2024
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  '2024-11' as month,
  2024 as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 30), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND EXTRACT(YEAR FROM ph.date) = 2024 
  AND EXTRACT(MONTH FROM ph.date) = 11
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND EXTRACT(YEAR FROM r.date) = 2024 
  AND EXTRACT(MONTH FROM r.date) = 11;

-- Пересчитываем статистику для всех других месяцев с чеками
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  month_key as month,
  year_val as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / days_in_month), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM (
  SELECT DISTINCT
    TO_CHAR(r.date, 'YYYY-MM') as month_key,
    EXTRACT(YEAR FROM r.date)::INTEGER as year_val,
    EXTRACT(DAY FROM (DATE_TRUNC('month', r.date) + INTERVAL '1 month - 1 day')) as days_in_month
  FROM receipts r
  WHERE r.family_id = 1 
    AND TO_CHAR(r.date, 'YYYY-MM') NOT IN ('2024-10', '2024-11')
) months
JOIN receipts r ON TO_CHAR(r.date, 'YYYY-MM') = months.month_key
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND EXTRACT(YEAR FROM ph.date) = months.year_val
  AND EXTRACT(MONTH FROM ph.date) = EXTRACT(MONTH FROM r.date)
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1
GROUP BY months.month_key, months.year_val, months.days_in_month
ON CONFLICT (family_id, month, year) 
DO UPDATE SET 
  total_spent = EXCLUDED.total_spent,
  total_calories = EXCLUDED.total_calories,
  avg_calories_per_day = EXCLUDED.avg_calories_per_day,
  receipts_count = EXCLUDED.receipts_count,
  updated_at = NOW();

-- Показываем результат
SELECT 
  month,
  year,
  total_spent,
  total_calories,
  avg_calories_per_day,
  receipts_count,
  updated_at
FROM monthly_stats 
WHERE family_id = 1 
ORDER BY year DESC, month DESC;
