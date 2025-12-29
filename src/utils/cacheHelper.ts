import { SupabaseService } from '../services/supabaseService';

/**
 * Очищает кэш приложения, localStorage и обновляет Service Worker.
 * @param familyId ID семьи для пересчета аналитики (опционально)
 * @param preserveAuth Если true, сохраняет токены авторизации Supabase
 */
export const clearAppCache = async (familyId?: number, preserveAuth: boolean = false) => {
  console.log('🧹 Начинаем очистку кэша...');

  // 1. Очищаем все кэши браузера (Cache Storage)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      console.log('📦 Найдено кэшей:', cacheNames.length);
      await Promise.all(cacheNames.map(name => {
        console.log('🗑️ Удаляем кэш:', name);
        return caches.delete(name);
      }));
      console.log('✅ Все кэши удалены');
    } catch (e) {
      console.error('⚠️ Ошибка при очистке Cache Storage:', e);
    }
  }

  // 2. Очищаем localStorage
  console.log('🧹 Очищаем localStorage...');
  
  // Сохраняем данные, которые нужно оставить
  const itemsToPreserve: Record<string, string> = {};
  
  // Всегда сохраняем активную вкладку
  const savedTab = localStorage.getItem('groceryTrackerActiveTab');
  if (savedTab) itemsToPreserve['groceryTrackerActiveTab'] = savedTab;
  
  // Если нужно сохранить авторизацию, ищем ключи Supabase
  if (preserveAuth) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        const val = localStorage.getItem(key);
        if (val) itemsToPreserve[key] = val;
      }
    }
  }

  // Очищаем
  localStorage.clear();
  
  // Восстанавливаем сохраненные данные
  Object.entries(itemsToPreserve).forEach(([key, val]) => {
    localStorage.setItem(key, val);
  });
  
  console.log('✅ localStorage очищен' + (preserveAuth ? ' (сессия сохранена)' : ''));

  // 3. Пересчитываем всю аналитику
  if (familyId) {
    try {
      console.log('📊 Пересчитываем аналитику для семьи:', familyId);
      await SupabaseService.recalculateFamilyAnalytics(familyId);
      console.log('✅ Аналитика пересчитана');
    } catch (e) {
      console.error('⚠️ Ошибка при пересчете аналитики:', e);
    }
  } else {
      console.log('⚠️ Family ID не передан, пропускаем пересчет аналитики');
  }

  // 4. Обновляем Service Worker
  if ('serviceWorker' in navigator) {
    try {
      console.log('🔄 Обновляем Service Worker...');
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.update();
      }
      console.log('✅ Service Worker обновлен');
    } catch (e) {
      console.error('⚠️ Ошибка обновления Service Worker:', e);
    }
  }
};

