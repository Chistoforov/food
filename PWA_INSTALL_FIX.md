# Исправление проблем с установкой PWA

## Проблема

Сайт не предлагает установить PWA на телефон.

## Возможные причины и решения

### 1. Проверка манифеста

Ваш `manifest.json` выглядит корректно, но убедитесь, что он правильно загружается:

```json
{
  "name": "Grocery Tracker",
  "short_name": "Grocery",
  "description": "Отслеживание продуктов и расходов",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 2. Проверка иконок

Убедитесь, что файлы иконок существуют и доступны:

- `/public/icon-192.png` (размер 192x192 пикселей)
- `/public/icon-512.png` (размер 512x512 пикселей)

**Проверка через браузер:**
1. Откройте `https://ваш-домен.com/icon-192.png` в браузере
2. Откройте `https://ваш-домен.com/icon-512.png` в браузере
3. Убедитесь, что оба изображения загружаются

### 3. Проверка Service Worker

Service Worker должен быть зарегистрирован и активен. 

**Проверка в Chrome DevTools:**
1. Откройте DevTools (F12)
2. Перейдите на вкладку **Application**
3. В левом меню выберите **Service Workers**
4. Убедитесь, что Service Worker статус: **activated and is running**

**Если Service Worker не активен:**
- Нажмите **Unregister** и перезагрузите страницу
- Проверьте консоль на наличие ошибок

### 4. Требования для установки PWA

Для того, чтобы браузер предложил установить PWA, необходимо:

✅ HTTPS соединение (или localhost для разработки)
✅ Валидный manifest.json с name, short_name, start_url, display, icons
✅ Service Worker зарегистрирован и активен
✅ Иконки доступны (как минимум одна 192x192 или больше)
✅ Пользователь посетил сайт минимум 2 раза с интервалом минимум 5 минут (для некоторых браузеров)

### 5. Проверка в разных браузерах

#### Chrome (Android)
1. Откройте сайт в Chrome
2. Подождите несколько секунд
3. Должна появиться мини-панель внизу "Добавить на главный экран"
4. Или нажмите меню (три точки) → "Установить приложение"

#### Safari (iOS)
**ВНИМАНИЕ:** Safari iOS имеет свой механизм добавления на экран:
1. Откройте сайт в Safari
2. Нажмите кнопку "Поделиться" (квадрат со стрелкой вверх)
3. Прокрутите вниз и выберите "На экран «Домой»"
4. Нажмите "Добавить"

**Важно для iOS:**
- Safari iOS НЕ показывает автоматическое предложение установки
- Пользователь должен вручную добавить через меню "Поделиться"
- Убедитесь, что в `<head>` есть Apple-специфичные метатеги (они уже есть в `index.html`)

#### Firefox (Android)
1. Откройте сайт в Firefox
2. Нажмите меню → "Установить"

### 6. Отладка проблем с PWA

#### Chrome DevTools (Lighthouse)
1. Откройте DevTools (F12)
2. Перейдите на вкладку **Lighthouse**
3. Выберите категорию **Progressive Web App**
4. Нажмите **Generate report**
5. Изучите список проблем и предупреждений

#### Chrome DevTools (Application)
1. Откройте DevTools (F12)
2. Перейдите на вкладку **Application**
3. В левом меню выберите **Manifest**
4. Проверьте, что все поля корректно отображаются
5. Проверьте раздел **Installability** - там будут указаны причины, почему PWA не устанавливается

### 7. Распространенные проблемы

#### Проблема: "No matching service worker detected"
**Решение:** Убедитесь, что Service Worker зарегистрирован и имеет scope '/'

#### Проблема: "Manifest doesn't have a maskable icon"
**Решение:** Это предупреждение, не критичная ошибка. Можно игнорировать.

#### Проблема: "Site cannot be installed: no matching service worker detected"
**Решение:** 
1. Очистите кэш браузера
2. Удалите старый Service Worker
3. Перезагрузите страницу
4. Подождите несколько секунд для регистрации

#### Проблема: Icons не загружаются (404)
**Решение:**
1. Проверьте, что файлы существуют в `/public/icon-192.png` и `/public/icon-512.png`
2. После сборки (`npm run build`) они должны быть в `/dist/icon-192.png` и `/dist/icon-512.png`
3. Убедитесь, что пути в manifest.json правильные

### 8. Быстрая проверка

Выполните эти команды в консоли браузера (F12 → Console):

```javascript
// Проверить Service Worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => console.log('Scope:', reg.scope, 'Active:', !!reg.active));
});

// Проверить manifest
fetch('/manifest.json')
  .then(r => r.json())
  .then(m => console.log('Manifest:', m))
  .catch(e => console.error('Manifest error:', e));

// Проверить иконки
Promise.all([
  fetch('/icon-192.png').then(r => r.ok),
  fetch('/icon-512.png').then(r => r.ok)
]).then(([ok192, ok512]) => {
  console.log('Icon 192:', ok192 ? '✅' : '❌');
  console.log('Icon 512:', ok512 ? '✅' : '❌');
});
```

### 9. Принудительная установка (для тестирования)

Если вы разработчик и хотите протестировать установку:

1. Откройте Chrome DevTools
2. Перейдите на вкладку **Application**
3. Найдите раздел **Manifest**
4. В правом верхнем углу будет ссылка **"Add to home screen"** или аналогичная
5. Нажмите её для принудительной установки

### 10. После установки PWA

После успешной установки:
- PWA должно появиться на главном экране как обычное приложение
- При открытии не должно быть адресной строки браузера
- Должна быть своя собственная иконка
- Должен работать офлайн режим (базовый)

## Текущее состояние вашего проекта

Проверено:
- ✅ manifest.json корректный
- ✅ Service Worker создан и регистрируется
- ✅ index.html содержит все необходимые метатеги
- ⚠️ Нужно проверить доступность иконок на сервере
- ⚠️ Нужно проверить HTTPS

## Следующие шаги

1. Примените миграцию из `migration_add_recalculate_family_analytics.sql` для исправления ошибки "Сброс кэша"
2. Проверьте доступность иконок через браузер
3. Откройте Chrome DevTools → Application → Manifest и проверьте статус
4. Запустите Lighthouse аудит PWA
5. Попробуйте установить через Chrome DevTools (принудительно)
6. Если на iOS - используйте Safari и меню "Поделиться"

## Полезные ссылки

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Debugging PWAs](https://web.dev/debug-pwas/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)

## Дата создания

4 ноября 2025

## Автор

AI Assistant (Claude)

