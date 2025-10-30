-- Диагностика статистики

-- Проверяем продукты
SELECT 'ПРОДУКТЫ:' as section;
SELECT id, name, calories, price, purchase_count, last_purchase, family_id 
FROM products 
WHERE family_id = 1 
ORDER BY id;

-- Проверяем чеки
SELECT 'ЧЕКИ:' as section;
SELECT id, date, total_amount, items_count, status, family_id 
FROM receipts 
WHERE family_id = 1 
ORDER BY date DESC;

-- Проверяем историю покупок
SELECT 'ИСТОРИЯ ПОКУПОК:' as section;
SELECT ph.id, p.name, ph.date, ph.quantity, ph.price, ph.family_id
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1 
ORDER BY ph.date DESC;

-- Проверяем месячную статистику
SELECT 'МЕСЯЧНАЯ СТАТИСТИКА:' as section;
SELECT * FROM monthly_stats 
WHERE family_id = 1 
ORDER BY year DESC, month DESC;

-- Ручной расчет статистики для октября 2024
SELECT 'РАСЧЕТ ДЛЯ ОКТЯБРЯ 2024:' as section;
SELECT 
  SUM(r.total_amount) as total_spent,
  COUNT(r.id) as receipts_count,
  SUM(p.calories * ph.quantity) as total_calories
FROM receipts r
LEFT JOIN product_history ph ON ph.family_id = r.family_id 
  AND EXTRACT(YEAR FROM ph.date) = 2024 
  AND EXTRACT(MONTH FROM ph.date) = 10
LEFT JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1 
  AND EXTRACT(YEAR FROM r.date) = 2024 
  AND EXTRACT(MONTH FROM r.date) = 10;
