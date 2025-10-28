# Решение проблемы "Failed to fetch" при загрузке чека

## Проблема
При загрузке чека возникала ошибка "Failed to fetch" из-за того, что браузер не мог напрямую обращаться к прокси-серверу на `localhost:3001`.

## Решение
Настроен **Vite proxy** для перенаправления запросов `/api/perplexity` на прокси-сервер.

## Что было изменено

### 1. `vite.config.ts`
Добавлен прокси для перенаправления запросов:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      '/api/perplexity': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

### 2. `src/services/perplexityService.ts`
Изменен URL для запросов - теперь используется относительный путь:
```typescript
// Было:
const PROXY_URL = import.meta.env.PROD 
  ? '/api/perplexity' 
  : (import.meta.env.VITE_PROXY_URL || 'http://localhost:3001/api/perplexity');

// Стало:
const PROXY_URL = '/api/perplexity';
```

Также добавлена улучшенная обработка ошибок с детальными сообщениями.

## Как запустить приложение

### Шаг 1: Убедитесь, что у вас есть `.env.local` с API ключами

Файл должен содержать:
```bash
VITE_SUPABASE_URL=https://ynwccktrpypybqhfloac.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_PERPLEXITY_API_KEY=your_perplexity_key
```

### Шаг 2: Запустите прокси-сервер (в отдельном терминале)
```bash
npm run proxy
```

Должно появиться:
```
🚀 Proxy server running on http://localhost:3001
📡 Forwarding requests to Perplexity API
```

### Шаг 3: Запустите приложение (в другом терминале)
```bash
npm run dev
```

Приложение откроется на `http://localhost:5177`

### Шаг 4: Проверьте работу
1. Откройте приложение в браузере
2. Перейдите на вкладку "Чек" (камера)
3. Загрузите фото чека
4. В консоли браузера (F12) должны появиться логи:
   - `Making request to: /api/perplexity`
   - Далее ответ от API

## Тестирование прокси

Проверить работу прокси можно командой:
```bash
curl -X POST http://localhost:5177/api/perplexity \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar-pro","messages":[{"role":"user","content":"test"}]}'
```

Должен вернуться JSON ответ от Perplexity API.

## Архитектура

```
Браузер (localhost:5177)
    ↓
    └─→ /api/perplexity (относительный путь)
            ↓
        Vite Proxy (автоматически перенаправляет)
            ↓
        Прокси-сервер (localhost:3001)
            ↓
        Perplexity API (https://api.perplexity.ai)
```

## На продакшене (Vercel)

На Vercel работает аналогично:
- Запросы к `/api/perplexity` перенаправляются на serverless функцию `proxy-server.js`
- Никаких дополнительных настроек не требуется

## Дополнительная диагностика

Если проблема все еще есть:

1. **Проверьте, что прокси-сервер запущен:**
   ```bash
   lsof -i :3001
   ```
   
2. **Проверьте, что Vite работает:**
   ```bash
   lsof -i :5177
   ```
   
3. **Проверьте логи в консоли браузера (F12)**

4. **Проверьте логи прокси-сервера** в терминале где он запущен

## Файлы изменены
- ✅ `vite.config.ts` - добавлен прокси
- ✅ `src/services/perplexityService.ts` - изменен URL и улучшена обработка ошибок
- ✅ Создана документация

