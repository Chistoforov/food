-- ПЕРЕСЧЕТ ВСЕЙ СТАТИСТИКИ ДЛЯ ВСЕХ МЕСЯЦЕВ С ЧЕКАМИ
-- Выполните этот SQL в Supabase SQL Editor

-- 1. Показываем все месяцы, в которых есть чеки
SELECT 
  DATE_TRUNC('month', date)::date as month_start,
  COUNT(*) as receipts_count,
  SUM(total_amount) as total_amount
FROM receipts
WHERE family_id = 1
GROUP BY DATE_TRUNC('month', date)
ORDER BY month_start DESC;

-- 2. Удаляем всю старую статистику
DELETE FROM monthly_stats WHERE family_id = 1;

-- 3. Пересчитываем статистику для каждого месяца с чеками
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  TO_CHAR(DATE_TRUNC('month', r.date), 'YYYY-MM') as month,
  EXTRACT(YEAR FROM DATE_TRUNC('month', r.date))::int as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(
    SUM(p.calories * ph.quantity) / 
    NULLIF(EXTRACT(DAY FROM DATE_TRUNC('month', r.date) + INTERVAL '1 month' - INTERVAL '1 day'), 0)::numeric
  ), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND DATE_TRUNC('month', ph.date) = DATE_TRUNC('month', r.date)
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1
GROUP BY DATE_TRUNC('month', r.date);

-- 4. Проверяем результат
SELECT 
  month,
  year,
  total_spent,
  total_calories,
  avg_calories_per_day,
  receipts_count
FROM monthly_stats
WHERE family_id = 1
ORDER BY year DESC, month DESC;

-- 5. Обновляем счетчики покупок для всех продуктов
UPDATE products p
SET 
  purchase_count = COALESCE((
    SELECT COUNT(*)
    FROM product_history ph
    WHERE ph.product_id = p.id
      AND ph.family_id = p.family_id
  ), 0),
  last_purchase = (
    SELECT MAX(date)
    FROM product_history ph
    WHERE ph.product_id = p.id
      AND ph.family_id = p.family_id
  )
WHERE p.family_id = 1;

-- 6. Проверяем обновленные счетчики покупок
SELECT 
  id,
  name,
  purchase_count,
  last_purchase,
  calories,
  price
FROM products
WHERE family_id = 1
ORDER BY purchase_count DESC, name;

-- ГОТОВО! 
-- Теперь обновите страницу приложения (F5) и посмотрите в консоль браузера (F12)
-- Вы должны увидеть логи с информацией о загруженной статистике

