# Исправление бага удаления чеков

## 🐛 Проблема

При удалении чека возникала ошибка:
```
DELETE https://...supabase.co/rest/v1/receipts?id=eq.64 400 (Bad Request)
Ошибка удаления чека: {code: '22P02', details: null, hint: null, message: 'invalid input syntax for type integer: "2025-10"'}
```

## 🔍 Причина

В триггерах удаления чеков (`recalculate_stats_after_receipt_delete` и `recalculate_stats_on_history_delete`) в функцию `recalculate_monthly_stats` передавался неправильный формат месяца:

**Было:**
```sql
PERFORM recalculate_monthly_stats(OLD.family_id, v_year || '-' || v_month, v_year);
-- Передавалось: "2025-10" вместо "10"
```

**Должно быть:**
```sql
PERFORM recalculate_monthly_stats(OLD.family_id, v_month, v_year);
-- Передается: "10"
```

Функция `recalculate_monthly_stats` ожидает параметры:
- `p_family_id INTEGER` (ID семьи)
- `p_month VARCHAR(10)` (месяц в формате "10", а не "2025-10")
- `p_year INTEGER` (год)

## ✅ Решение

### Шаг 1: Применить SQL скрипт в Supabase

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Скопируйте и выполните содержимое файла `fix_delete_receipt_trigger.sql`

Этот скрипт:
- ✅ Исправляет функцию `recalculate_stats_after_receipt_delete()`
- ✅ Исправляет функцию `recalculate_stats_on_history_delete()`
- ✅ Проверяет наличие триггеров
- ✅ Выводит статус исправления

### Шаг 2: Проверить что исправление работает

После применения скрипта попробуйте удалить чек:

1. Откройте приложение
2. Перейдите на страницу "Загрузить чек"
3. Найдите любой чек в списке
4. Нажмите на иконку корзины
5. Подтвердите удаление

Чек должен удалиться без ошибок!

## 📝 Что было исправлено

### Файлы в коде (уже исправлены):
- ✅ `migration_auto_delete_products.sql` - исправлен вызов функции
- ✅ `migration_add_receipt_id.sql` - исправлен вызов функции

### Файл для продакшена:
- ✅ `fix_delete_receipt_trigger.sql` - SQL скрипт для исправления в Supabase

## 🧪 Тестирование

После применения исправления проверьте:

1. **Удаление чека** - чек удаляется без ошибок
2. **Пересчет статистики** - статистика пересчитывается корректно
3. **Удаление связанных товаров** - товары без истории покупок удаляются
4. **Консоль браузера** - нет ошибок 400 (Bad Request)

## ❓ Если проблема осталась

Если после применения скрипта проблема не исчезла:

1. Проверьте, что скрипт выполнился без ошибок в SQL Editor
2. Проверьте логи в консоли браузера (F12)
3. Проверьте, что триггеры существуют:

```sql
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname IN ('recalculate_stats_on_receipt_delete', 'recalculate_stats_on_history_delete_trigger');
```

4. Попробуйте пересоздать триггеры полностью, выполнив `migration_auto_delete_products.sql` заново

## 📚 Дополнительная информация

- Функция `recalculate_monthly_stats` находится в файле `database_schema.sql`
- Триггеры создаются в файле `migration_auto_delete_products.sql`
- Логика удаления чеков в `src/services/supabaseService.ts` (метод `deleteReceipt`)

