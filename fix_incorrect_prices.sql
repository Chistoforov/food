-- Скрипт для исправления неправильных цен в продуктах
-- Проблема: API неправильно интерпретировал quantity для упакованных товаров,
-- что привело к неправильному расчету unit_price

-- ВАЖНО: Этот скрипт восстанавливает правильные цены из product_history
-- Он пересчитывает цену продукта как среднюю цену из истории покупок

-- Шаг 1: Показываем продукты с подозрительно высокими ценами
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.price as current_price,
  p.family_id,
  (SELECT AVG(ph.price) FROM product_history ph WHERE ph.product_id = p.id) as avg_total_price,
  (SELECT AVG(ph.unit_price) FROM product_history ph WHERE ph.product_id = p.id) as avg_unit_price,
  (SELECT AVG(ph.quantity) FROM product_history ph WHERE ph.product_id = p.id) as avg_quantity
FROM products p
WHERE p.price > 5  -- Подозрительно высокие цены
ORDER BY p.price DESC;

-- Шаг 2: Исправляем цены на основе данных из product_history
-- Для каждого продукта берем последнюю покупку и используем ее unit_price
UPDATE products p
SET price = (
  SELECT ph.unit_price 
  FROM product_history ph 
  WHERE ph.product_id = p.id 
  ORDER BY ph.date DESC 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM product_history ph WHERE ph.product_id = p.id
);

-- Шаг 3: Проверяем результат
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.price as updated_price,
  p.family_id
FROM products p
ORDER BY p.price DESC
LIMIT 20;

-- Шаг 4 (Опционально): Если нужно исправить конкретный продукт вручную
-- Раскомментируйте и замените значения:
-- UPDATE products 
-- SET price = 1.95 
-- WHERE name ILIKE '%гуакамоле%' OR original_name ILIKE '%guacamole%';

