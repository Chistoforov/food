-- Исправление типа поля quantity для поддержки дробных значений
-- Применить этот SQL в Supabase Dashboard -> SQL Editor

-- Шаг 1: Изменить тип данных поля quantity
ALTER TABLE product_history 
ALTER COLUMN quantity TYPE DECIMAL(10,3);

-- Шаг 2: Добавить комментарий
COMMENT ON COLUMN product_history.quantity IS 'Product quantity (supports decimal values like 0.14 kg, 1.5 L, etc.)';

-- Шаг 3: Проверить результат
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'product_history' 
AND column_name = 'quantity';

-- Ожидаемый результат:
-- column_name | data_type | numeric_precision | numeric_scale
-- quantity    | numeric   | 10                | 3

-- Готово! Теперь можно загружать чеки с дробными количествами.

