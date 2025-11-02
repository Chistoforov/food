# 🔔 Инструкция по включению Realtime в Supabase

## Проблема

Приложение не обновляет статус чеков автоматически в реальном времени. Статус обновляется только при перезагрузке страницы.

## Решение

Необходимо включить Realtime для таблицы `pending_receipts` в Supabase Dashboard.

## Шаги по включению Realtime

### Шаг 1: Войти в Supabase Dashboard

1. Откройте [https://supabase.com](https://supabase.com)
2. Войдите в свой аккаунт
3. Выберите ваш проект

### Шаг 2: Включить Realtime для таблицы pending_receipts

#### Вариант A: Через Database → Replication (Рекомендуется)

1. Перейдите в раздел **Database** → **Replication**
2. Найдите таблицу `pending_receipts` в списке
3. Включите переключатель рядом с таблицей (должен стать зеленым) ✅
4. Нажмите кнопку **Save** или **Apply changes**

#### Вариант B: Через SQL Editor

Если не можете найти раздел Replication, выполните следующий SQL запрос:

```sql
-- Включаем Realtime для таблицы pending_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE pending_receipts;
```

### Шаг 3: Проверить что Realtime включен

Выполните следующий SQL запрос в **SQL Editor**:

```sql
-- Проверяем включен ли Realtime для pending_receipts
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'pending_receipts';
```

**Ожидаемый результат:**
```
schemaname | tablename
-----------+------------------
public     | pending_receipts
```

Если таблица `pending_receipts` есть в результате - Realtime включен ✅

### Шаг 4: Проверить RLS политики

Убедитесь, что RLS политики для `pending_receipts` настроены правильно:

```sql
-- Проверяем политики
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'pending_receipts';
```

**Должны быть минимум 3 политики:**
1. `Users can view their family's pending receipts` (SELECT)
2. `Users can insert pending receipts for their family` (INSERT)
3. `Users can update their family's pending receipts` (UPDATE)

## Что изменилось в коде

### 1. Сохранение текущей вкладки (✅ Реализовано)

Приложение теперь автоматически сохраняет текущую вкладку в `localStorage` и восстанавливает её при перезагрузке страницы. Вы больше не будете возвращаться на главную страницу при обновлении.

### 2. Улучшенная Realtime подписка (✅ Реализовано)

- Добавлено подробное логирование всех realtime событий
- Подписка теперь обрабатывает все типы событий (INSERT, UPDATE, DELETE)
- Добавлен статус подписки и обработка ошибок

### 3. Автоматическое удаление завершенных чеков (✅ Улучшено)

- Завершенные чеки автоматически удаляются через 3 секунды
- Добавлено подробное логирование процесса
- После удаления чека автоматически обновляется статистика

## Отладка

### Проверка в браузере

1. Откройте DevTools (F12)
2. Перейдите на вкладку Console
3. Загрузите чек
4. Следите за логами:

```
🔔 Создаем realtime подписку на pending_receipts для family: 1
📡 Статус подписки: CONNECTING
✅ Успешно подписались на realtime обновления pending_receipts
📡 Realtime событие получено: { type: 'UPDATE', ... }
✅ Вызываем callback с данными: { id: 123, status: 'completed', ... }
⏱️ Запускаем таймер автоудаления для чека: 123
🗑️ Автоматически удаляем завершенный чек: 123
✅ Чек успешно удален
```

### Типичные проблемы

#### 1. Realtime не подключается

**Проблема:** В консоли нет сообщения "✅ Успешно подписались на realtime обновления"

**Решение:**
- Проверьте что Realtime включен для `pending_receipts`
- Проверьте переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
- Перезапустите приложение

#### 2. Realtime подключается, но события не приходят

**Проблема:** Видите "✅ Успешно подписались", но нет "📡 Realtime событие получено"

**Решение:**
- Проверьте RLS политики для `pending_receipts`
- Убедитесь что `family_id` правильный
- Проверьте что API обработки чека правильно обновляет статус

#### 3. События приходят, но UI не обновляется

**Проблема:** Видите события в консоли, но интерфейс не обновляется

**Решение:**
- Проверьте что callback вызывается: "✅ Вызываем callback с данными"
- Проверьте что `loadPendingReceipts()` вызывается
- Проверьте что нет ошибок JavaScript в консоли

## Дополнительная информация

### Как работает Realtime

1. Пользователь загружает чек → статус `pending`
2. API обрабатывает чек → статус `processing`
3. API завершает обработку → статус `completed`
4. Supabase Realtime отправляет событие UPDATE всем подписчикам
5. Приложение получает событие и обновляет UI
6. Через 3 секунды чек автоматически удаляется

### Архитектура

```
Пользователь
    ↓
[Загрузка чека]
    ↓
Supabase Storage
    ↓
pending_receipts (status: pending)
    ↓
Vercel API (process-receipt)
    ↓
pending_receipts (status: processing)
    ↓
Perplexity AI
    ↓
pending_receipts (status: completed) ← Realtime событие
    ↓
Приложение обновляет UI
    ↓
Автоудаление через 3 сек
```

## Контакты

Если проблема не решена:
1. Проверьте консоль браузера на наличие ошибок
2. Проверьте логи в Supabase Dashboard → Database → Logs
3. Проверьте логи в Vercel Dashboard → Functions → Logs

