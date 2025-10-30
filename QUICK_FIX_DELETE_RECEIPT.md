# Быстрое исправление удаления чеков

## Проблема
Чеки не удаляются из базы данных, хотя подтверждение проходит без ошибок.

## Быстрое решение (3 минуты)

### 1. Откройте Supabase Dashboard
Перейдите на https://supabase.com → Ваш проект → SQL Editor

### 2. Скопируйте и выполните этот SQL-скрипт:

```sql
-- Включаем RLS для всех таблиц
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

-- Создаем политики для удаления
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);
CREATE POLICY "Allow all operations on products" ON products USING (true);
CREATE POLICY "Allow all operations on families" ON families USING (true);
CREATE POLICY "Allow all operations on monthly_stats" ON monthly_stats USING (true);

-- Проверяем, что миграция с receipt_id применена
ALTER TABLE product_history 
ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_history_receipt_id ON product_history(receipt_id);
```

### 3. Обновите страницу приложения
- Нажмите Ctrl+Shift+R (Windows/Linux) или Cmd+Shift+R (Mac)

### 4. Попробуйте удалить чек
Теперь удаление должно работать! ✅

---

## Что это делает?

- **RLS (Row Level Security)** - включает систему безопасности Supabase
- **Политики** - разрешают все операции (чтение, запись, удаление)
- **receipt_id** - связывает записи истории с чеками для автоматического удаления

## Если не работает

1. Проверьте, что скрипт выполнился без ошибок
2. Откройте консоль браузера (F12) и посмотрите на ошибки
3. Попробуйте удалить чек снова
4. Если всё равно не работает - см. подробное руководство в файле `FIX_DELETE_RECEIPT_ISSUE.md`

## Проверка

Выполните в SQL Editor:

```sql
-- Должен показать rowsecurity = true
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('receipts', 'product_history');

-- Должен показать созданные политики
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('receipts', 'product_history');
```

