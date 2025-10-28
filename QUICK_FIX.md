# 🔧 Быстрое исправление "Failed to fetch"

## ✅ Проблема решена!

Ошибка возникала из-за того, что браузер не мог напрямую обращаться к прокси-серверу.

## 🚀 Что нужно сделать СЕЙЧАС

### 1️⃣ Убедитесь, что прокси-сервер запущен

Откройте **новый терминал** и выполните:
```bash
cd /Users/d.chistoforov/Desktop/MVP
npm run proxy
```

✅ Должно появиться:
```
🚀 Proxy server running on http://localhost:3001
📡 Forwarding requests to Perplexity API
```

### 2️⃣ Откройте приложение в браузере

Приложение уже запущено на:
```
http://localhost:5177
```

### 3️⃣ Проверьте API ключ Perplexity

Откройте файл `.env.local` и убедитесь, что там есть:
```bash
VITE_PERPLEXITY_API_KEY=ваш_ключ
```

Если ключа нет, добавьте его и перезапустите прокси-сервер.

## 🧪 Проверка работы

1. Откройте приложение в браузере
2. Перейдите на вкладку **"Чек"** (иконка камеры)
3. Загрузите фото чека
4. Откройте консоль браузера (F12 → Console)
5. Должны увидеть: `Making request to: /api/perplexity`

## ❓ Что-то не работает?

### Проверьте прокси-сервер:
```bash
curl -X POST http://localhost:3001/api/perplexity \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar-pro","messages":[{"role":"user","content":"test"}]}'
```

Должен вернуться JSON ответ (не ошибка).

### Проверьте Vite:
```bash
lsof -i :5177
```

Должно показать процесс node.

### Перезапустите все:

**Терминал 1 (прокси):**
```bash
pkill -f "node.*proxy-server"
npm run proxy
```

**Терминал 2 (приложение):**
```bash
pkill -f "node.*vite"
npm run dev
```

## 📚 Подробности

Смотрите полную документацию в файле `PROXY_FIX_SOLUTION.md`

