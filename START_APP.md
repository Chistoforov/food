# 🚀 Инструкция по запуску приложения

## Проблема решена! ✅

Ошибка **"Failed to fetch"** возникала из-за CORS политики Perplexity API.

Решение: создан локальный прокси-сервер, который пересылает запросы к API.

---

## 📋 Как запустить приложение

### Вариант 1: Два терминала (РЕКОМЕНДУЕТСЯ)

#### Терминал 1 - Запуск прокси-сервера
```bash
cd /Users/d.chistoforov/Desktop/MVP
npm run proxy
```

**Вы должны увидеть:**
```
🚀 Proxy server running on http://localhost:3001
📡 Forwarding requests to Perplexity API
```

#### Терминал 2 - Запуск основного приложения
```bash
cd /Users/d.chistoforov/Desktop/MVP
npm run dev
```

**Вы должны увидеть:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Вариант 2: Одной командой (в одном терминале)

```bash
cd /Users/d.chistoforov/Desktop/MVP

# Запустить прокси в фоне
npm run proxy &

# Подождать 2 секунды
sleep 2

# Запустить приложение
npm run dev
```

---

## 🎯 Тестирование загрузки чека

1. Откройте приложение: http://localhost:5173
2. Нажмите на вкладку **"Чек"** (иконка камеры)
3. Выберите или сфотографируйте чек
4. Приложение должно успешно обработать чек через прокси-сервер

---

## ✅ Что было изменено

1. **proxy-server.js** - создан прокси-сервер для обхода CORS
2. **src/services/perplexityService.ts** - обновлен для использования прокси
3. **package.json** - добавлен скрипт `npm run proxy`
4. Установлены зависимости: `express`, `cors`, `dotenv`

---

## 🔧 Troubleshooting

### Ошибка "Port 3001 already in use"

```bash
# Найти процесс
lsof -i :3001

# Убить процесс
kill -9 <PID>
```

### Ошибка "Port 5173 already in use"

```bash
# Найти процесс
lsof -i :5173

# Убить процесс
kill -9 <PID>
```

### Прокси-сервер не работает

Проверьте, что файл `env.local` содержит:
```
VITE_PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

### Чек не загружается

1. Проверьте консоль браузера (F12 -> Console)
2. Убедитесь, что оба сервера запущены
3. Проверьте, что прокси доступен: `curl http://localhost:3001`

---

## 📊 Проверка работы

### Проверка прокси-сервера:
```bash
curl http://localhost:3001/api/perplexity \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar-reasoning","messages":[{"role":"user","content":"test"}]}'
```

Если прокси работает, вы увидите ответ от Perplexity API (или ошибку API, но не "Failed to fetch").

### Проверка Vite:
```bash
curl http://localhost:5173
```

Если Vite работает, вы увидите HTML код приложения.

---

## 🌐 Порты

- **Прокси-сервер**: http://localhost:3001
- **Vite Dev Server**: http://localhost:5173

---

## 📚 Дополнительная информация

- `PROXY_SERVER_GUIDE.md` - подробное руководство по прокси-серверу
- `RECEIPT_SCANNING_QUICK_START.md` - инструкция по использованию сканера чеков

