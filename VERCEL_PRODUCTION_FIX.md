# ✅ Исправление проблемы "Failed to fetch" на Production

## 🔍 Диагностика проблемы

**Симптомы:**
- ✅ На localhost (http://localhost:5177/) - загрузка чека работает
- ❌ На production (https://food-sigma-virid.vercel.app/) - ошибка "Failed to fetch"

**Причина:**
Vercel требует, чтобы API endpoints (серверлесс функции) находились в папке `/api/`. Предыдущая конфигурация использовала `proxy-server.js` из корневой директории с rewrites в `vercel.json`, что не работает корректно.

## 🛠️ Исправления

### 1. Создана правильная структура для Vercel
```
/api/
  └── perplexity.js  ← Серверлесс функция (автоматически доступна на /api/perplexity)
```

### 2. Обновлена конфигурация Vercel (`vercel.json`)
- Удалены `builds` и `rewrites` (не нужны, Vercel автоматически обрабатывает `/api/`)
- Добавлены правильные CORS заголовки
- Упрощена конфигурация

### 3. Оптимизирована структура проекта
- Создан `.vercelignore` для исключения ненужных файлов из деплоя
- Документация обновлена

## 🚀 Инструкции по деплою

### Шаг 1: Закоммитьте и запушьте изменения

```bash
cd /Users/d.chistoforov/Desktop/MVP

# Добавьте все изменения
git add .

# Создайте коммит
git commit -m "fix: Correct Vercel serverless function structure for /api/perplexity"

# Запушьте на GitHub
git push origin main
```

### Шаг 2: Убедитесь, что на Vercel установлены переменные окружения

1. Откройте: https://vercel.com/dashboard
2. Выберите проект `food-sigma-virid`
3. Перейдите: **Settings** → **Environment Variables**

**Обязательные переменные:**

| Имя переменной | Значение | Примечание |
|----------------|----------|------------|
| `PERPLEXITY_API_KEY` | ваш API ключ | **БЕЗ** префикса `VITE_`! |
| `VITE_SUPABASE_URL` | URL Supabase | С префиксом `VITE_` |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | С префиксом `VITE_` |

⚠️ **Критически важно:** Для серверлесс функции используйте именно `PERPLEXITY_API_KEY` (без VITE_), а не `VITE_PERPLEXITY_API_KEY`!

### Шаг 3: Дождитесь завершения автоматического деплоя

После push в `main` ветку:
- Vercel автоматически обнаружит изменения
- Запустит новый деплой
- Соберет фронтенд (`npm run build`)
- Развернет серверлесс функцию `/api/perplexity.js`

**Отслеживайте прогресс:** https://vercel.com/dashboard → ваш проект → Deployments

### Шаг 4: Тестирование

После успешного деплоя:

1. Откройте https://food-sigma-virid.vercel.app/
2. Нажмите кнопку загрузки чека
3. Выберите фото чека
4. Убедитесь, что чек успешно обрабатывается и данные добавляются в приложение

## 📊 Архитектура решения

### Локальная разработка
```
Browser (localhost:5177)
    ↓ fetch('/api/perplexity')
Vite Dev Server (port 5177)
    ↓ proxy → http://localhost:3001
Local Proxy Server (proxy-server-local.js)
    ↓
Perplexity API
```

### Production (Vercel)
```
Browser (food-sigma-virid.vercel.app)
    ↓ fetch('/api/perplexity')
Vercel Edge Network
    ↓ auto-routing
Serverless Function (/api/perplexity.js)
    ↓
Perplexity API
```

## 🔧 Troubleshooting

### Ошибка: "Perplexity API key not configured"

**Решение:**
1. Зайдите в Vercel Dashboard → Settings → Environment Variables
2. Убедитесь, что есть переменная `PERPLEXITY_API_KEY` (без VITE_)
3. После добавления переменной нажмите "Redeploy" в деплойменте

### Ошибка: "Failed to fetch" все еще появляется

**Проверьте:**
1. **Логи функции:** Vercel Dashboard → Functions → `perplexity` → Logs
2. **Деплой завершен:** Deployments → последний деплой должен быть "Ready"
3. **Кэш браузера:** Очистите кэш (Ctrl+Shift+R / Cmd+Shift+R)
4. **Network tab:** Откройте DevTools → Network → проверьте запрос к `/api/perplexity`

### Проверка работы API endpoint

Вы можете проверить, что endpoint работает, открыв в браузере:
```
https://food-sigma-virid.vercel.app/api/perplexity
```

Вы должны увидеть: `{"error": "Method not allowed"}` (это нормально, т.к. требуется POST)

Если видите 404 - значит серверлесс функция не развернулась.

### Проверка логов в реальном времени

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Войдите
vercel login

# Просмотр логов в реальном времени
vercel logs https://food-sigma-virid.vercel.app
```

## 📁 Измененные файлы

| Файл | Статус | Описание |
|------|--------|----------|
| `/api/perplexity.js` | ✅ Новый | Серверлесс функция для Vercel |
| `/vercel.json` | ✏️ Изменен | Упрощена конфигурация |
| `/.vercelignore` | ✅ Новый | Оптимизация деплоя |
| `/src/services/perplexityService.ts` | ✏️ Изменен | Упрощен URL прокси |
| `/vite.config.ts` | ✏️ Изменен | Добавлен прокси для локальной разработки |

## 📚 Дополнительные ресурсы

- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Perplexity API Docs](https://docs.perplexity.ai/)

## ✅ Чек-лист после деплоя

- [ ] Код закоммичен и запушен
- [ ] Vercel показывает успешный деплой (зеленая галочка)
- [ ] Переменная `PERPLEXITY_API_KEY` установлена на Vercel
- [ ] Endpoint `/api/perplexity` отвечает (даже с ошибкой 405 это OK)
- [ ] Загрузка чека работает на production
- [ ] Данные из чека корректно добавляются в приложение

---

**Дата исправления:** 2025-10-28
**Статус:** ✅ Готово к деплою

