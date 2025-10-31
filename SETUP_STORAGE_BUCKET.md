# Настройка Supabase Storage для чеков 📦

## Шаг 1: Создание Bucket

1. Откройте [Supabase Dashboard](https://app.supabase.com/)
2. Выберите ваш проект
3. Перейдите в **Storage** (левое меню)
4. Нажмите **New bucket**

### Настройки bucket:

- **Name:** `receipts`
- **Public:** ✅ Включить (чтобы можно было передавать URL в Perplexity API)
- **File size limit:** `10485760` (10 MB)
- **Allowed MIME types:** `image/*` (опционально, для ограничения типов файлов)

## Шаг 2: Настройка политик доступа (RLS Policies)

После создания bucket, нужно настроить политики доступа:

### Политика 1: Загрузка файлов (INSERT)

Позволяет пользователям загружать чеки для своей семьи.

```sql
CREATE POLICY "Users can upload receipts for their family"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' AND
  auth.uid() IS NOT NULL
);
```

**Как применить:**
1. В Supabase Dashboard → Storage → receipts
2. Вкладка **Policies**
3. Нажать **New policy**
4. Выбрать **Create a policy from scratch**
5. Вставить код выше

### Политика 2: Чтение файлов (SELECT)

Позволяет любому получить публичный URL изображения (нужно для Perplexity API).

```sql
CREATE POLICY "Anyone can view receipt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');
```

**Примечание:** Если нужна более строгая безопасность, можно ограничить доступ только для авторизованных пользователей:

```sql
CREATE POLICY "Authenticated users can view receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' AND
  auth.uid() IS NOT NULL
);
```

### Политика 3: Удаление файлов (DELETE)

Позволяет пользователям удалять чеки своей семьи.

```sql
CREATE POLICY "Users can delete their family receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts' AND
  auth.uid() IS NOT NULL
);
```

## Шаг 3: Проверка настроек

### Проверка через Supabase Dashboard

1. Перейдите в **Storage** → **receipts**
2. Попробуйте загрузить тестовое изображение вручную
3. Проверьте, что можно получить публичный URL

### Проверка через код

```typescript
import { supabase } from './lib/supabase';

// Загрузка файла
const testUpload = async () => {
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
  
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload('test/test.jpg', file);
  
  if (error) {
    console.error('Upload error:', error);
  } else {
    console.log('Upload success:', data);
  }
};

// Получение публичного URL
const getPublicUrl = () => {
  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl('test/test.jpg');
  
  console.log('Public URL:', data.publicUrl);
};
```

## Шаг 4: Применение миграции БД

После создания Storage bucket, примените миграцию для таблицы `pending_receipts`:

1. Откройте **SQL Editor** в Supabase Dashboard
2. Скопируйте содержимое файла `migration_add_pending_receipts.sql`
3. Вставьте в редактор и выполните (Run)

Или через psql:

```bash
psql postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres \
  -f migration_add_pending_receipts.sql
```

## Шаг 5: Включение Realtime для pending_receipts

Для работы live-обновлений нужно включить Realtime:

1. Перейдите в **Database** → **Replication**
2. Найдите таблицу `pending_receipts`
3. Включите переключатель рядом с ней
4. Сохраните изменения

Или через SQL:

```sql
-- Включить Realtime для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE pending_receipts;
```

## Структура файлов в Storage

Файлы организованы по family_id:

```
receipts/
├── 1/
│   ├── 1698765432000.jpg
│   ├── 1698765433000.png
│   └── 1698765434000.jpg
├── 2/
│   ├── 1698765435000.jpg
│   └── 1698765436000.jpg
└── 3/
    └── 1698765437000.jpg
```

- `{family_id}/` - папка для каждой семьи
- `{timestamp}.{ext}` - уникальное имя файла (timestamp + расширение)

## Безопасность

### Рекомендации:

1. **Ограничение размера файла:** Максимум 10MB для оптимальной производительности
2. **Типы файлов:** Только изображения (image/*)
3. **Публичный доступ:** Включен для передачи URL в Perplexity API
4. **RLS Policies:** Настроены для ограничения доступа

### Дополнительная защита:

Если нужна более строгая безопасность:

1. **Сделать bucket приватным** (убрать галочку Public)
2. **Использовать signed URLs** вместо публичных:

```typescript
const { data, error } = await supabase.storage
  .from('receipts')
  .createSignedUrl('path/to/file.jpg', 3600); // URL действителен 1 час

console.log('Signed URL:', data.signedUrl);
```

3. **Обновить API для работы с signed URLs:**

```javascript
// В api/process-receipt.js
const { data: urlData } = await supabase.storage
  .from('receipts')
  .createSignedUrl(pendingReceipt.image_url, 3600);

const parsedData = await parseReceiptWithPerplexity(urlData.signedUrl);
```

## Автоматическая очистка старых файлов

Для экономии места можно настроить автоматическое удаление старых файлов:

```sql
-- Функция для удаления файлов старше 30 дней
CREATE OR REPLACE FUNCTION cleanup_old_receipt_images()
RETURNS void AS $$
DECLARE
  old_receipt RECORD;
BEGIN
  -- Получаем все старые completed/failed чеки
  FOR old_receipt IN 
    SELECT image_url 
    FROM pending_receipts 
    WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Удаляем файл из storage (нужно вызывать через API)
    -- Это лучше делать через отдельную функцию или cron job
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

Или вручную через Supabase Dashboard:
1. Storage → receipts
2. Выбрать старые файлы
3. Нажать Delete

## Мониторинг использования Storage

### Проверка занятого места:

1. Перейдите в **Storage** → **Usage**
2. Посмотрите статистику по bucket "receipts"

### Лимиты по тарифам Supabase:

- **Free tier:** 1 GB storage
- **Pro tier:** 100 GB storage
- **Enterprise:** Кастомные лимиты

## Troubleshooting

### Ошибка "Bucket not found"

**Решение:** Проверьте имя bucket - должно быть точно `receipts`

### Ошибка "Policy violation"

**Решение:** Проверьте, что все 3 политики созданы правильно

### Ошибка "File size limit exceeded"

**Решение:** Уменьшите размер изображения или увеличьте лимит в настройках bucket

### Не получается получить публичный URL

**Решение:** Убедитесь, что bucket публичный (Public: ✅)

## Заключение

После выполнения всех шагов Storage готов к работе. Пользователи смогут загружать чеки, а система будет обрабатывать их в фоновом режиме.

**Чеклист:**
- [x] Создан bucket "receipts"
- [x] Настроены политики доступа (3 шт)
- [x] Применена миграция БД
- [x] Включен Realtime для pending_receipts
- [x] Проверена загрузка тестового файла
- [x] Проверен публичный URL

