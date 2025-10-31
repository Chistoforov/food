-- ============================================================================
-- Скрипт для исправления цен и калорий в продуктах
-- ============================================================================
-- Проблема: Цены были неправильно пересчитаны (делились на quantity)
-- Решение: Используем правильные данные из product_history
-- Дата: 31 октября 2025
-- ============================================================================

-- Шаг 1: Показываем текущие проблемные данные
-- ============================================================================
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.price as current_product_price,
  p.calories as current_product_calories,
  ph.price as history_price,
  ph.quantity as history_quantity,
  ph.unit_price as history_unit_price,
  ph.date as last_purchase_date
FROM products p
LEFT JOIN LATERAL (
  SELECT price, quantity, unit_price, date
  FROM product_history
  WHERE product_id = p.id
  ORDER BY date DESC
  LIMIT 1
) ph ON true
ORDER BY p.id;

-- Шаг 2: Исправляем цены в таблице products
-- ============================================================================
-- Устанавливаем цену из последней покупки (price из product_history)
-- Это ПРАВИЛЬНАЯ цена из чека, которую заплатили за купленное количество

UPDATE products p
SET price = (
  SELECT ph.price 
  FROM product_history ph 
  WHERE ph.product_id = p.id 
  ORDER BY ph.date DESC 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM product_history ph WHERE ph.product_id = p.id
);

-- Шаг 3: Проверяем результаты
-- ============================================================================
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.price as updated_price,
  p.calories as calories,
  p.family_id,
  p.last_purchase
FROM products p
ORDER BY p.last_purchase DESC
LIMIT 20;

-- Шаг 4: Статистика по исправлениям
-- ============================================================================
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN price > 0 THEN 1 END) as products_with_price,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM products;

-- ============================================================================
-- ВАЖНЫЕ ЗАМЕТКИ:
-- ============================================================================
-- 1. Цены теперь хранятся как "последняя цена покупки"
--    - Для упакованных товаров (200г гуакамоле за 1.95€) → price = 1.95
--    - Для товаров на вес (212г сыра за 4.24€) → price = 4.24
--
-- 2. Калории хранятся для купленного количества
--    - Для 212г сыра → calories = калории для 212г (не на 100г!)
--
-- 3. Для будущих чеков приложение уже исправлено и будет сохранять
--    правильные цены автоматически
-- ============================================================================

