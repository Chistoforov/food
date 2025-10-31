# Автоматическое удаление товаров при удалении чеков

## Описание функциональности

Система теперь автоматически удаляет товары, которые остались без истории покупок после удаления чека. Это обеспечивает чистоту данных и корректность статистики.

## Как это работает

### 1. Каскадное удаление истории покупок

При удалении чека:
- Автоматически удаляются все записи из `product_history`, связанные с этим чеком
- Это настроено через `ON DELETE CASCADE` на внешнем ключе `receipt_id`

### 2. Автоматическое удаление товаров без истории

После удаления записей из `product_history`:
- Триггер `cleanup_products_after_history_delete` проверяет все затронутые товары
- Если у товара не осталось записей в истории покупок, товар удаляется полностью
- Это гарантирует, что товары не остаются "сиротами" в базе данных

### 3. Автоматический пересчет статистики

После удаления чека:
- Триггер `recalculate_stats_on_receipt_delete` автоматически пересчитывает статистику
- Обновляется `monthly_stats` для месяца, в котором был удален чек
- Все показатели (траты, калории, количество чеков) обновляются корректно

## Архитектура решения

```
┌─────────────────┐
│  DELETE RECEIPT │
└────────┬────────┘
         │
         ▼
┌───────────────────────────────┐
│ CASCADE: Delete product_history│  ← ON DELETE CASCADE
└───────────┬───────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ TRIGGER: cleanup_products_after_    │
│          history_delete              │
│                                      │
│ • Проверяет товары без истории      │
│ • Удаляет "сиротские" товары        │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ TRIGGER: recalculate_stats_after_   │
│          receipt_delete              │
│                                      │
│ • Пересчитывает monthly_stats       │
│ • Обновляет траты и калории         │
└─────────────────────────────────────┘
```

## Применение миграции

### Шаг 1: Выполнить SQL миграцию

```bash
# Подключитесь к вашей базе данных Supabase
# Выполните файл миграции
psql YOUR_DATABASE_URL -f migration_auto_delete_products.sql
```

Или через Supabase Dashboard:
1. Откройте SQL Editor в Supabase Dashboard
2. Скопируйте содержимое файла `migration_auto_delete_products.sql`
3. Выполните запрос

### Шаг 2: Проверка

Проверьте, что триггеры созданы:

```sql
-- Проверка триггеров
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
    'cleanup_products_after_history_delete',
    'recalculate_stats_on_receipt_delete'
);
```

Ожидаемый результат:
```
trigger_name                          | event_manipulation | event_object_table
--------------------------------------+--------------------+-------------------
cleanup_products_after_history_delete | DELETE            | product_history
recalculate_stats_on_receipt_delete  | DELETE            | receipts
```

## Примеры использования

### Пример 1: Удаление чека с уникальными товарами

```javascript
// До удаления
const products = await SupabaseService.getProducts(familyId)
// Результат: [Product A, Product B, Product C]

// Удаляем чек #123, который содержал только Product C
await SupabaseService.deleteReceipt(123, familyId)

// После удаления
const productsAfter = await SupabaseService.getProducts(familyId)
// Результат: [Product A, Product B]
// Product C удален автоматически, так как больше нет истории
```

### Пример 2: Удаление чека с общими товарами

```javascript
// Product A куплен в чеках #100 и #200
// Удаляем чек #100
await SupabaseService.deleteReceipt(100, familyId)

// Product A НЕ удаляется, так как есть история из чека #200
const products = await SupabaseService.getProducts(familyId)
// Product A все еще в списке
```

### Пример 3: Автоматический пересчет статистики

```javascript
// До удаления
const statsBefore = await SupabaseService.getMonthlyStats(familyId, '10', 2024)
// total_spent: 500.00, receipts_count: 10

// Удаляем чек на 50.00
await SupabaseService.deleteReceipt(123, familyId)

// После удаления (автоматически пересчитано)
const statsAfter = await SupabaseService.getMonthlyStats(familyId, '10', 2024)
// total_spent: 450.00, receipts_count: 9
```

## Тестирование

### Ручное тестирование

1. Создайте тестовый чек с товарами:
```sql
-- Создать чек
INSERT INTO receipts (family_id, date, items_count, total_amount, status)
VALUES (1, '2024-10-31', 2, 100.00, 'processed')
RETURNING id;  -- Запомните id, например 999

-- Создать товары
INSERT INTO products (family_id, name, calories, price, purchase_count)
VALUES 
    (1, 'Test Product 1', 100, 50.00, 1),
    (1, 'Test Product 2', 200, 50.00, 1)
RETURNING id;  -- Запомните id товаров

-- Создать историю
INSERT INTO product_history (product_id, family_id, date, quantity, price, unit_price, receipt_id)
VALUES 
    (PRODUCT_ID_1, 1, '2024-10-31', 1, 50.00, 50.00, 999),
    (PRODUCT_ID_2, 1, '2024-10-31', 1, 50.00, 50.00, 999);
```

2. Удалите чек:
```sql
DELETE FROM receipts WHERE id = 999;
```

3. Проверьте результат:
```sql
-- Товары должны быть удалены
SELECT * FROM products WHERE name LIKE 'Test Product%';
-- Должно вернуть 0 строк

-- История должна быть удалена
SELECT * FROM product_history WHERE receipt_id = 999;
-- Должно вернуть 0 строк

-- Статистика должна быть пересчитана
SELECT * FROM monthly_stats WHERE family_id = 1 AND month = '2024-10';
```

### Автоматическое тестирование

```bash
# Создайте тестовый скрипт
node test_auto_delete_products.js
```

## Важные замечания

### ⚠️ Безопасность данных

- **Товары с историей из других чеков НЕ удаляются** - только товары без истории
- **Каскадное удаление работает автоматически** - не требуется ручное вмешательство
- **Статистика обновляется автоматически** - данные всегда актуальны

### 🔍 Мониторинг

В консоли приложения вы увидите логи:
```
🗑️ Удаляем чек #123 из базы данных...
✅ Чек успешно удален из базы данных
🔄 Автоматическое удаление связанных товаров и пересчет статистики...
✅ Статистика пересчитана на клиенте
```

В логах PostgreSQL (если включены):
```
NOTICE: Удален продукт #456 (больше нет истории покупок)
NOTICE: Пересчитана статистика за 2024-10 после удаления чека #123
```

### 📊 Влияние на производительность

- **Минимальное** - триггеры работают на уровне БД очень эффективно
- **Batch операции** - триггер обрабатывает все удаленные строки за один раз
- **Оптимизированные запросы** - используются индексы на `product_id` и `receipt_id`

## Откат изменений

Если нужно отключить автоматическое удаление:

```sql
-- Удалить триггеры
DROP TRIGGER IF EXISTS cleanup_products_after_history_delete ON product_history;
DROP TRIGGER IF EXISTS recalculate_stats_on_receipt_delete ON receipts;

-- Удалить функции
DROP FUNCTION IF EXISTS delete_products_without_history();
DROP FUNCTION IF EXISTS recalculate_stats_after_receipt_delete();
```

## Совместимость

- ✅ PostgreSQL 12+
- ✅ Supabase (все версии)
- ✅ Существующие данные не затрагиваются
- ✅ Обратная совместимость с существующими триггерами

## Поддержка

При возникновении проблем:
1. Проверьте логи PostgreSQL
2. Убедитесь, что триггеры созданы (см. "Проверка" выше)
3. Проверьте права доступа к таблицам
4. Убедитесь, что RLS (Row Level Security) не блокирует операции

## История изменений

### v1.0.0 (2024-10-31)
- ✨ Добавлено автоматическое удаление товаров без истории
- ✨ Добавлен автоматический пересчет статистики при удалении чека
- 🔧 Улучшены логи и мониторинг операций удаления

