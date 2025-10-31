# Исправление ошибок при загрузке чеков

## Проблема 1: Localhost - Perplexity API Error 401 (Unauthorized)

### Причина
Не настроен API ключ Perplexity для локальной разработки.

### Решение
1. Создайте файл `.env` в корне проекта (если его нет)
2. Добавьте в него следующие строки:

```env
VITE_SUPABASE_URL=ваш_supabase_project_url
VITE_SUPABASE_ANON_KEY=ваш_supabase_anon_key
VITE_PERPLEXITY_API_KEY=ваш_perplexity_api_key
```

3. **ВАЖНО:** Замените значения на ваши реальные ключи:
   - `VITE_SUPABASE_URL` - URL вашего Supabase проекта
   - `VITE_SUPABASE_ANON_KEY` - Anon key из Supabase
   - `VITE_PERPLEXITY_API_KEY` - API ключ от Perplexity.ai

4. Перезапустите прокси-сервер:
```bash
npm run proxy
```

5. Перезапустите приложение:
```bash
npm run dev
```

---

## Проблема 2: Production - JSON Parse Error "invalid input syntax for type integer: '0.14'"

### Причина
В базе данных поле `quantity` в таблице `product_history` имеет тип `INTEGER`, но Perplexity API возвращает дробные значения (например, 0.14 кг для 140 грамм).

### Решение
Выполните миграцию базы данных для изменения типа поля.

#### В Supabase Dashboard:

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Скопируйте и выполните следующий SQL:

```sql
-- Migration to fix quantity field type from INTEGER to DECIMAL
-- This fixes the "invalid input syntax for type integer: '0.14'" error

ALTER TABLE product_history 
ALTER COLUMN quantity TYPE DECIMAL(10,3);

-- Verify the change
SELECT column_name, data_type, numeric_precision, numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'product_history' AND column_name = 'quantity';
```

4. Нажмите "Run" для выполнения миграции

#### Проверка
После выполнения миграции вы должны увидеть результат:
```
column_name | data_type | numeric_precision | numeric_scale
------------|-----------|-------------------|---------------
quantity    | numeric   | 10                | 3
```

---

## Что изменено

1. **Файл миграции**: `migration_fix_quantity_decimal.sql` - для обновления существующей БД
2. **Файл схемы**: `database_schema.sql` - обновлен для новых установок

---

## Тестирование

После применения исправлений:

### Localhost
1. Убедитесь, что прокси-сервер запущен: `npm run proxy`
2. Убедитесь, что приложение запущено: `npm run dev`
3. Попробуйте загрузить чек с изображением

### Production
1. Выполните миграцию в Supabase
2. Перейдите на production сайт
3. Попробуйте загрузить чек с изображением

---

## Что поддерживается теперь

После исправления приложение поддерживает:
- ✅ Целые количества: `1`, `2`, `5` (шт)
- ✅ Дробные количества: `0.5`, `0.14`, `1.75` (кг, л)
- ✅ Большие дробные: `2.500` (2.5 кг)

Примеры:
- Молоко 1L → quantity: `1.0`
- Творог 500г → quantity: `0.5` (0.5 кг)
- Чипсы 140г → quantity: `0.14` (0.14 кг)
- Яблоки 2шт → quantity: `2.0`

---

## Если ошибки продолжаются

1. **Localhost**: Проверьте, что файл `.env` существует и содержит правильные ключи
2. **Production**: Проверьте, что миграция была выполнена успешно в Supabase
3. Проверьте консоль браузера (F12) для подробных ошибок
4. Проверьте логи в Supabase Dashboard → Logs

