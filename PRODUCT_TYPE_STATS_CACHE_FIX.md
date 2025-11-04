# Исправление медленной загрузки статистики типов продуктов

## Проблемы

### 1. **Медленная загрузка главной страницы (10 секунд)**
**Причина:** Функция `getProductTypeStats()` вызывалась каждый раз при открытии главной страницы и делала:
- Запрос на получение всех продуктов
- Для КАЖДОГО типа продукта:
  - Запрос на получение всех продуктов этого типа
  - Запрос на получение истории всех продуктов этого типа
  - Вычисления статуса

**Итого:** При 10 типах продуктов = 20+ запросов к БД на каждой загрузке!

### 2. **Неправильный статус "Кофе" после покупки сегодня**
**Причина:** Статусы не обновлялись автоматически после обработки чека. Расчет происходил заново при каждом открытии, но правило 2-х дней не всегда срабатывало из-за отсутствия кэша.

## Решение

### ✅ Кэширование статусов типов продуктов

Создана таблица `product_type_stats` для хранения предрасчитанных статусов:

```sql
CREATE TABLE product_type_stats (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  product_type VARCHAR(255) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('ending-soon', 'ok', 'calculating')),
  product_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id, product_type)
);
```

### ✅ Автоматическое обновление кэша

Кэш обновляется автоматически:

1. **При обработке чека** - триггер `trigger_product_type_stats_on_receipt_processed`
2. **При изменении продукта** - триггер `trigger_product_type_stats_on_product_change`
3. **В cron job (1:00 ночи)** - функция `recalculate_product_type_stats()`

### ✅ Правило 2-х дней

В функции `calculate_product_type_status()` реализовано правило:
**Продукт НЕ МОЖЕТ показывать статус "заканчивается" в течение 2 дней после покупки**

```sql
-- Проверяем: есть ли хоть один продукт этого типа, купленный < 2 дней назад?
FOR v_product_record IN
  SELECT id, last_purchase
  FROM products
  WHERE family_id = p_family_id 
    AND product_type = p_product_type
    AND last_purchase IS NOT NULL
LOOP
  v_days_since_purchase := v_today - v_product_record.last_purchase;
  
  IF v_days_since_purchase < 2 THEN
    v_has_recent_purchase := true;
    EXIT;
  END IF;
END LOOP;

-- Если есть недавняя покупка - статус "ok"
IF v_has_recent_purchase THEN
  RETURN 'ok';
END IF;
```

## Изменения в коде

### 1. Миграция базы данных
**Файл:** `migration_add_product_type_stats_cache.sql`

- Создана таблица `product_type_stats`
- Добавлены индексы для быстрого поиска
- Создана функция `calculate_product_type_status()`
- Создана функция `recalculate_product_type_stats()`
- Добавлены триггеры для автоматического обновления

### 2. Frontend (TypeScript)
**Файл:** `src/services/supabaseService.ts`

**До:**
```typescript
static async getProductTypeStats(familyId: number) {
  // Получаем ВСЕ продукты
  // Группируем по типам
  // Для КАЖДОГО типа вызываем calculateProductTypeStatus()
  // 20+ запросов к БД
}
```

**После:**
```typescript
static async getProductTypeStats(familyId: number) {
  // Один запрос к product_type_stats
  const { data: cachedStats } = await supabase
    .from('product_type_stats')
    .select('product_type, status, product_count')
    .eq('family_id', familyId);
  
  // Мгновенная загрузка!
}
```

**Файл:** `src/GroceryTrackerApp.tsx`

**До:**
```typescript
useEffect(() => {
  loadTypeStats()
}, [selectedFamilyId, products.length]) // Обновляем при изменении продуктов

useEffect(() => {
  if (activeTab === 'home') {
    loadTypeStats() // Второй useEffect!
  }
}, [activeTab, selectedFamilyId])
```

**После:**
```typescript
useEffect(() => {
  if (activeTab === 'home') {
    loadTypeStats() // Один useEffect, кэш обновляется автоматически
  }
}, [activeTab, selectedFamilyId])
```

### 3. Backend API

**Файл:** `api/recalculate-statuses.js` (cron job)
- Добавлен пересчет кэша типов продуктов после пересчета статусов продуктов

**Файл:** `api/process-receipt.js` (обработка чека)
- Добавлен пересчет кэша типов продуктов после обработки чека

## Инструкции по применению

### Шаг 1: Применить миграцию

```bash
# В Supabase SQL Editor выполните:
cat migration_add_product_type_stats_cache.sql
```

Или через psql:
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f migration_add_product_type_stats_cache.sql
```

### Шаг 2: Проверить таблицу

```sql
-- Проверяем, что таблица создана
SELECT * FROM product_type_stats;

-- Проверяем, что функции созданы
SELECT proname FROM pg_proc WHERE proname LIKE '%product_type_stats%';

-- Должны увидеть:
-- - calculate_product_type_status
-- - recalculate_product_type_stats
-- - trigger_recalculate_product_type_stats
-- - trigger_recalculate_product_type_stats_on_receipt
```

### Шаг 3: Проверить триггеры

```sql
-- Проверяем триггеры
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname LIKE '%product_type_stats%';

-- Должны увидеть:
-- - trigger_product_type_stats_on_product_change (на products)
-- - trigger_product_type_stats_on_receipt_processed (на receipts)
```

### Шаг 4: Проверить начальное заполнение

```sql
-- Проверяем, что кэш заполнен для всех семей
SELECT 
  pts.family_id,
  f.name AS family_name,
  pts.product_type,
  pts.status,
  pts.product_count,
  pts.last_calculated
FROM product_type_stats pts
JOIN families f ON pts.family_id = f.id
ORDER BY pts.family_id, pts.product_type;
```

Если таблица пустая, можно заполнить вручную:
```sql
-- Заполняем кэш для семьи ID=1
SELECT recalculate_product_type_stats(1);
```

### Шаг 5: Деплой кода

```bash
# Коммитим изменения
git add .
git commit -m "feat: add product type stats cache for fast loading

- Create product_type_stats table for caching
- Add triggers for automatic cache updates
- Update frontend to use cache instead of on-the-fly calculation
- Update cron job and receipt processing to recalculate cache
- Fixes 10-second loading time on home page
- Fixes incorrect status after recent purchase (2-day rule)"

# Пушим на Vercel
git push origin main
```

### Шаг 6: Тестирование

#### Тест 1: Быстрая загрузка главной страницы
1. Откройте главную страницу приложения
2. ⏱️ **Ожидаемый результат:** Статусы типов продуктов загружаются мгновенно (< 1 секунды)
3. ❌ **До:** 10 секунд загрузки
4. ✅ **После:** < 1 секунда

#### Тест 2: Правило 2-х дней после покупки
1. Загрузите чек с продуктом типа "кофе" сегодня
2. Дождитесь обработки чека (статус "completed")
3. Откройте главную страницу
4. ✅ **Ожидаемый результат:** Тип "Кофе" показывает статус "В наличии" (зеленая карточка)
5. ❌ **Не должно быть:** Статус "Заканчивается" сразу после покупки

#### Тест 3: Автоматическое обновление после обработки чека
1. Откройте главную страницу (запомните статусы)
2. Загрузите новый чек с продуктами
3. Дождитесь обработки (в консоли должно быть: "✅ Кэш статусов типов продуктов обновлен")
4. Обновите главную страницу
5. ✅ **Ожидаемый результат:** Статусы обновились автоматически

#### Тест 4: Cron job (в 1:00 ночи)
1. Проверьте логи Vercel на следующий день после 1:00
2. ✅ Должны увидеть: "✅ Кэш статусов типов продуктов пересчитан"

## Мониторинг производительности

### Проверка скорости загрузки

```sql
-- Замеряем скорость загрузки кэша
EXPLAIN ANALYZE
SELECT product_type, status, product_count
FROM product_type_stats
WHERE family_id = 1;

-- Должно быть: Execution Time < 10ms
```

### Проверка количества запросов

```typescript
// В браузере (DevTools → Network):
// До: 20+ запросов к Supabase при открытии главной
// После: 1 запрос к Supabase при открытии главной
```

### Логи триггеров

```sql
-- Проверяем, что триггеры срабатывают
-- (после добавления чека или изменения продукта)
SELECT * FROM product_type_stats
WHERE last_calculated > NOW() - INTERVAL '5 minutes'
ORDER BY last_calculated DESC;
```

## Ожидаемые результаты

| Метрика | До | После | Улучшение |
|---------|----|---------| --------- |
| Время загрузки главной | ~10 сек | < 1 сек | **10x быстрее** |
| Запросов к БД | 20+ | 1 | **20x меньше** |
| Правильность статуса "Кофе" | ❌ Неправильно | ✅ Правильно | **Исправлено** |
| Автообновление после чека | ❌ Нет | ✅ Да | **Добавлено** |

## Откат (если что-то пошло не так)

```sql
-- Удаляем триггеры
DROP TRIGGER IF EXISTS trigger_product_type_stats_on_product_change ON products;
DROP TRIGGER IF EXISTS trigger_product_type_stats_on_receipt_processed ON receipts;

-- Удаляем функции
DROP FUNCTION IF EXISTS trigger_recalculate_product_type_stats();
DROP FUNCTION IF EXISTS trigger_recalculate_product_type_stats_on_receipt();
DROP FUNCTION IF EXISTS recalculate_product_type_stats(INTEGER);
DROP FUNCTION IF EXISTS calculate_product_type_status(INTEGER, VARCHAR);

-- Удаляем таблицу
DROP TABLE IF EXISTS product_type_stats;
```

Затем откатите код на предыдущий коммит:
```bash
git revert HEAD
git push origin main
```

## FAQ

### Q: Что если кэш устареет?
**A:** Кэш обновляется автоматически через:
- Триггеры (при каждом изменении продукта/чека)
- Cron job (каждую ночь в 1:00)

### Q: Можно ли вручную обновить кэш?
**A:** Да, вызовите функцию:
```sql
SELECT recalculate_product_type_stats(1); -- для family_id = 1
```

### Q: Что если миграция не применится?
**A:** Проверьте права доступа к БД и убедитесь, что функция `update_updated_at_column()` уже существует (она должна быть создана в `database_schema.sql`).

### Q: Почему статус всё ещё показывает "заканчивается" после покупки?
**A:** Убедитесь, что:
1. Миграция применена
2. Чек успешно обработан (статус "completed")
3. В консоли браузера нет ошибок при загрузке кэша
4. `last_purchase` в таблице `products` обновился на сегодняшнюю дату

## Дополнительные улучшения (опционально)

### 1. Мониторинг в реальном времени

Добавьте в Supabase Dashboard виджет с SQL:
```sql
SELECT 
  product_type,
  status,
  product_count,
  last_calculated
FROM product_type_stats
WHERE family_id = 1
ORDER BY 
  CASE status
    WHEN 'ending-soon' THEN 1
    WHEN 'ok' THEN 2
    ELSE 3
  END,
  product_count DESC;
```

### 2. Email уведомления о заканчивающихся типах

Добавьте в cron job:
```javascript
// В конце recalculateAllProductStatuses()
const { data: endingTypes } = await supabase
  .from('product_type_stats')
  .select('product_type')
  .eq('family_id', familyId)
  .eq('status', 'ending-soon');

if (endingTypes && endingTypes.length > 0) {
  await sendEmailNotification(familyId, endingTypes);
}
```

## Заключение

Это исправление решает обе проблемы:
✅ **Загрузка в 10x быстрее** - кэш вместо расчетов на лету
✅ **Правильные статусы** - правило 2-х дней и автообновление

Кэш обновляется автоматически, не требуя вмешательства пользователя!

