# ✅ Чеклист для деплоя фоновой обработки чеков

## Перед деплоем

### 1. Supabase - База данных
- [ ] Применена миграция `migration_add_pending_receipts.sql`
- [ ] Таблица `pending_receipts` создана
- [ ] Индексы созданы
- [ ] RLS политики применены

**Проверка:**
```sql
-- Должно вернуть таблицу
SELECT * FROM pending_receipts LIMIT 1;
```

### 2. Supabase - Storage
- [ ] Создан bucket `receipts`
- [ ] Bucket публичный (Public: ✅)
- [ ] Лимит размера файла: 10 MB
- [ ] Созданы 3 политики (INSERT, SELECT, DELETE)

**Проверка:**
1. Storage → receipts должен быть в списке
2. Попробовать загрузить тестовый файл вручную

### 3. Supabase - Realtime
- [ ] Realtime включен для таблицы `pending_receipts`
- [ ] Сохранены настройки

**Проверка:**
```sql
-- Должно вернуть pending_receipts
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

### 4. Vercel - Environment Variables
- [ ] `VITE_SUPABASE_URL` установлен
- [ ] `VITE_SUPABASE_ANON_KEY` установлен
- [ ] `PERPLEXITY_API_KEY` установлен

**Проверка:**
1. Vercel Dashboard → Settings → Environment Variables
2. Все 3 переменные должны быть в списке

### 5. Код
- [ ] Файлы созданы:
  - `migration_add_pending_receipts.sql`
  - `api/process-receipt.js`
- [ ] Файлы обновлены:
  - `src/lib/supabase.ts` (добавлен PendingReceipt)
  - `src/services/supabaseService.ts` (добавлены методы)
  - `src/GroceryTrackerApp.tsx` (обновлен UploadPage)
- [ ] Нет ошибок TypeScript
- [ ] Нет ошибок ESLint

**Проверка:**
```bash
npm run build
# Должно успешно собраться
```

## Деплой

### 1. Коммит изменений
```bash
git status
git add .
git commit -m "Add background receipt processing"
```

### 2. Push в репозиторий
```bash
git push origin main
```

### 3. Vercel автодеплой
- [ ] Vercel начал деплой автоматически
- [ ] Деплой завершен успешно (Status: Ready)
- [ ] Нет ошибок в логах

**Проверка:**
1. Vercel Dashboard → Deployments
2. Последний деплой должен быть зеленым ✅

### 4. Проверка API endpoints
- [ ] `/api/perplexity` доступен
- [ ] `/api/process-receipt` доступен

**Проверка:**
```bash
# Должно вернуть 405 (Method not allowed)
curl https://your-app.vercel.app/api/process-receipt

# Это нормально - значит endpoint работает
```

## После деплоя

### 1. Тестирование на продакшене

**Тест 1: Загрузка чека**
- [ ] Открыть приложение
- [ ] Перейти в "Чек"
- [ ] Загрузить фото чека
- [ ] Увидеть "Чек загружен!" через 1-2 сек
- [ ] Чек появился в списке обрабатываемых

**Тест 2: Обработка в фоне**
- [ ] Загрузить чек
- [ ] Закрыть приложение
- [ ] Подождать 15-30 секунд
- [ ] Открыть приложение снова
- [ ] Статус чека изменился на "Обработан" ✅

**Тест 3: Realtime обновления**
- [ ] Загрузить чек
- [ ] Не закрывать приложение
- [ ] Увидеть смену статусов в реальном времени:
  - ⏳ Ожидает обработки
  - 🔄 Обрабатывается
  - ✅ Обработан

**Тест 4: Проверка данных**
- [ ] После обработки чека
- [ ] Товары добавились в список
- [ ] Статистика обновилась
- [ ] Можно удалить чек из очереди

### 2. Мониторинг

**Проверить логи Vercel:**
- [ ] Перейти в Vercel Dashboard → Functions
- [ ] Открыть `/api/process-receipt`
- [ ] Проверить логи последних вызовов
- [ ] Нет ошибок

**Проверить Supabase:**
- [ ] Database → pending_receipts
- [ ] Есть записи с разными статусами
- [ ] Storage → receipts
- [ ] Есть загруженные файлы

### 3. Производительность

- [ ] Загрузка чека занимает 1-3 секунды
- [ ] Обработка чека завершается за 10-30 секунд
- [ ] Realtime обновления приходят сразу
- [ ] Нет задержек в UI

## Откат (если что-то пошло не так)

### Вариант 1: Откат кода
```bash
git revert HEAD
git push origin main
```

### Вариант 2: Откат в Vercel
1. Vercel Dashboard → Deployments
2. Найти предыдущий рабочий деплой
3. Нажать "⋯" → "Promote to Production"

### Вариант 3: Отключить функционал
В `src/GroceryTrackerApp.tsx` временно вернуть старую логику:
```typescript
// Закомментировать новый код
// const pendingReceipt = await SupabaseService.uploadReceiptForProcessing(...);

// Раскомментировать старый код
const parsedReceipt = await parseReceiptImage(file);
await SupabaseService.processReceipt(...);
```

## Частые проблемы

### ❌ Ошибка "Bucket not found"
**Решение:** Создать bucket "receipts" в Supabase Storage

### ❌ Ошибка "Permission denied"
**Решение:** Проверить политики доступа в Storage

### ❌ Чек застрял в "pending"
**Решение:** 
1. Проверить логи в Vercel
2. Проверить переменные окружения
3. Вручную вызвать API:
```bash
curl -X POST https://your-app.vercel.app/api/process-receipt \
  -H "Content-Type: application/json" \
  -d '{"pendingReceiptId": 123}'
```

### ❌ Realtime не работает
**Решение:** Включить Realtime для pending_receipts в Supabase

### ❌ Ошибка Perplexity API
**Решение:** Проверить PERPLEXITY_API_KEY и лимиты API

## Готово! 🎉

Если все пункты отмечены ✅, фоновая обработка чеков работает!

## Дополнительно

### Мониторинг в продакшене
- [ ] Настроить алерты в Vercel для ошибок
- [ ] Регулярно проверять использование Storage
- [ ] Мониторить время обработки чеков

### Оптимизация
- [ ] Настроить автоочистку старых файлов
- [ ] Добавить retry логику для failed чеков
- [ ] Добавить метрики и аналитику

### Документация
- [ ] Обновить README.md
- [ ] Добавить скриншоты нового UI
- [ ] Создать видео-инструкцию для пользователей

