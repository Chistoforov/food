-- Исправление статистики для текущего месяца (декабрь 2024)
-- Выполните этот SQL в Supabase Dashboard

-- Сначала проверим, какие данные у нас есть
SELECT 'ЧЕКИ' as table_name, COUNT(*) as count FROM receipts WHERE family_id = 1
UNION ALL
SELECT 'ПРОДУКТЫ' as table_name, COUNT(*) as count FROM products WHERE family_id = 1
UNION ALL
SELECT 'ИСТОРИЯ ПОКУПОК' as table_name, COUNT(*) as count FROM product_history WHERE family_id = 1
UNION ALL
SELECT 'СТАТИСТИКА' as table_name, COUNT(*) as count FROM monthly_stats WHERE family_id = 1;

-- Показываем чеки за декабрь 2024
SELECT 
  'ЧЕКИ ЗА ДЕКАБРЬ 2024' as info,
  id,
  date,
  total_amount,
  items_count
FROM receipts 
WHERE family_id = 1 
  AND EXTRACT(YEAR FROM date) = 2024 
  AND EXTRACT(MONTH FROM date) = 12
ORDER BY date DESC;

-- Показываем историю покупок за декабрь 2024
SELECT 
  'ИСТОРИЯ ПОКУПОК ЗА ДЕКАБРЬ 2024' as info,
  ph.id,
  ph.date,
  ph.quantity,
  ph.price,
  p.name as product_name,
  p.calories
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1 
  AND EXTRACT(YEAR FROM ph.date) = 2024 
  AND EXTRACT(MONTH FROM ph.date) = 12
ORDER BY ph.date DESC;

-- Удаляем старую статистику за декабрь 2024
DELETE FROM monthly_stats WHERE family_id = 1 AND month = '2024-12' AND year = 2024;

-- Пересчитываем статистику для декабря 2024
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
SELECT 
  1 as family_id,
  '2024-12' as month,
  2024 as year,
  COALESCE(SUM(r.total_amount), 0) as total_spent,
  COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
  COALESCE(ROUND(SUM(p.calories * ph.quantity) / 31), 0) as avg_calories_per_day,
  COUNT(DISTINCT r.id) as receipts_count
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND EXTRACT(YEAR FROM ph.date) = 2024 
  AND EXTRACT(MONTH FROM ph.date) = 12
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND EXTRACT(YEAR FROM r.date) = 2024 
  AND EXTRACT(MONTH FROM r.date) = 12;

-- Показываем результат
SELECT 
  'РЕЗУЛЬТАТ СТАТИСТИКИ' as info,
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
