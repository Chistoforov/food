# 🚀 Развертывание Grocery Tracker на Vercel

## Шаг 1: Установка Vercel CLI

```bash
npm i -g vercel
```

## Шаг 2: Логин в Vercel

```bash
vercel login
```

## Шаг 3: Подготовка проекта

Убедитесь, что все файлы готовы:
- ✅ `vercel.json` - конфигурация Vercel
- ✅ `proxy-server.js` - обновлен для Vercel
- ✅ Проект собирается: `npm run build`

## Шаг 4: Первое развертывание

```bash
cd /Users/d.chistoforov/Desktop/MVP
vercel
```

Следуйте инструкциям:
1. Выберите команду (если есть)
2. Выберите проект (создайте новый)
3. Выберите директорию (оставьте по умолчанию)
4. Настройте переменные окружения (см. Шаг 5)

## Шаг 5: Настройка переменных окружения

После создания проекта, добавьте переменные в Vercel Dashboard:

1. Перейдите в Settings → Environment Variables
2. Добавьте:
   - `VITE_SUPABASE_URL` = `your_supabase_url_here`
   - `VITE_SUPABASE_ANON_KEY` = `your_supabase_anon_key_here`
   - `VITE_PERPLEXITY_API_KEY` = `your_perplexity_api_key_here`

## Шаг 6: Развертывание в продакшн

```bash
vercel --prod
```

## Шаг 7: Проверка

После развертывания проверьте:
1. ✅ Главная страница загружается
2. ✅ API `/api/perplexity` работает
3. ✅ Подключение к Supabase
4. ✅ Сканирование чеков

## Возможные проблемы и решения

### Проблема: CORS ошибки
**Решение**: В Supabase Dashboard → Settings → API → добавить ваш домен Vercel в CORS origins

### Проблема: API не работает
**Решение**: Проверьте переменные окружения в Vercel Dashboard

### Проблема: Сборка не проходит
**Решение**: Убедитесь, что все зависимости установлены и проект собирается локально

## Команды для разработки

```bash
# Локальная разработка
npm run dev

# Запуск прокси-сервера
npm run proxy

# Сборка для продакшна
npm run build

# Предварительный просмотр
npm run preview
```

## Структура развертывания

- **Frontend**: Статические файлы из `dist/`
- **API**: Express.js сервер на `/api/perplexity`
- **Database**: Supabase PostgreSQL
- **Domain**: `your-project.vercel.app`
