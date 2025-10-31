# 🚀 Быстрый старт: Фоновая обработка чеков

## Что нужно сделать

### 1. Применить миграцию БД (5 минут)

В Supabase Dashboard → SQL Editor:

```sql
-- Скопировать и выполнить содержимое файла:
migration_add_pending_receipts.sql
```

### 2. Создать Storage Bucket (5 минут)

В Supabase Dashboard → Storage:

1. **Create bucket:**
   - Name: `receipts`
   - Public: ✅ Включить
   - File size limit: 10 MB

2. **Создать политики (Policies):**

В Storage → receipts → Policies → New policy:

**Политика 1 - Upload:**
```sql
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);
```

**Политика 2 - View:**
```sql
CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');
```

**Политика 3 - Delete:**
```sql
CREATE POLICY "Users can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);
```

### 3. Включить Realtime (2 минуты)

В Supabase Dashboard → Database → Replication:

- Найти таблицу `pending_receipts`
- Включить переключатель ✅
- Сохранить

### 4. Проверить переменные окружения (2 минуты)

В Vercel Dashboard → Settings → Environment Variables:

Должны быть установлены:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `PERPLEXITY_API_KEY`

### 5. Деплой (1 минута)

```bash
git add .
git commit -m "Add background receipt processing"
git push origin main
```

Vercel автоматически задеплоит.

## Готово! 🎉

Теперь пользователи могут:
- ✅ Загружать чеки за 1-2 секунды
- ✅ Закрывать приложение во время обработки
- ✅ Видеть статус обработки в реальном времени

## Проверка работы

1. Открыть приложение
2. Перейти в "Чек"
3. Загрузить фото чека
4. Увидеть "Чек загружен!" через 1-2 секунды
5. Закрыть приложение (опционально)
6. Вернуться - увидеть статус обработки

## Что изменилось

**Было:**
- Загрузка чека: ⏳ 10-15 секунд
- Нужно ждать до конца
- Нельзя закрыть приложение

**Стало:**
- Загрузка чека: ⚡ 1-2 секунды
- Можно сразу закрыть
- Обработка в фоне
- Live-обновление статуса

## Нужна помощь?

Смотрите подробные инструкции:
- `BACKGROUND_RECEIPT_PROCESSING.md` - полная документация
- `SETUP_STORAGE_BUCKET.md` - настройка Storage

