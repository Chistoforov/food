-- 🔍 Диагностика калорий за ноябрь 2025
-- Этот скрипт поможет найти причину завышенных калорий

-- 1. Топ-10 продуктов по калориям за ноябрь (с учетом количества)
SELECT 
  p.name,
  p.original_name,
  p.calories as "Калории на 1 шт/кг",
  ph.quantity as "Количество",
  (p.calories * ph.quantity) as "Итого калорий",
  ph.date as "Дата покупки",
  ph.price as "Цена",
  r.id as "ID чека"
FROM product_history ph
JOIN products p ON ph.product_id = p.id
JOIN receipts r ON ph.receipt_id = r.id
WHERE ph.family_id = 1  -- ЗАМЕНИТЕ на ваш family_id, если другой
  AND EXTRACT(YEAR FROM ph.date) = 2025
  AND EXTRACT(MONTH FROM ph.date) = 11
ORDER BY (p.calories * ph.quantity) DESC
LIMIT 10;

-- 2. Общая статистика по продуктам за ноябрь
SELECT 
  COUNT(DISTINCT ph.product_id) as "Уникальных продуктов",
  COUNT(*) as "Всего покупок",
  COUNT(DISTINCT ph.receipt_id) as "Уникальных чеков",
  SUM(p.calories * ph.quantity) as "Всего калорий",
  ROUND(SUM(p.calories * ph.quantity) / 30.0) as "Среднее в день"
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1  -- ЗАМЕНИТЕ на ваш family_id
  AND EXTRACT(YEAR FROM ph.date) = 2025
  AND EXTRACT(MONTH FROM ph.date) = 11;

-- 3. Проверка на дублирование чеков (одинаковые чеки в одну дату)
SELECT 
  r.date,
  r.total_amount,
  r.id as receipt_id,
  COUNT(*) as "Количество товаров в чеке",
  SUM(p.calories * ph.quantity) as "Калорий в чеке"
FROM receipts r
JOIN product_history ph ON ph.receipt_id = r.id
JOIN products p ON ph.product_id = p.id
WHERE r.family_id = 1  -- ЗАМЕНИТЕ на ваш family_id
  AND EXTRACT(YEAR FROM r.date) = 2025
  AND EXTRACT(MONTH FROM r.date) = 11
GROUP BY r.id, r.date, r.total_amount
ORDER BY SUM(p.calories * ph.quantity) DESC;

-- 4. Продукты с подозрительно высокой калорийностью (больше 5000 ккал на единицу)
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.calories as "Калории (подозрительно высокие!)",
  p.price as "Цена",
  p.purchase_count as "Раз куплено",
  COUNT(ph.id) as "Записей в истории"
FROM products p
LEFT JOIN product_history ph ON ph.product_id = p.id 
  AND EXTRACT(YEAR FROM ph.date) = 2025
  AND EXTRACT(MONTH FROM ph.date) = 11
WHERE p.family_id = 1  -- ЗАМЕНИТЕ на ваш family_id
  AND p.calories > 5000
GROUP BY p.id
ORDER BY p.calories DESC;

-- 5. Распределение калорий по датам (найти аномальные дни)
SELECT 
  ph.date as "Дата",
  COUNT(DISTINCT ph.receipt_id) as "Чеков",
  COUNT(*) as "Товаров",
  SUM(p.calories * ph.quantity) as "Калорий",
  ROUND(AVG(p.calories * ph.quantity)) as "Среднее на товар"
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1  -- ЗАМЕНИТЕ на ваш family_id
  AND EXTRACT(YEAR FROM ph.date) = 2025
  AND EXTRACT(MONTH FROM ph.date) = 11
GROUP BY ph.date
ORDER BY SUM(p.calories * ph.quantity) DESC;

-- 6. Продукты с нулевыми или отрицательными количествами
SELECT 
  p.name,
  p.calories,
  ph.quantity as "Количество (должно быть > 0)",
  ph.date,
  ph.price
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1
  AND EXTRACT(YEAR FROM ph.date) = 2025
  AND EXTRACT(MONTH FROM ph.date) = 11
  AND (ph.quantity <= 0 OR ph.quantity IS NULL);









