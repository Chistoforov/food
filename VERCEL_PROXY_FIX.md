# Исправление Proxy для Vercel

## Проблема
При загрузке чека на Vercel возникала ошибка "Failed to fetch", хотя API ключ Perplexity был настроен.

## Причина
Файл `proxy-server.js` использовал Express формат, который не работает как серверлесс функция на Vercel.

## Решение
Переписали `proxy-server.js` в формат серверлесс функции Vercel с правильным handler экспортом.

## Изменённые файлы

1. **proxy-server.js** - теперь экспортирует функцию `handler` для Vercel
2. **proxy-server-local.js** - новый файл для локальной разработки (Express)
3. **package.json** - обновлён скрипт `proxy` для использования локального сервера

## Инструкция по деплою на Vercel

### Шаг 1: Закоммитить изменения
```bash
git add .
git commit -m "Fix: Convert proxy-server to Vercel serverless function format"
git push origin main
```

### Шаг 2: Vercel автоматически задеплоит изменения
После push на GitHub, Vercel автоматически:
- Заберёт изменения
- Соберёт проект
- Задеплоит обновлённую версию

### Шаг 3: Проверить переменные окружения на Vercel
Убедитесь, что на Vercel установлена переменная:
- `PERPLEXITY_API_KEY` (без префикса VITE_)

### Шаг 4: Проверить работу
1. Откройте приложение на Vercel
2. Перейдите в раздел "Чек"
3. Загрузите фото чека
4. Должно успешно обработаться

## Что изменилось в коде

### Старый формат (не работал на Vercel):
```javascript
import express from 'express';
const app = express();
app.post('/api/perplexity', async (req, res) => { ... });
export default app;
```

### Новый формат (работает на Vercel):
```javascript
export default async function handler(req, res) {
  // Обработка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Прокси запрос к Perplexity API
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.json();
  return res.status(200).json(data);
}
```

## Локальная разработка

Для локальной разработки используйте:
```bash
# Запустить прокси сервер
npm run proxy

# В другом терминале запустить приложение
npm run dev
```

## Проверка логов на Vercel

Если возникают проблемы:
1. Откройте Vercel Dashboard
2. Выберите проект
3. Перейдите в "Deployments"
4. Выберите последний деплоймент
5. Перейдите в "Functions" → выберите функцию `proxy-server`
6. Просмотрите логи

## Возможные ошибки

### "API key not configured"
**Решение:** Добавьте `PERPLEXITY_API_KEY` в переменные окружения Vercel

### "Failed to fetch"
**Решение:** Проверьте, что функция правильно задеплоена и доступна по адресу `/api/perplexity`

### Ошибка 405 "Method not allowed"
**Решение:** Убедитесь, что используется POST метод

## Поддержка CORS

Функция теперь правильно обрабатывает CORS:
- Отвечает на preflight запросы (OPTIONS)
- Устанавливает правильные заголовки
- Разрешает запросы с любого origin (можно ограничить в production)

