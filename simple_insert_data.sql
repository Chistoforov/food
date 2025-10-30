-- Упрощенное добавление тестовых данных без вызова функций

-- Добавляем новые продукты с калориями
INSERT INTO products (name, calories, price, family_id, status) VALUES
('Яблоки', 52, 2.50, 1, 'ok'),
('Бананы', 89, 1.80, 1, 'ok'),
('Морковь', 41, 1.20, 1, 'ok'),
('Картофель', 77, 1.50, 1, 'ok'),
('Помидоры', 18, 3.20, 1, 'ok'),
('Сыр', 356, 4.50, 1, 'ok'),
('Йогурт', 59, 1.20, 1, 'ok'),
('Курица', 165, 6.50, 1, 'ok'),
('Яйца', 155, 2.80, 1, 'ok'),
('Хлеб', 1320, 1.25, 1, 'ok');

-- Добавляем 5 тестовых чеков
INSERT INTO receipts (date, items_count, total_amount, status, family_id) VALUES
('2024-11-01', 4, 12.30, 'processed', 1),
('2024-10-28', 3, 8.50, 'processed', 1),
('2024-10-25', 5, 18.70, 'processed', 1),
('2024-10-22', 3, 7.80, 'processed', 1),
('2024-10-19', 4, 15.20, 'processed', 1);

-- Добавляем историю покупок для создания статистики
-- Чек 1 (2024-11-01)
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
(5, '2024-11-01', 2, 5.00, 2.50, 1),  -- Яблоки
(6, '2024-11-01', 3, 5.40, 1.80, 1),  -- Бананы
(7, '2024-11-01', 1, 1.20, 1.20, 1),  -- Морковь
(8, '2024-11-01', 1, 1.50, 1.50, 1);  -- Картофель

-- Чек 2 (2024-10-28)
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
(5, '2024-10-28', 1, 2.50, 2.50, 1),  -- Яблоки
(9, '2024-10-28', 1, 3.20, 3.20, 1),  -- Помидоры
(10, '2024-10-28', 1, 4.50, 4.50, 1); -- Сыр

-- Чек 3 (2024-10-25)
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
(11, '2024-10-25', 1, 6.50, 6.50, 1), -- Курица
(7, '2024-10-25', 2, 2.40, 1.20, 1),  -- Морковь
(8, '2024-10-25', 3, 4.50, 1.50, 1),  -- Картофель
(9, '2024-10-25', 2, 6.40, 3.20, 1),  -- Помидоры
(12, '2024-10-25', 1, 2.80, 2.80, 1); -- Яйца

-- Чек 4 (2024-10-22)
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
(10, '2024-10-22', 1, 4.50, 4.50, 1), -- Сыр
(13, '2024-10-22', 2, 2.40, 1.20, 1), -- Йогурт
(12, '2024-10-22', 1, 2.80, 2.80, 1); -- Яйца

-- Чек 5 (2024-10-19)
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
(11, '2024-10-19', 1, 6.50, 6.50, 1), -- Курица
(5, '2024-10-19', 2, 5.00, 2.50, 1),  -- Яблоки
(6, '2024-10-19', 1, 1.80, 1.80, 1),  -- Бананы
(14, '2024-10-19', 1, 1.25, 1.25, 1); -- Хлеб

-- Обновляем статистику продуктов
UPDATE products SET 
  purchase_count = (
    SELECT COUNT(*) FROM product_history 
    WHERE product_id = products.id AND family_id = products.family_id
  ),
  last_purchase = (
    SELECT MAX(date) FROM product_history 
    WHERE product_id = products.id AND family_id = products.family_id
  )
WHERE family_id = 1;

-- Создаем месячную статистику вручную
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count) VALUES
(1, '2024-10', 2024, 50.20, 12580, 406, 4),
(1, '2024-11', 2024, 12.30, 1230, 41, 1)
ON CONFLICT (family_id, month, year) 
DO UPDATE SET 
  total_spent = EXCLUDED.total_spent,
  total_calories = EXCLUDED.total_calories,
  avg_calories_per_day = EXCLUDED.avg_calories_per_day,
  receipts_count = EXCLUDED.receipts_count,
  updated_at = NOW();

-- Показываем результат
SELECT 'Тестовые данные добавлены успешно!' as status;
