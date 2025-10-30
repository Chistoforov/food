# 🔧 Исправление удаления чеков

## ⚡ Быстрое решение (2 минуты)

### Проблема
Чеки не удаляются, хотя нет ошибок.

### Решение
**Откройте Supabase Dashboard → SQL Editor и выполните:**

```sql
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);

ALTER TABLE product_history 
ADD COLUMN IF NOT EXISTS receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE;
```

**Готово!** Обновите страницу (Ctrl+Shift+R) и попробуйте удалить чек.

---

## 📚 Подробные инструкции

- **Русский:** `РЕШЕНИЕ_ПРОБЛЕМЫ_УДАЛЕНИЯ_ЧЕКОВ.md` - полное объяснение
- **English:** `FIX_DELETE_RECEIPT_ISSUE.md` - detailed guide
- **Quick fix:** `QUICK_FIX_DELETE_RECEIPT.md` - 3-minute solution

## 📁 Дополнительные файлы

- `setup_rls_policies.sql` - полный SQL-скрипт со всеми политиками
- `test_delete_receipt.js` - скрипт для диагностики в консоли браузера

## ❓ Что это делает?

1. **Включает RLS** - систему безопасности Supabase
2. **Создает политики** - разрешает операции удаления
3. **Добавляет receipt_id** - связывает чеки с покупками для автоматического удаления

## ✅ Проверка

После выполнения:
- Обновите страницу
- Попробуйте удалить чек
- Чек должен исчезнуть из списка
- Статистика автоматически пересчитается

---

**Работает на localhost и production одновременно** (одна БД Supabase) 🎉

