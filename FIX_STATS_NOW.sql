-- ИСПРАВЛЕНИЕ СТАТИСТИКИ И СЧЕТЧИКОВ ПОКУПОК
-- Выполните этот SQL в Supabase SQL Editor

-- 1. Обновляем счетчик покупок для всех продуктов
UPDATE products p
SET purchase_count = (
  SELECT COUNT(*)
  FROM product_history ph
  WHERE ph.product_id = p.id
    AND ph.family_id = p.family_id
)
WHERE p.family_id = 1;

-- 2. Проверяем результат
SELECT 
  id,
  name,
  purchase_count,
  last_purchase
FROM products
WHERE family_id = 1
ORDER BY purchase_count DESC;

-- 3. Пересчитываем статистику за октябрь 2024
DELETE FROM monthly_stats 
WHERE family_id = 1 AND month = '2024-10' AND year = 2024;

INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  '2024-10' as month,
  2024 as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 31.0), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND DATE_TRUNC('month', ph.date) = DATE_TRUNC('month', r.date)
  AND DATE_TRUNC('month', r.date) = '2024-10-01'::date
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND DATE_TRUNC('month', r.date) = '2024-10-01'::date;

-- 4. Пересчитываем статистику за ноябрь 2024  
DELETE FROM monthly_stats 
WHERE family_id = 1 AND month = '2024-11' AND year = 2024;

INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  '2024-11' as month,
  2024 as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 30.0), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND DATE_TRUNC('month', ph.date) = DATE_TRUNC('month', r.date)
  AND DATE_TRUNC('month', r.date) = '2024-11-01'::date
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND DATE_TRUNC('month', r.date) = '2024-11-01'::date;

-- 5. Проверяем статистику
SELECT * FROM monthly_stats WHERE family_id = 1 ORDER BY year DESC, month DESC;

-- 6. Проверяем, есть ли чеки
SELECT COUNT(*) as total_receipts FROM receipts WHERE family_id = 1;

-- 7. Проверяем, есть ли история покупок
SELECT COUNT(*) as total_history FROM product_history WHERE family_id = 1;

-- ГОТОВО! Обновите страницу приложения (F5)

