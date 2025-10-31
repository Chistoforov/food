# Исправление ошибки "invalid input syntax for type integer" на продакшене

## Проблема
При загрузке чека с дробными количествами (например, 0.212 кг) возникает ошибка:
```
invalid input syntax for type integer: "0.212"
```

## Причина
В продакшн базе данных поле `quantity` в таблице `product_history` имеет тип `INTEGER` вместо `DECIMAL(10,3)`.

## Решение

### Шаг 1: Войдите в Supabase Dashboard
1. Откройте https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor** (левое меню)

### Шаг 2: Примените миграцию
Скопируйте и выполните следующий SQL код:

```sql
-- Migration to fix quantity field type from INTEGER to DECIMAL
-- This fixes the "invalid input syntax for type integer: '0.212'" error
-- when processing receipts with fractional quantities

-- Update product_history table to support decimal quantities
ALTER TABLE product_history 
ALTER COLUMN quantity TYPE DECIMAL(10,3);

-- Update the comment to reflect the change
COMMENT ON COLUMN product_history.quantity IS 'Product quantity (supports decimal values like 0.14 kg, 1.5 L, etc.)';
```

### Шаг 3: Проверьте результат
Выполните следующий запрос для проверки:

```sql
SELECT column_name, data_type, numeric_precision, numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'product_history' AND column_name = 'quantity';
```

Должен вернуться результат:
- `column_name`: quantity
- `data_type`: numeric
- `numeric_precision`: 10
- `numeric_scale`: 3

### Шаг 4: Проверьте работу приложения
После применения миграции попробуйте загрузить чек с дробными количествами (например, товары на вес).

## Как это работает

Теперь поле `quantity` может хранить:
- Целые числа: 1, 2, 3
- Дробные числа: 0.212, 0.5, 1.5
- До 3 знаков после запятой: 0.001, 0.999

## Что делать, если есть испорченные данные

Если чеки были частично обработаны с ошибкой, могут остаться несогласованные данные. Проверьте:

```sql
-- Проверить последние чеки
SELECT id, date, items_count, total_amount, status
FROM receipts
WHERE family_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- Проверить последние записи в истории покупок
SELECT ph.id, ph.date, ph.quantity, p.name, ph.price
FROM product_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.family_id = 1
ORDER BY ph.created_at DESC
LIMIT 20;
```

Если найдете чеки со статусом "processed" но без соответствующих записей в `product_history`, можно удалить их через интерфейс приложения (на вкладке "Чек") и загрузить заново.

## Важно
После применения миграции рекомендуется:
1. Пересчитать статистику (кнопка "Обновить" на главной странице)
2. Проверить, что все товары отображаются корректно
3. Загрузить новый чек для проверки

## Техническая информация

### Старая схема
```sql
quantity INTEGER DEFAULT 1
```

### Новая схема
```sql
quantity DECIMAL(10,3) DEFAULT 1
```

Это позволяет хранить количество с точностью до 3 знаков после запятой, что необходимо для товаров на вес (кг, литры, граммы).

