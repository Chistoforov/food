import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Проверяем, является ли устройство iOS
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const result = /iphone|ipad|ipod/.test(userAgent);
      console.log('🔍 [PWA] Checking iOS:', { userAgent, isIOS: result });
      return result;
    };

    // Проверяем, запущено ли приложение в standalone режиме (уже установлено)
    const checkIsStandalone = () => {
      const displayMode = window.matchMedia('(display-mode: standalone)').matches;
      const navigatorStandalone = (window.navigator as any).standalone === true;
      const result = displayMode || navigatorStandalone;
      console.log('🔍 [PWA] Checking standalone:', { 
        displayMode, 
        navigatorStandalone, 
        isStandalone: result 
      });
      return result;
    };

    const iosCheck = checkIsIOS();
    const standaloneCheck = checkIsStandalone();
    
    setIsIOS(iosCheck);
    setIsStandalone(standaloneCheck);
    
    console.log('📱 [PWA] Initial state:', {
      isIOS: iosCheck,
      isStandalone: standaloneCheck,
      canShowButton: !standaloneCheck && (false || (iosCheck && !standaloneCheck))
    });

    // Для Android и других Chromium браузеров
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('📱 beforeinstallprompt event fired');
      // Предотвращаем автоматический показ prompt
      e.preventDefault();
      // Сохраняем событие для использования позже
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('✅ PWA установлено');
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) {
      console.log('⚠️ Install prompt недоступен');
      return;
    }

    try {
      // Показываем prompt
      await deferredPrompt.prompt();
      
      // Ждем ответа пользователя
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`👤 Пользователь ${outcome === 'accepted' ? 'принял' : 'отклонил'} установку`);
      
      // Очищаем сохраненный prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      return outcome;
    } catch (error) {
      console.error('❌ Ошибка при установке PWA:', error);
      throw error;
    }
  };

  const canShowButton = (isInstallable || (isIOS && !isStandalone));
  
  console.log('🎯 [PWA] Hook returning:', {
    isInstallable,
    isIOS,
    isStandalone,
    canShowInstallButton: canShowButton
  });

  return {
    isInstallable,
    isIOS,
    isStandalone,
    installPWA,
    canShowInstallButton: canShowButton
  };
};

