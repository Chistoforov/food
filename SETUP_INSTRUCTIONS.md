# Инструкции по настройке Supabase

## Шаг 1: Получение ключей из Supabase

1. Откройте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдите в **Settings** → **API**
3. Скопируйте следующие значения:
   - **Project URL** (например: `https://abcdefghijklmnop.supabase.co`)
   - **anon public** ключ (длинная строка, начинающаяся с `eyJ...`)

## Шаг 2: Создание файла .env.local

1. Скопируйте файл `env.local.example` в `.env.local`:
   ```bash
   cp env.local.example .env.local
   ```

2. Откройте файл `.env.local` и замените значения:
   ```env
   VITE_SUPABASE_URL=https://ваш-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=ваш-anon-ключ-здесь
   ```

## Шаг 3: Проверка настройки

1. Запустите приложение:
   ```bash
   npm run dev
   ```

2. Откройте браузер и перейдите на `http://localhost:5173`

3. Если все настроено правильно, вы должны увидеть:
   - Загруженные данные из Supabase
   - Список продуктов (Молоко, Хлеб, Сникерс, Творог)
   - Статистику за октябрь
   - Список чеков

## Шаг 4: Проверка в Supabase Dashboard

1. Перейдите в **Table Editor** в Supabase Dashboard
2. Проверьте, что созданы таблицы:
   - `families`
   - `products`
   - `receipts`
   - `product_history`
   - `monthly_stats`

3. В таблице `products` должны быть 4 записи с тестовыми данными

## Возможные проблемы

### Ошибка "Invalid API key"
- Проверьте, что скопировали правильный anon ключ
- Убедитесь, что нет лишних пробелов в `.env.local`

### Ошибка "Failed to fetch"
- Проверьте URL Supabase проекта
- Убедитесь, что проект активен в Supabase Dashboard

### Данные не загружаются
- Проверьте, что выполнили SQL скрипт `database_schema.sql`
- Убедитесь, что RLS (Row Level Security) настроен правильно

## Следующие шаги

После успешной настройки:

1. **Тестирование**: Попробуйте изменить калорийность продукта
2. **Развертывание**: Следуйте инструкциям в `DEPLOYMENT.md`
3. **Кастомизация**: Настройте под ваши нужды

## Безопасность

⚠️ **Важно**: 
- Никогда не коммитьте файл `.env.local` в Git
- Файл `.env.local` уже добавлен в `.gitignore`
- Используйте только anon ключ для фронтенда
- Service role ключ используйте только на бэкенде
