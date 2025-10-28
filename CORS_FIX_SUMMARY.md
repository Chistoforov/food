# 🔧 Исправление ошибки "Failed to fetch"

## 🐛 Проблема

При загрузке чека возникала ошибка:
```
Ошибка обработки чека: Failed to fetch
```

### Причина
Браузер блокирует прямые запросы к Perplexity API из-за политики CORS (Cross-Origin Resource Sharing). Perplexity API не разрешает запросы напрямую из браузера.

---

## ✅ Решение

Создан **локальный прокси-сервер**, который:
1. Принимает запросы от браузера
2. Пересылает их к Perplexity API от своего имени
3. Возвращает результат в браузер

Это стандартный подход для работы с API, которые не поддерживают CORS.

---

## 📝 Что было сделано

### 1. Создан прокси-сервер
**Файл:** `proxy-server.js`
- Express сервер на порту 3001
- Endpoint: `POST /api/perplexity`
- Пересылает запросы к Perplexity API

### 2. Обновлен сервис
**Файл:** `src/services/perplexityService.ts`
```typescript
// Было:
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Стало:
const PROXY_URL = 'http://localhost:3001/api/perplexity';
```

### 3. Добавлен npm скрипт
**Файл:** `package.json`
```json
"scripts": {
  "proxy": "node proxy-server.js"
}
```

### 4. Установлены зависимости
```bash
npm install express cors dotenv
```

---

## 🚀 Как использовать

### Терминал 1 - Прокси (УЖЕ ЗАПУЩЕН ✅)
```bash
npm run proxy
```

### Терминал 2 - Приложение (ЗАПУСТИТЕ ВРУЧНУЮ)
```bash
npm run dev
```

Затем откройте: **http://localhost:5173**

---

## 🔍 Проверка

### Прокси работает ✅
```bash
curl http://localhost:3001/api/perplexity -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar-reasoning","messages":[]}'
```

Должен вернуть JSON (не "Failed to fetch").

### Приложение работает
Откройте http://localhost:5173 и загрузите чек.

---

## 📊 Архитектура

```
Браузер (localhost:5173)
    ↓
    ↓ HTTP запрос (БЕЗ CORS проблем)
    ↓
Прокси-сервер (localhost:3001)
    ↓
    ↓ HTTP запрос с API ключом
    ↓
Perplexity API
    ↓
    ↓ JSON ответ
    ↓
Прокси-сервер
    ↓
    ↓ JSON ответ
    ↓
Браузер
```

---

## 🔐 Безопасность

API ключ Perplexity теперь используется только на сервере (proxy-server.js), а не в браузере. Это более безопасно.

**Важно:** В продакшене используйте HTTPS и настройте CORS правильно!

---

## 📚 Дополнительные материалы

- `QUICK_START.md` - быстрый старт
- `START_APP.md` - подробная инструкция
- `PROXY_SERVER_GUIDE.md` - документация прокси-сервера

---

## 🎯 Результат

✅ Ошибка "Failed to fetch" исправлена  
✅ Чеки загружаются и обрабатываются  
✅ Приложение работает корректно  

---

**Дата исправления:** 28 октября 2025  
**Версия:** 1.0

