-- Миграция для добавления поля original_name в таблицу products
-- Выполните этот SQL в вашей базе данных Supabase

-- Добавляем новое поле original_name
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Добавляем комментарий к полю
COMMENT ON COLUMN products.original_name IS 'Оригинальное название продукта с чека (как написано в магазине)';

-- Для существующих записей можно скопировать значение из name, если нужно
-- UPDATE products SET original_name = name WHERE original_name IS NULL;

