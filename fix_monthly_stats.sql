-- Исправление месячной статистики

-- Удаляем старую статистику
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

-- Показываем результат
SELECT 'Статистика исправлена!' as status;
SELECT * FROM monthly_stats WHERE family_id = 1 ORDER BY year DESC, month DESC;
