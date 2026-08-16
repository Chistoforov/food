import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Share, Plus, Smartphone, Info } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const PWAInstallButton = () => {
  const { isIOS, isStandalone, installPWA, canShowInstallButton, isInstallable } = usePWAInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugRef = useRef<HTMLDivElement>(null);

  // Закрываем отладочную панель при клике вне её
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (debugRef.current && !debugRef.current.contains(event.target as Node)) {
        setShowDebugInfo(false);
      }
    };

    if (showDebugInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDebugInfo]);

  // Логируем состояние компонента
  console.log('🔘 [PWA Button] Component state:', {
    isIOS,
    isStandalone,
    isInstallable,
    canShowInstallButton,
    willShow: !isStandalone && canShowInstallButton
  });

  // Если приложение уже установлено - показываем информацию об этом
  if (isStandalone) {
    console.log('⏹️ [PWA Button] Hidden: App is already installed (standalone mode)');
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
        <Smartphone size={16} />
        <span>Установлено</span>
      </div>
    );
  }
  
  // Если кнопку нельзя показать - показываем отладочную информацию
  if (!canShowInstallButton) {
    console.log('⏹️ [PWA Button] Hidden: Cannot show install button (canShowInstallButton=false)');
    return (
      <div className="relative" ref={debugRef}>
        <button
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          title="Информация о PWA"
        >
          <Info size={16} />
          <span>PWA</span>
        </button>
        
        {showDebugInfo && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 text-xs">
            <div className="font-semibold mb-2">Отладка PWA:</div>
            <div className="space-y-1 text-gray-600">
              <div>iOS: {isIOS ? '✅ Да' : '❌ Нет'}</div>
              <div>Standalone: {isStandalone ? '✅ Да' : '❌ Нет'}</div>
              <div>Installable: {isInstallable ? '✅ Да' : '❌ Нет'}</div>
              <div className="pt-2 mt-2 border-t border-gray-200 text-gray-500">
                {isIOS 
                  ? 'На iOS используйте Safari: кнопка "Поделиться" → "На экран Домой"'
                  : 'Подождите несколько секунд или откройте меню браузера → "Установить приложение"'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  console.log('✅ [PWA Button] Showing install button!');

  const handleInstallClick = async () => {
    if (isIOS) {
      // На iOS показываем инструкции
      setShowIOSInstructions(true);
    } else {
      // На Android/Desktop вызываем prompt
      try {
        setIsInstalling(true);
        await installPWA();
      } catch (error) {
        console.error('Ошибка установки:', error);
      } finally {
        setIsInstalling(false);
      }
    }
  };

  return (
    <>
      {/* Кнопка установки */}
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap"
      >
        <Download size={18} className="animate-bounce" style={{ animationIterationCount: '3' }} />
        {isInstalling ? 'Установка...' : 'Установить'}
      </button>

      {/* Модалка с инструкциями для iOS */}
      {showIOSInstructions && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl transform animate-scaleIn">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-indigo-100">
                  <Smartphone className="text-indigo-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Установка на iOS</h2>
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              <p className="text-gray-600">
                Чтобы установить приложение на домашний экран:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      Нажмите кнопку <strong>"Поделиться"</strong> 
                      <Share size={16} className="inline mx-1" /> 
                      в нижней части Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      Прокрутите вниз и выберите <strong>"На экран Домой"</strong>
                      <Plus size={16} className="inline mx-1" />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      Нажмите <strong>"Добавить"</strong> в правом верхнем углу
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Совет:</strong> После установки приложение будет работать даже без интернета!
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PWAInstallButton;

