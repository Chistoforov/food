# 🚨 Исправление ошибки "Failed to fetch" на продакшене

## ✅ Что было сделано:

1. **Обновлен `vercel.json`** - добавлены явные маршруты для API функций
2. **Изменения закоммичены и запушены** на GitHub
3. Vercel автоматически начнет деплой (1-2 минуты)

---

## 🔧 ОБЯЗАТЕЛЬНО: Проверьте переменные окружения на Vercel

### Шаг 1: Откройте настройки проекта на Vercel

1. Перейдите: https://vercel.com/dashboard
2. Выберите проект **food-sigma-virid**
3. Откройте **Settings** → **Environment Variables**

### Шаг 2: Проверьте наличие переменной PERPLEXITY_API_KEY

**ВАЖНО:** Должна быть переменная с именем **`PERPLEXITY_API_KEY`** (без префикса `VITE_`)

#### Если переменной нет:

1. Нажмите **Add New**
2. **Name:** `PERPLEXITY_API_KEY`
3. **Value:** Ваш API ключ от Perplexity (начинается с `pplx-...`)
4. **Environment:** Выберите все (Production, Preview, Development)
5. Нажмите **Save**

#### Если переменная есть:

✅ Отлично! Переходите к следующему шагу.

---

## 🔍 Шаг 3: Дождитесь завершения деплоя

1. Откройте вкладку **Deployments** в вашем проекте на Vercel
2. Дождитесь, пока последний деплой (commit: "fix: Add explicit API routing...") завершится
3. Статус должен стать **Ready** (обычно 1-2 минуты)

---

## 🧪 Шаг 4: Проверьте работу

1. Откройте: https://food-sigma-virid.vercel.app/
2. Попробуйте загрузить чек
3. ✅ **Должно работать!**

---

## 🐛 Если все еще не работает:

### A) Очистите кэш браузера

- **Mac:** `Cmd + Shift + R`
- **Windows:** `Ctrl + Shift + R`

### B) Проверьте логи Vercel

1. Vercel Dashboard → **food-sigma-virid**
2. **Functions** → найдите функцию `perplexity`
3. **Logs** → проверьте ошибки

### C) Частые ошибки и решения:

#### Ошибка: "Perplexity API key not configured"
**Решение:** Добавьте `PERPLEXITY_API_KEY` в Environment Variables (см. Шаг 2)

#### Ошибка: "404 Not Found" на /api/perplexity
**Решение:** 
1. Убедитесь, что деплой завершился успешно
2. Проверьте, что папка `/api/` есть в репозитории: https://github.com/Chistoforov/food/tree/main/api

#### Ошибка: "Failed to fetch" или "Network error"
**Решение:**
1. Откройте DevTools (F12) → вкладка Network
2. Попробуйте загрузить чек
3. Найдите запрос к `/api/perplexity` и посмотрите детали ошибки
4. Если статус **504 Timeout** - возможно, Perplexity API перегружен, попробуйте снова через минуту

---

## 📊 Как это работает:

### На localhost (разработка):
```
Приложение → /api/perplexity → Vite Proxy → http://localhost:3001 → Perplexity API
```

### На production (Vercel):
```
Приложение → /api/perplexity → Vercel Serverless Function → Perplexity API
```

---

## 💡 Технические детали:

### Что изменилось в `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        // CORS headers для API
      ]
    }
  ]
}
```

Это гарантирует, что запросы к `/api/perplexity` будут правильно маршрутизироваться к серверлесс функции в папке `/api/`.

---

## 📞 Нужна помощь?

Если проблема сохраняется:

1. Проверьте логи на Vercel (Functions → perplexity → Logs)
2. Откройте DevTools (F12) и проверьте вкладку Console для ошибок
3. Убедитесь, что переменная `PERPLEXITY_API_KEY` установлена на Vercel

---

**Дата:** 28 октября 2025
**Статус:** ✅ Готово к тестированию


