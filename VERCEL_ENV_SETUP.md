# Настройка переменных окружения в Vercel

## Проблема
При открытии продакшн версии в консоли появляются ошибки:
- `net::ERR_NAME_NOT_RESOLVED` при запросах к Supabase
- База данных не подключена

**Причина**: Переменные окружения для Supabase не настроены в Vercel

## Решение

### Шаг 1: Получите данные Supabase

1. Откройте ваш проект на [supabase.com](https://supabase.com)
2. Перейдите в **Settings** → **API**
3. Скопируйте:
   - **Project URL** (например: `https://ynwcctrpyypybghfloac.supabase.co`)
   - **anon public key** (длинный ключ, начинается с `eyJhbGciOi...`)

### Шаг 2: Добавьте переменные в Vercel

#### Способ 1: Через веб-интерфейс Vercel (рекомендуется)

1. Откройте [vercel.com](https://vercel.com)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте следующие переменные:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | Ваш Project URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Ваш anon public key | Production, Preview, Development |
| `VITE_PERPLEXITY_API_KEY` | Ваш Perplexity API ключ (если используете) | Production, Preview, Development |

**Важно**: Установите все переменные для всех окружений (Production, Preview, Development)

5. Нажмите **Save** для каждой переменной

#### Способ 2: Через Vercel CLI

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Войдите в аккаунт
vercel login

# Добавьте переменные окружения
vercel env add VITE_SUPABASE_URL production
# Вставьте ваш Supabase URL когда попросит

vercel env add VITE_SUPABASE_ANON_KEY production
# Вставьте ваш Supabase anon key когда попросит

vercel env add VITE_PERPLEXITY_API_KEY production
# Вставьте ваш Perplexity API key когда попросит (опционально)

# Повторите для preview и development окружений
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
```

### Шаг 3: Пересоберите проект

После добавления переменных окружения нужно пересобрать проект:

#### Через веб-интерфейс:
1. Перейдите в **Deployments**
2. Нажмите на последний деплой
3. Нажмите три точки (**...**) → **Redeploy**
4. Выберите **Use existing Build Cache: NO**
5. Нажмите **Redeploy**

#### Через CLI:
```bash
vercel --prod
```

### Шаг 4: Проверка

1. Откройте ваш сайт в браузере
2. Откройте консоль разработчика (F12)
3. Проверьте, что:
   - ✅ Нет ошибок `ERR_NAME_NOT_RESOLVED`
   - ✅ Данные из Supabase загружаются
   - ✅ Приложение работает корректно

## Пример значений .env

```bash
# Supabase настройки
VITE_SUPABASE_URL=https://ynwcctrpyypybghfloac.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Perplexity API для сканирования чеков (опционально)
VITE_PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx
```

## Частые ошибки

### ❌ Переменные не применяются
**Решение**: Убедитесь, что вы пересобрали проект после добавления переменных

### ❌ ERR_NAME_NOT_RESOLVED все еще появляется
**Решение**: 
1. Проверьте правильность URL Supabase (должен начинаться с `https://`)
2. Убедитесь, что переменная называется именно `VITE_SUPABASE_URL` (с префиксом VITE_)
3. Проверьте, что переменные добавлены для Production окружения

### ❌ Unauthorized ошибки
**Решение**: Проверьте, что вы скопировали правильный anon key (не service_role key!)

## Безопасность

✅ **Можно использовать в публичных переменных**:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (это публичный ключ)

❌ **НИКОГДА не публикуйте**:
- service_role key из Supabase
- secret ключи
- пароли

## Дополнительная информация

- Переменные с префиксом `VITE_` автоматически встраиваются в клиентский код при сборке
- Vercel автоматически подставляет переменные окружения при деплое
- После изменения переменных всегда нужен редеплой

## Полезные ссылки

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase API Settings](https://supabase.com/dashboard/project/_/settings/api)

