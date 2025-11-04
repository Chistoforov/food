# Миграция: Добавление функций пересчета аналитики

## Проблема

При нажатии кнопки "Сброс кэша" возникает ошибка:
```
Error: invalid input syntax for type integer: "2025-10"
```

## Причина

Функции `recalculate_family_analytics` и `recalculate_all_analytics` не были созданы в базе данных, но код пытается их вызывать.

## Решение

Добавляем две новые функции в базу данных:
1. `recalculate_family_analytics(p_family_id INTEGER)` - пересчитывает всю аналитику для конкретной семьи
2. `recalculate_all_analytics()` - пересчитывает аналитику для всех активных семей

## Применение миграции

### Способ 1: Через Supabase Dashboard (рекомендуется)

1. Откройте Supabase Dashboard: https://app.supabase.com
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**
4. Скопируйте содержимое файла `migration_add_recalculate_family_analytics.sql`
5. Вставьте в редактор и нажмите **Run**

### Способ 2: Через Supabase CLI

```bash
# Убедитесь, что у вас установлен Supabase CLI
supabase db push migration_add_recalculate_family_analytics.sql
```

## Что делают новые функции

### recalculate_family_analytics(p_family_id INTEGER)

Эта функция выполняет полный пересчет аналитики для указанной семьи:

1. **Пересчитывает статистику продуктов**:
   - Вызывает `update_product_analytics()` для каждого продукта
   - Обновляет `avg_days`, `predicted_end`, `status` для всех продуктов

2. **Пересчитывает месячную статистику**:
   - Находит все месяцы с покупками из `product_history` и `receipts`
   - Вызывает `recalculate_monthly_stats()` для каждого месяца
   - Обновляет `total_spent`, `total_calories`, `avg_calories_per_day`, `receipts_count`

### recalculate_all_analytics()

Эта функция вызывает `recalculate_family_analytics()` для всех активных семей в системе.

## Проверка установки

После применения миграции выполните в SQL Editor:

```sql
-- Проверить, что функции созданы
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('recalculate_family_analytics', 'recalculate_all_analytics');

-- Должно вернуть 2 строки:
-- recalculate_family_analytics | FUNCTION
-- recalculate_all_analytics    | FUNCTION
```

## Тестирование

После применения миграции:

1. Откройте приложение
2. Перейдите на вкладку **Продукты**
3. Нажмите кнопку **Сброс кэша**
4. Убедитесь, что ошибка больше не появляется
5. Проверьте, что статистика корректно пересчиталась

## Откат (если нужно)

Если что-то пошло не так, можно удалить функции:

```sql
DROP FUNCTION IF EXISTS recalculate_family_analytics(INTEGER);
DROP FUNCTION IF EXISTS recalculate_all_analytics();
```

## Связанные файлы

- `migration_add_recalculate_family_analytics.sql` - SQL файл миграции
- `src/services/supabaseService.ts` - TypeScript сервис, вызывающий функции
- `src/hooks/useSupabaseData.ts` - React хук, использующий функции
- `src/GroceryTrackerApp.tsx` - UI компонент с кнопкой "Сброс кэша"

## Дата создания

4 ноября 2025

## Автор

AI Assistant (Claude)

