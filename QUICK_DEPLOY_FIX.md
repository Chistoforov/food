# Быстрое исправление - Деплой на Vercel

## Что было сделано ✅

1. ✅ Создана папка `/api/` с серверлесс функцией `perplexity.js`
2. ✅ Обновлен `vercel.json` для корректной работы с Vercel
3. ✅ Создан `.vercelignore` для оптимизации деплоя

## Что нужно сделать сейчас 🚀

### 1. Задеплойте изменения

```bash
# Закоммитьте изменения
git add .
git commit -m "fix: Move API proxy to /api/ folder for Vercel"
git push origin main
```

### 2. Проверьте переменные окружения на Vercel

Откройте: https://vercel.com/dashboard → ваш проект → Settings → Environment Variables

**Необходимые переменные:**
- `PERPLEXITY_API_KEY` - ваш API ключ (БЕЗ префикса VITE_!)
- `VITE_SUPABASE_URL` - URL Supabase
- `VITE_SUPABASE_ANON_KEY` - ключ Supabase

⚠️ **Важно:** Используйте `PERPLEXITY_API_KEY`, а НЕ `VITE_PERPLEXITY_API_KEY` для серверлесс функции!

### 3. Дождитесь завершения деплоя

Vercel автоматически задеплоит изменения. Следите за статусом на dashboard.

### 4. Тестирование

После деплоя откройте https://food-sigma-virid.vercel.app/ и попробуйте загрузить чек.

## Если что-то не работает 🔍

1. Проверьте логи: Vercel Dashboard → Functions → perplexity → Logs
2. Проверьте, что переменная `PERPLEXITY_API_KEY` установлена
3. Очистите кэш браузера (Ctrl+Shift+R / Cmd+Shift+R)

---

Подробная документация: см. `VERCEL_FIX_GUIDE.md`

