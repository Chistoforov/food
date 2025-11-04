import { useState } from 'react';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const PWAInstallButton = () => {
  const { isIOS, isStandalone, installPWA, canShowInstallButton } = usePWAInstall();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Не показываем кнопку если приложение уже установлено
  if (isStandalone || !canShowInstallButton) {
    return null;
  }

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
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      >
        <Download size={18} />
        {isInstalling ? 'Установка...' : 'Установить приложение'}
      </button>

      {/* Модалка с инструкциями для iOS */}
      {showIOSInstructions && (
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
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;

