# Исправление ошибки "Failed to fetch" на Vercel

## Проблема
При загрузке чека на production (Vercel) возникает ошибка "Failed to fetch", хотя на localhost все работает.

## Причина
Vercel требует, чтобы серверлесс функции (API endpoints) находились в папке `/api/`. Предыдущая конфигурация пыталась использовать `proxy-server.js` из корня проекта, что не работает в Vercel.

## Что было исправлено

### 1. Создана правильная структура API
- ✅ Создана папка `/api/`
- ✅ Создан файл `/api/perplexity.js` - серверлесс функция для проксирования запросов к Perplexity API
- ✅ Функция автоматически доступна по пути `/api/perplexity`

### 2. Упрощена конфигурация Vercel
Обновлен файл `vercel.json`:
- ❌ Удалены ненужные `builds` и `rewrites` (Vercel автоматически обрабатывает папку `/api/`)
- ✅ Добавлены CORS заголовки для корректной работы API
- ✅ Оставлены только необходимые настройки

### 3. Создан `.vercelignore`
Добавлен файл для оптимизации деплоя (исключение ненужных файлов)

## Как задеплоить исправления

### Шаг 1: Коммит и пуш изменений

```bash
git add .
git commit -m "fix: Move proxy to /api/ folder for Vercel deployment"
git push origin main
```

### Шаг 2: Проверьте переменные окружения на Vercel

1. Откройте dashboard Vercel: https://vercel.com/dashboard
2. Выберите ваш проект (food-sigma-virid)
3. Перейдите в **Settings** → **Environment Variables**
4. Убедитесь, что установлены следующие переменные:

   - `PERPLEXITY_API_KEY` - ваш API ключ Perplexity (БЕЗ префикса VITE_)
   - `VITE_SUPABASE_URL` - URL вашего Supabase проекта
   - `VITE_SUPABASE_ANON_KEY` - анонимный ключ Supabase

⚠️ **ВАЖНО:** Для серверлесс функции используйте `PERPLEXITY_API_KEY` (без VITE_), а не `VITE_PERPLEXITY_API_KEY`

### Шаг 3: Автоматический деплой

После пуша в `main` ветку, Vercel автоматически:
- Обнаружит изменения
- Запустит новый деплой
- Соберет проект
- Развернет серверлесс функцию `/api/perplexity.js`

Следите за статусом деплоя в Vercel dashboard.

### Шаг 4: Проверка

После успешного деплоя:

1. Откройте https://food-sigma-virid.vercel.app/
2. Загрузите тестовый чек
3. Проверьте, что данные успешно обрабатываются

## Как работает новая архитектура

### Локальная разработка (localhost:5177)
```
Клиент → fetch('/api/perplexity')
       ↓
Vite proxy (vite.config.ts)
       ↓
http://localhost:3001 (proxy-server-local.js)
       ↓
Perplexity API
```

### Production (Vercel)
```
Клиент → fetch('/api/perplexity')
       ↓
Vercel автоматически роутит на /api/perplexity.js
       ↓
Серверлесс функция /api/perplexity.js
       ↓
Perplexity API
```

## Проверка логов на Vercel

Если возникают проблемы:

1. Перейдите в Vercel Dashboard → ваш проект
2. Откройте вкладку **Functions** - здесь будет видна функция `perplexity`
3. Перейдите в **Logs** - здесь можно увидеть все запросы и ошибки
4. При загрузке чека проверьте логи функции

## Возможные ошибки и решения

### Ошибка: "Perplexity API key not configured"
**Решение:** Добавьте переменную `PERPLEXITY_API_KEY` в Vercel → Settings → Environment Variables

### Ошибка: "Failed to fetch" все еще появляется
**Решение:** 
1. Проверьте логи в Vercel → Functions → perplexity
2. Убедитесь, что деплой завершился успешно
3. Очистите кэш браузера (Ctrl+Shift+R или Cmd+Shift+R)
4. Проверьте Network tab в DevTools браузера

### Ошибка 405 "Method not allowed"
**Решение:** Убедитесь, что запрос использует метод POST

### Ошибка CORS
**Решение:** Проверьте, что в `vercel.json` правильно настроены CORS заголовки

## Файлы, которые были изменены

- ✅ `/api/perplexity.js` - новый файл (серверлесс функция)
- ✅ `/vercel.json` - упрощена конфигурация
- ✅ `/.vercelignore` - новый файл
- ℹ️ `/src/services/perplexityService.ts` - без изменений (уже использует '/api/perplexity')
- ℹ️ `/vite.config.ts` - без изменений (локальный прокси работает как прежде)

## Дополнительная информация

- [Vercel Serverless Functions Documentation](https://vercel.com/docs/functions/serverless-functions)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Build Configuration](https://vercel.com/docs/build-step)

