# Исправление пересчета аналитики при удалении чеков

## 🎯 Проблема
При удалении чеков аналитика не пересчитывалась автоматически, что приводило к некорректным данным в статистике.

## ✅ Решение
Создана система автоматического пересчета аналитики при удалении чеков с помощью триггеров базы данных и функций приложения.

## 📋 Что нужно сделать

### 1. Применить SQL скрипты в Supabase

Выполните следующие скрипты в Supabase SQL Editor в указанном порядке:

#### Шаг 1: Исправление триггеров и функций
```sql
-- Откройте файл fix_receipt_deletion_analytics.sql
-- Скопируйте весь код и выполните в Supabase SQL Editor
```

#### Шаг 2: Создание функций для полного пересчета
```sql
-- Откройте файл recalculate_all_analytics.sql  
-- Скопируйте весь код и выполните в Supabase SQL Editor
```

### 2. Проверить работу

После применения скриптов:

1. Откройте приложение: `npm run dev`
2. Перейдите на вкладку "Чек"
3. Удалите любой чек
4. Проверьте, что статистика обновилась корректно

## 🔧 Что изменилось

### База данных
- ✅ Создана функция `recalculate_monthly_stats` для пересчета месячной статистики
- ✅ Создана функция `recalculate_stats_on_history_delete` для пересчета при удалении покупок
- ✅ Создана функция `recalculate_stats_on_receipt_delete` для пересчета при удалении чеков
- ✅ Создан триггер `recalculate_stats_on_history_delete_trigger` на таблице `product_history`
- ✅ Создан триггер `recalculate_stats_on_receipt_delete_trigger` на таблице `receipts`
- ✅ Создана функция `recalculate_family_analytics` для полного пересчета семьи
- ✅ Создана функция `recalculate_all_analytics` для пересчета всех семей

### Приложение
- ✅ Добавлен метод `recalculateFamilyAnalytics` в `SupabaseService`
- ✅ Добавлен метод `recalculateAllAnalytics` в `SupabaseService`
- ✅ Добавлена функция `recalculateAllAnalytics` в хук `useMonthlyStats`
- ✅ Обновлена функция `handleDeleteReceipt` для использования полного пересчета

## 🚀 Как это работает

### Автоматический пересчет
1. Пользователь удаляет чек
2. База данных удаляет чек (CASCADE удаляет связанные покупки)
3. Триггер `recalculate_stats_on_receipt_delete_trigger` срабатывает
4. Триггер `recalculate_stats_on_history_delete_trigger` срабатывает для каждой удаленной покупки
5. Функция `recalculate_monthly_stats` пересчитывает статистику
6. Приложение обновляет UI

### Ручной пересчет
- `recalculateStats()` - пересчет для конкретного месяца
- `recalculateAllAnalytics()` - полный пересчет всей аналитики семьи

## 🧪 Тестирование

### Тест 1: Удаление чека
```javascript
// В консоли браузера
const testDelete = async () => {
  // Получить статистику до удаления
  const statsBefore = await supabase.from('monthly_stats').select('*');
  console.log('До удаления:', statsBefore.data);
  
  // Удалить чек
  await supabase.from('receipts').delete().eq('id', 1);
  
  // Получить статистику после удаления
  const statsAfter = await supabase.from('monthly_stats').select('*');
  console.log('После удаления:', statsAfter.data);
};
```

### Тест 2: Ручной пересчет
```javascript
// В консоли браузера
const testRecalculate = async () => {
  await supabase.rpc('recalculate_family_analytics', { p_family_id: 1 });
  console.log('Пересчет выполнен');
};
```

## 📊 Результат

После применения исправлений:
- ✅ При удалении чека автоматически пересчитывается вся аналитика
- ✅ Статистика по месяцам обновляется корректно
- ✅ Суммы, калории и количество чеков отображаются правильно
- ✅ Можно выполнить ручной пересчет всей аналитики

## 🔍 Диагностика

Если что-то не работает:

1. Проверьте, что все SQL скрипты выполнены успешно
2. Проверьте консоль браузера на ошибки
3. Убедитесь, что функции `recalculate_monthly_stats` и `recalculate_family_analytics` существуют в базе
4. Проверьте, что триггеры созданы на таблицах `receipts` и `product_history`

## 📝 Файлы

- `fix_receipt_deletion_analytics.sql` - основные триггеры и функции
- `recalculate_all_analytics.sql` - функции для полного пересчета
- `src/services/supabaseService.ts` - обновленный сервис
- `src/hooks/useSupabaseData.ts` - обновленные хуки
- `src/GroceryTrackerApp.tsx` - обновленный компонент
