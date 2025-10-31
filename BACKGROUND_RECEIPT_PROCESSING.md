# Фоновая обработка чеков 🚀

## Описание

Реализована система фоновой обработки чеков, которая позволяет:
- ✅ Загрузить чек и сразу закрыть приложение
- ✅ Обработка продолжается на сервере автоматически
- ✅ Отслеживание статуса обработки в реальном времени
- ✅ Уведомления о завершении обработки

## Архитектура

### 1. Компоненты системы

```
Пользователь → Фронтенд → Supabase Storage → Vercel API → Perplexity AI
                    ↓                               ↓
              Supabase DB ←──────── Обработка ←──────┘
                    ↓
              Realtime Updates → Пользователь
```

### 2. Таблица pending_receipts

Очередь для обработки чеков:

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | ID записи |
| family_id | int | ID семьи |
| image_url | text | Путь к изображению в Storage |
| status | enum | pending / processing / completed / failed |
| error_message | text | Сообщение об ошибке (если есть) |
| parsed_data | jsonb | Распарсенные данные чека |
| created_at | timestamp | Время создания |
| processed_at | timestamp | Время обработки |
| attempts | int | Количество попыток обработки |

### 3. Supabase Storage Bucket: "receipts"

Хранилище изображений чеков:
- Структура: `{family_id}/{timestamp}.{ext}`
- Публичный доступ для чтения (для передачи в Perplexity API)
- Автоматическая очистка старых файлов (опционально)

## Процесс работы

### Загрузка чека

1. **Пользователь выбирает изображение чека**
   - Валидация: только изображения, макс. 10MB
   
2. **Быстрая загрузка (1-2 секунды)**
   - Изображение загружается в Supabase Storage
   - Создается запись в `pending_receipts` со статусом `pending`
   - Пользователь видит сообщение "Чек загружен!"
   
3. **Триггер фоновой обработки**
   - Вызывается Vercel API endpoint `/api/process-receipt`
   - Fire-and-forget - пользователь не ждет
   - Можно закрыть приложение

### Фоновая обработка

1. **Vercel API получает запрос**
   - Получает ID pending receipt из запроса
   - Обновляет статус на `processing`
   
2. **Обработка изображения**
   - Получает публичный URL изображения из Storage
   - Отправляет в Perplexity AI для парсинга
   - Парсит JSON ответ
   
3. **Сохранение в БД**
   - Создает запись в `receipts`
   - Создает/обновляет записи в `products`
   - Добавляет записи в `product_history`
   - Пересчитывает статистику
   
4. **Обновление статуса**
   - Статус меняется на `completed` или `failed`
   - Сохраняются распарсенные данные

### Отслеживание прогресса

1. **Realtime подписка**
   - Фронтенд подписан на изменения в `pending_receipts`
   - При изменении статуса UI обновляется автоматически
   
2. **Список обрабатываемых чеков**
   - Показывает все чеки с их статусами
   - Иконки статусов: ⏳ pending, 🔄 processing, ✅ completed, ❌ failed
   - Кнопка удаления для завершенных/проваленных чеков

## Настройка

### 1. Применить миграцию БД

```bash
# В Supabase SQL Editor выполнить:
psql -f migration_add_pending_receipts.sql
```

### 2. Создать Storage Bucket

В Supabase Dashboard:

1. Перейти в **Storage** → **Create bucket**
2. Имя: `receipts`
3. Настройки:
   - ✅ Public bucket (для публичного доступа к URL)
   - File size limit: 10 MB
   
4. **Создать политики доступа (Policies):**

```sql
-- Политика для INSERT (загрузка файлов)
CREATE POLICY "Users can upload receipts for their family"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' AND
  auth.uid() IS NOT NULL
);

-- Политика для SELECT (чтение файлов)
CREATE POLICY "Anyone can view receipt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Политика для DELETE (удаление старых файлов)
CREATE POLICY "Users can delete their family receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts' AND
  auth.uid() IS NOT NULL
);
```

### 3. Добавить переменные окружения

В `.env.local`:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
PERPLEXITY_API_KEY=your_perplexity_key
```

В Vercel (Settings → Environment Variables):

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
PERPLEXITY_API_KEY=your_perplexity_key
```

### 4. Деплой на Vercel

```bash
git add .
git commit -m "Add background receipt processing"
git push origin main
```

Vercel автоматически задеплоит изменения.

## Использование

### Для пользователя

1. **Загрузить чек**
   - Открыть вкладку "Чек"
   - Нажать "Камера" или "Галерея"
   - Выбрать изображение чека
   
2. **Быстрая загрузка**
   - Увидеть сообщение "Чек загружен!"
   - Можно сразу закрыть приложение
   
3. **Отслеживание прогресса**
   - Вернуться в приложение в любое время
   - Увидеть список обрабатываемых чеков
   - Статусы обновляются в реальном времени
   
4. **Результат**
   - После обработки статус меняется на "Обработан"
   - Показывается количество добавленных товаров
   - Статистика автоматически обновляется

### API методы

```typescript
// Загрузить чек для обработки
const pendingReceipt = await SupabaseService.uploadReceiptForProcessing(
  familyId,
  imageFile
);

// Запустить фоновую обработку (fire-and-forget)
await SupabaseService.triggerReceiptProcessing(pendingReceipt.id);

// Получить список обрабатываемых чеков
const receipts = await SupabaseService.getPendingReceipts(familyId);

// Подписаться на обновления (Realtime)
const unsubscribe = SupabaseService.subscribeToPendingReceipts(
  familyId,
  (receipt) => {
    console.log('Receipt updated:', receipt);
  }
);

// Удалить обработанный чек из очереди
await SupabaseService.deletePendingReceipt(receiptId);
```

## Преимущества

### 1. Лучший UX
- ✅ Пользователь не ждет обработку (1-2 сек вместо 10-15 сек)
- ✅ Можно закрыть приложение
- ✅ Можно загрузить несколько чеков подряд
- ✅ Отслеживание прогресса в реальном времени

### 2. Надежность
- ✅ Обработка не прерывается при закрытии приложения
- ✅ Можно повторить обработку при ошибке
- ✅ Логирование всех ошибок
- ✅ Retry механизм (через attempts)

### 3. Масштабируемость
- ✅ Vercel Serverless Functions автоматически масштабируются
- ✅ Нет ограничений на количество одновременных обработок
- ✅ Supabase Storage оптимизирован для больших объемов

### 4. Мониторинг
- ✅ Видны все чеки в очереди
- ✅ Статистика по обработке
- ✅ Логи ошибок в Vercel и Supabase

## Устранение проблем

### Чек застрял в статусе "pending"

**Причина:** API endpoint не был вызван или произошла ошибка

**Решение:**
1. Проверить логи в Vercel Dashboard
2. Проверить переменные окружения
3. Вручную вызвать обработку:

```bash
curl -X POST https://your-app.vercel.app/api/process-receipt \
  -H "Content-Type: application/json" \
  -d '{"pendingReceiptId": 123}'
```

### Ошибка "Storage bucket not found"

**Причина:** Bucket "receipts" не создан в Supabase

**Решение:**
1. Создать bucket в Supabase Dashboard → Storage
2. Настроить политики доступа (см. раздел "Настройка")

### Ошибка Perplexity API

**Причина:** Неверный API ключ или лимит запросов

**Решение:**
1. Проверить `PERPLEXITY_API_KEY` в Vercel
2. Проверить лимиты на https://perplexity.ai/settings/api
3. Проверить формат изображения (макс. 10MB)

### Realtime не обновляет UI

**Причина:** Realtime не настроен в Supabase

**Решение:**
1. В Supabase Dashboard → Database → Replication
2. Включить Realtime для таблицы `pending_receipts`
3. Перезагрузить приложение

## Очистка данных

### Автоматическая очистка (опционально)

Можно настроить автоматическую очистку старых записей:

```sql
-- Создать функцию для очистки (уже есть в миграции)
SELECT cleanup_old_pending_receipts();

-- Настроить pg_cron (если доступен)
SELECT cron.schedule(
  'cleanup-old-pending-receipts',
  '0 0 * * *', -- Каждый день в полночь
  $$SELECT cleanup_old_pending_receipts()$$
);
```

### Ручная очистка

```sql
-- Удалить завершенные чеки старше 7 дней
DELETE FROM pending_receipts
WHERE status IN ('completed', 'failed')
AND created_at < NOW() - INTERVAL '7 days';

-- Удалить изображения из Storage (в Supabase Dashboard)
```

## Будущие улучшения

- [ ] Push-уведомления о завершении обработки
- [ ] Автоматический retry при ошибках
- [ ] Пакетная обработка нескольких чеков
- [ ] Приоритизация обработки (VIP пользователи)
- [ ] Статистика по времени обработки
- [ ] Кэширование результатов для похожих чеков

## Заключение

Система фоновой обработки чеков значительно улучшает пользовательский опыт и надежность приложения. Пользователи могут загружать чеки без ожидания, а обработка происходит автоматически на сервере.

