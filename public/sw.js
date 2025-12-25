const CACHE_NAME = 'grocery-tracker-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Установка service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  // Игнорируем расширения Chrome и другие схемы кроме http/https
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Кэшируем только GET запросы (Cache API не поддерживает POST/PUT/DELETE)
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Возвращаем кешированный ответ, если он есть
        if (response) {
          return response;
        }
        
        // Клонируем запрос
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Проверяем, что получили валидный ответ
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Клонируем ответ
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Возвращаем офлайн-страницу при отсутствии сети
          return caches.match('/');
        });
      })
  );
});

