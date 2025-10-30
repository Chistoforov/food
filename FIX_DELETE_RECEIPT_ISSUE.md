# Исправление проблемы с удалением чеков

## Проблема
При попытке удалить чек подтверждение проходит без ошибок, но чеки фактически не удаляются из базы данных и остаются в списке (как на localhost, так и на production).

## Причина
Проблема связана с отсутствием настроенных **Row Level Security (RLS) политик** в Supabase. По умолчанию Supabase блокирует все операции (включая DELETE), если не настроены соответствующие политики безопасности.

## Решение

### Шаг 1: Проверьте, применена ли миграция с receipt_id

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Выполните проверочный запрос:

```sql
-- Проверяем наличие поля receipt_id в product_history
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_history' 
AND column_name = 'receipt_id';
```

Если запрос не вернул результатов, выполните миграцию:

```sql
-- Применяем миграцию из файла migration_add_receipt_id.sql
ALTER TABLE product_history 
ADD COLUMN receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE;

CREATE INDEX idx_product_history_receipt_id ON product_history(receipt_id);

-- Функция для автоматического пересчета статистики при удалении записей
CREATE OR REPLACE FUNCTION recalculate_stats_on_history_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
BEGIN
    v_family_id := OLD.family_id;
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Триггер для пересчета статистики при удалении
CREATE TRIGGER recalculate_stats_on_history_delete_trigger
    AFTER DELETE ON product_history
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_history_delete();
```

### Шаг 2: Настройте RLS политики (ОСНОВНОЕ РЕШЕНИЕ)

1. В Supabase Dashboard перейдите в **SQL Editor**
2. Скопируйте и выполните содержимое файла `setup_rls_policies.sql`

Или выполните этот скрипт напрямую:

```sql
-- Включаем RLS для всех таблиц
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

-- Политики для receipts (чеки)
CREATE POLICY "Allow read access to all receipts" ON receipts
    FOR SELECT USING (true);

CREATE POLICY "Allow insert access to receipts" ON receipts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to receipts" ON receipts
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to receipts" ON receipts
    FOR DELETE USING (true);

-- Политики для product_history
CREATE POLICY "Allow read access to all product history" ON product_history
    FOR SELECT USING (true);

CREATE POLICY "Allow insert access to product history" ON product_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to product history" ON product_history
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to product history" ON product_history
    FOR DELETE USING (true);

-- Политики для остальных таблиц
CREATE POLICY "Allow read access to all products" ON products
    FOR SELECT USING (true);

CREATE POLICY "Allow insert access to products" ON products
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to products" ON products
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to products" ON products
    FOR DELETE USING (true);

CREATE POLICY "Allow read access to all families" ON families
    FOR SELECT USING (true);

CREATE POLICY "Allow insert access to families" ON families
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to families" ON families
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to families" ON families
    FOR DELETE USING (true);

CREATE POLICY "Allow read access to all monthly stats" ON monthly_stats
    FOR SELECT USING (true);

CREATE POLICY "Allow insert access to monthly stats" ON monthly_stats
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to monthly stats" ON monthly_stats
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to monthly stats" ON monthly_stats
    FOR DELETE USING (true);
```

### Шаг 3: Проверка настройки

Выполните проверочный запрос:

```sql
-- Проверяем, что RLS включен
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('families', 'products', 'receipts', 'product_history', 'monthly_stats');

-- Должны увидеть rowsecurity = true для всех таблиц

-- Проверяем созданные политики
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Должны увидеть политики для DELETE для всех таблиц
```

### Шаг 4: Тестирование

1. Обновите страницу вашего приложения (Ctrl+Shift+R или Cmd+Shift+R)
2. Попробуйте удалить чек
3. Чек должен успешно удалиться из списка

### Шаг 5: Проверка на Production

Если вы используете Vercel или другой хостинг:

1. Убедитесь, что переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` правильно настроены в настройках проекта
2. Перезапустите деплой (если необходимо)
3. Проверьте, что удаление работает и на production

## Дополнительная информация

### Как работает удаление чеков

1. Когда вы удаляете чек, вызывается функция `SupabaseService.deleteReceipt(id, familyId)`
2. Функция удаляет чек из таблицы `receipts`
3. Благодаря `ON DELETE CASCADE` все связанные записи в `product_history` удаляются автоматически
4. Триггер `recalculate_stats_on_history_delete_trigger` автоматически пересчитывает статистику
5. UI обновляется, удаляя чек из списка

### Почему это не работало

Без RLS политик Supabase блокирует операцию DELETE на уровне базы данных. Код JavaScript пытается удалить чек, но Supabase возвращает успешный ответ (без ошибки), но фактически ничего не удаляет. Это особенность работы Supabase - если нет прав на операцию, он просто игнорирует запрос.

### Альтернатива (если хотите более безопасные политики)

Вместо политик `USING (true)` можно настроить более строгие правила с аутентификацией:

```sql
-- Пример: разрешить удаление только аутентифицированным пользователям
CREATE POLICY "Allow authenticated users to delete receipts" ON receipts
    FOR DELETE
    USING (auth.role() = 'authenticated');
```

Но для текущего MVP проще использовать политики с `USING (true)`.

## Часто задаваемые вопросы

**Q: Нужно ли применять эти политики и на localhost, и на production?**  
A: Нет, политики настраиваются в Supabase Dashboard и применяются для всех подключений к этой базе данных (и localhost, и production используют одну и ту же БД Supabase).

**Q: Безопасно ли использовать USING (true)?**  
A: Для MVP и внутреннего использования - да. Для публичного приложения с множеством пользователей лучше настроить более строгие политики с проверкой аутентификации.

**Q: Что делать, если политики уже существуют?**  
A: Если вы видите ошибку "policy already exists", значит политики уже настроены. Проверьте их:

```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

Если нужно удалить существующую политику:

```sql
DROP POLICY "policy_name" ON table_name;
```

## Проверка результата

После применения всех изменений:

✅ Чеки успешно удаляются из базы данных  
✅ UI обновляется, удаляя чек из списка  
✅ Связанные записи в product_history удаляются автоматически  
✅ Статистика пересчитывается автоматически  
✅ Работает и на localhost, и на production

