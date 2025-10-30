-- Проверка всех месяцев с чеками и пересчет статистики
-- Выполните этот SQL в Supabase Dashboard

-- Находим все месяцы с чеками
WITH months_with_receipts AS (
  SELECT DISTINCT
    EXTRACT(YEAR FROM date) as year,
    EXTRACT(MONTH FROM date) as month,
    LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') as month_str
  FROM receipts 
  WHERE family_id = 1
  ORDER BY year DESC, month DESC
)
SELECT 
  'МЕСЯЦЫ С ЧЕКАМИ' as info,
  year,
  month_str as month,
  COUNT(r.id) as receipts_count,
  SUM(r.total_amount) as total_spent
FROM months_with_receipts mwr
LEFT JOIN receipts r ON EXTRACT(YEAR FROM r.date) = mwr.year 
  AND EXTRACT(MONTH FROM r.date) = mwr.month 
  AND r.family_id = 1
GROUP BY mwr.year, mwr.month_str, mwr.month
ORDER BY mwr.year DESC, mwr.month DESC;

-- Пересчитываем статистику для всех месяцев с чеками
WITH months_with_receipts AS (
  SELECT DISTINCT
    EXTRACT(YEAR FROM date) as year,
    EXTRACT(MONTH FROM date) as month,
    LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') as month_str
  FROM receipts 
  WHERE family_id = 1
)
-- Удаляем старую статистику для этих месяцев
DELETE FROM monthly_stats 
WHERE family_id = 1 
  AND (month, year) IN (
    SELECT month_str, year FROM months_with_receipts
  );

-- Вставляем новую статистику для каждого месяца
WITH months_with_receipts AS (
  SELECT DISTINCT
    EXTRACT(YEAR FROM date) as year,
    EXTRACT(MONTH FROM date) as month,
    LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') as month_str
  FROM receipts 
  WHERE family_id = 1
)
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  mwr.month_str as month,
  mwr.year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 
    CASE 
      WHEN mwr.month IN (1,3,5,7,8,10,12) THEN 31
      WHEN mwr.month IN (4,6,9,11) THEN 30
      WHEN mwr.month = 2 THEN 
        CASE 
          WHEN mwr.year % 4 = 0 AND (mwr.year % 100 != 0 OR mwr.year % 400 = 0) THEN 29
          ELSE 28
        END
    END), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM months_with_receipts mwr
LEFT JOIN receipts r ON EXTRACT(YEAR FROM r.date) = mwr.year 
  AND EXTRACT(MONTH FROM r.date) = mwr.month 
  AND r.family_id = 1
LEFT JOIN product_history ph ON ph.family_id = 1 
  AND EXTRACT(YEAR FROM ph.date) = mwr.year 
  AND EXTRACT(MONTH FROM ph.date) = mwr.month
LEFT JOIN products p ON ph.product_id = p.id
GROUP BY mwr.year, mwr.month_str, mwr.month;

-- Показываем финальный результат
SELECT 
  'ФИНАЛЬНАЯ СТАТИСТИКА' as info,
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
