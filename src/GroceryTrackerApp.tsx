import { useState, useRef, useEffect } from 'react';
import { Camera, ShoppingCart, Home, BarChart3, Clock, AlertCircle, CheckCircle, Edit2, Save, X, Upload, Loader2, XCircle, Trash2, ChevronLeft, ChevronRight, Eye, Calendar, RefreshCw, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useProducts, useReceipts, useProductHistory, useMonthlyStats } from './hooks/useSupabaseData';
import { SupabaseService } from './services/supabaseService';
import type { ProductHistory, Product } from './lib/supabase';
import ConfirmationModal from './components/ConfirmationModal';
import PWAInstallButton from './components/PWAInstallButton';
import { getColorScheme } from './components/ProductTypePatterns';

// Проверяем переменные окружения при загрузке
console.log('🔍 Environment check:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Настроен' : '❌ Отсутствует',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Настроен' : '❌ Отсутствует',
  VITE_PERPLEXITY_API_KEY: import.meta.env.VITE_PERPLEXITY_API_KEY ? '✅ Настроен' : '❌ Отсутствует'
});

const GroceryTrackerApp = () => {
  // Проверяем переменные окружения перед инициализацией
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ Переменные окружения Supabase не настроены!');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ошибка конфигурации</h2>
          <p className="text-gray-600 mb-4">
            Переменные окружения Supabase не настроены. Проверьте файл .env.local
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  // Восстанавливаем сохраненную вкладку из localStorage или используем 'home' по умолчанию
  const [activeTab, setActiveTab] = useState(() => {
    try {
      // Миграция: проверяем старый ключ и переносим на новый
      const oldTab = localStorage.getItem('activeTab');
      if (oldTab) {
        console.log('🔄 [MIGRATION] Найден старый ключ activeTab:', oldTab);
        localStorage.setItem('groceryTrackerActiveTab', oldTab);
        localStorage.removeItem('activeTab');
        console.log('✅ [MIGRATION] Перенесли на новый ключ');
      }

      const savedTab = localStorage.getItem('groceryTrackerActiveTab');
      console.log('🔄 [INIT] Восстанавливаем вкладку из localStorage:', savedTab);
      
      // Проверяем, что сохраненная вкладка является допустимой
      const validTabs = ['home', 'upload', 'products', 'analytics'];
      if (savedTab && validTabs.includes(savedTab)) {
        console.log('✅ [INIT] Вкладка валидна, восстанавливаем:', savedTab);
        return savedTab;
      } else {
        console.log('⚠️ [INIT] Вкладка невалидна или отсутствует, используем home. SavedTab:', savedTab);
      }
    } catch (error) {
      console.error('❌ [INIT] Ошибка при восстановлении вкладки:', error);
    }
    console.log('🏠 [INIT] Возвращаем home по умолчанию');
    return 'home';
  });
  
  const [selectedFamilyId] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<{month: string, year: number} | null>(null);
  const [showRestoredMessage, setShowRestoredMessage] = useState(false);

  // Обертка для setActiveTab с логированием
  const handleTabChange = (newTab: string) => {
    console.log('🔄 [CHANGE] Переключаем вкладку:', {
      from: activeTab,
      to: newTab,
      timestamp: new Date().toISOString()
    });
    setActiveTab(newTab);
  };

  // Логируем при каждом монтировании компонента
  useEffect(() => {
    console.log('🚀 [MOUNT] Компонент смонтирован, текущая вкладка:', activeTab);
    const stored = localStorage.getItem('groceryTrackerActiveTab');
    console.log('📦 [MOUNT] Значение в localStorage:', stored);
  }, []);

  // Показываем уведомление при восстановлении вкладки после обновления страницы
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('groceryTrackerActiveTab');
      const wasRestored = localStorage.getItem('groceryTrackerWasRestored');
      
      // Если вкладка была восстановлена и это не домашняя страница, показываем уведомление
      if (savedTab && savedTab !== 'home' && wasRestored !== 'shown') {
        setShowRestoredMessage(true);
        localStorage.setItem('groceryTrackerWasRestored', 'shown');
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
          setShowRestoredMessage(false);
          localStorage.removeItem('groceryTrackerWasRestored');
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Ошибка при показе уведомления:', error);
    }
  }, []);

  // Сохраняем текущую вкладку в localStorage при каждом изменении
  useEffect(() => {
    try {
      console.log('💾 [SAVE] Сохраняем текущую вкладку в localStorage:', activeTab);
      localStorage.setItem('groceryTrackerActiveTab', activeTab);
      console.log('✅ [SAVE] Вкладка сохранена успешно');
    } catch (error) {
      console.error('❌ [SAVE] Ошибка при сохранении вкладки:', error);
    }
  }, [activeTab]);

  // Сохраняем состояние перед выгрузкой страницы (для pull-to-refresh и обычной перезагрузки)
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem('groceryTrackerActiveTab', activeTab);
        console.log('💾 Сохранили вкладку перед выгрузкой:', activeTab);
      } catch (error) {
        console.error('❌ Ошибка при сохранении перед выгрузкой:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Также обрабатываем событие pagehide для iOS Safari
    const handlePageHide = () => {
      try {
        localStorage.setItem('groceryTrackerActiveTab', activeTab);
        console.log('💾 Сохранили вкладку при pagehide:', activeTab);
      } catch (error) {
        console.error('❌ Ошибка при сохранении при pagehide:', error);
      }
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [activeTab]);

  // Функции для навигации по месяцам
  const getCurrentMonth = () => {
    const now = new Date();
    return {
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: now.getFullYear()
    };
  };

  // Получаем данные из Supabase с обработкой ошибок
  let products, productsLoading, updateProduct, loadMoreProducts, loadingMoreProducts, hasMoreProducts, refetchProducts, receipts, receiptsLoading, deleteReceipt, loadMoreReceipts, loadingMoreReceipts, hasMoreReceipts, monthlyStatsData, statsLoading, recalculateStats, recalculateAllAnalytics, statsError, refetchStats;
  
  try {
    console.log('🔄 Инициализируем хуки Supabase...');
    
    const productsHook = useProducts(selectedFamilyId);
    products = productsHook.products;
    productsLoading = productsHook.loading;
    updateProduct = productsHook.updateProduct;
    loadMoreProducts = productsHook.loadMore;
    loadingMoreProducts = productsHook.loadingMore;
    hasMoreProducts = productsHook.hasMore;
    refetchProducts = productsHook.refetch;
    
    const receiptsHook = useReceipts(selectedFamilyId);
    receipts = receiptsHook.receipts;
    receiptsLoading = receiptsHook.loading;
    deleteReceipt = receiptsHook.deleteReceipt;
    loadMoreReceipts = receiptsHook.loadMore;
    loadingMoreReceipts = receiptsHook.loadingMore;
    hasMoreReceipts = receiptsHook.hasMore;
    
    // Получаем текущий месяц для загрузки статистики
    const currentMonth = selectedMonth || getCurrentMonth();
    const statsHook = useMonthlyStats(selectedFamilyId, currentMonth.month, currentMonth.year);
    monthlyStatsData = statsHook.stats;
    statsLoading = statsHook.loading;
    recalculateStats = statsHook.recalculateStats;
    recalculateAllAnalytics = statsHook.recalculateAllAnalytics;
    statsError = statsHook.error;
    refetchStats = statsHook.refetch;
    
    console.log('✅ Хуки Supabase инициализированы успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации хуков Supabase:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ошибка инициализации</h2>
          <p className="text-gray-600 mb-4">
            Не удалось инициализировать подключение к базе данных
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  // Подписка на обновления pending receipts для автоматического обновления статистики
  useEffect(() => {
    console.log('🔔 Подписываемся на обновления чеков для автообновления статистики');
    
    const unsubscribe = SupabaseService.subscribeToPendingReceipts(
      selectedFamilyId,
      (receipt) => {
        console.log('📡 Получено обновление чека:', receipt.status);
        
        // Когда чек успешно обработан, автоматически обновляем статистику
        if (receipt.status === 'completed') {
          console.log('✅ Чек обработан, автоматически обновляем статистику');
          refetchStats();
        }
      }
    );

    return () => {
      console.log('🔕 Отписываемся от обновлений чеков');
      unsubscribe();
    };
  }, [selectedFamilyId, refetchStats]);

  // Получаем текущий месяц для использования в компоненте
  const currentMonth = selectedMonth || getCurrentMonth();

  const goToPreviousMonth = () => {
    const date = new Date(currentMonth.year, parseInt(currentMonth.month) - 1, 1);
    date.setMonth(date.getMonth() - 1);
    
    setSelectedMonth({
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: date.getFullYear()
    });
  };

  const goToNextMonth = () => {
    const date = new Date(currentMonth.year, parseInt(currentMonth.month) - 1, 1);
    date.setMonth(date.getMonth() + 1);
    
    setSelectedMonth({
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: date.getFullYear()
    });
  };


  const isCurrentMonth = () => {
    if (!selectedMonth) return true;
    const current = getCurrentMonth();
    return selectedMonth.month === current.month && selectedMonth.year === current.year;
  };

  const canGoToNextMonth = () => {
    return !isCurrentMonth();
  };

  // Обработчики для свайпов
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Проверяем, что это горизонтальный свайп (не вертикальный)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // Свайп вправо - предыдущий месяц
          goToPreviousMonth();
        } else {
          // Свайп влево - следующий месяц (если возможно)
          if (canGoToNextMonth()) {
            goToNextMonth();
          }
        }
      }
      
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Обрабатываем данные для совместимости с существующим UI
  const processedProducts = products.map(product => ({
    id: product.id,
    name: product.name,
    originalName: product.original_name,
    product_type: product.product_type,
    lastPurchase: product.last_purchase,
    avgDays: product.avg_days,
    predictedEnd: product.predicted_end,
    status: product.status,
    calories: product.calories,
    price: product.price,
    purchaseCount: product.purchase_count
  }));

  const processedReceipts = receipts.map(receipt => ({
    id: receipt.id,
    date: receipt.date,
    items: receipt.items_count,
    total: receipt.total_amount,
    status: receipt.status
  }));

  // Формат месяца в базе: 'YYYY-MM' (например '2024-12')
  // Преобразуем currentMonth в этот формат для сравнения
  const targetMonthKey = `${currentMonth.year}-${currentMonth.month.padStart(2, '0')}`;
  
  // Логируем для отладки
  console.log('🔍 Ищем статистику:', {
    targetMonthKey,
    currentMonth,
    availableStats: monthlyStatsData.map(s => ({ month: s.month, year: s.year, spent: s.total_spent }))
  });
  
  const selectedStats = monthlyStatsData.find(stat => {
    // stat.month может быть в формате 'YYYY-MM' или просто 'MM'
    // Проверяем оба варианта для совместимости
    if (stat.month.includes('-')) {
      // Формат 'YYYY-MM'
      const matches = stat.month === targetMonthKey;
      if (matches) {
        console.log('✅ Найдена статистика:', { month: stat.month, year: stat.year, spent: stat.total_spent });
      }
      return matches;
    } else {
      // Формат 'MM' - сравниваем отдельно
      const matches = stat.month === currentMonth.month && stat.year === currentMonth.year;
      if (matches) {
        console.log('✅ Найдена статистика (старый формат):', { month: stat.month, year: stat.year, spent: stat.total_spent });
      }
      return matches;
    }
  }) || null;
  
  if (!selectedStats && monthlyStatsData.length > 0) {
    console.warn('⚠️ Статистика за выбранный месяц не найдена, но есть данные за другие месяцы');
  } else if (!selectedStats) {
    console.warn('⚠️ Статистика отсутствует - возможно, данные еще не рассчитаны');
  }
  
  const monthlyStats = selectedStats ? {
    totalSpent: selectedStats.total_spent,
    totalCalories: selectedStats.total_calories,
    avgCaloriesPerDay: selectedStats.avg_calories_per_day,
    receiptsCount: selectedStats.receipts_count,
    trends: {
      spending: 12, // % изменение - можно вычислить из данных
      calories: -8,
      receipts: 5
    },
    highlights: [
      { text: 'Купили на 45% больше молока', trend: 'up', product: 'Молоко 2L' },
      { text: 'Хлеба на 22% меньше чем обычно', trend: 'down', product: 'Хлеб белый' },
      { text: 'Новый продукт: Творог 500г', trend: 'new', product: 'Творог 500г' }
    ]
  } : {
    totalSpent: 0,
    totalCalories: 0,
    avgCaloriesPerDay: 0,
    receiptsCount: 0,
    trends: { spending: 0, calories: 0, receipts: 0 },
    highlights: []
  };

  // Главная страница
  const HomePage = () => {
    const [productTypeStats, setProductTypeStats] = useState<Record<string, {
      status: 'ending-soon' | 'ok' | 'calculating'
      productCount: number
    }>>({})
    const [loadingTypeStats, setLoadingTypeStats] = useState(false)
    const [deleteTypeConfirm, setDeleteTypeConfirm] = useState<string | null>(null)
    const [deletingType, setDeletingType] = useState(false)
    const [virtualPurchaseLoading, setVirtualPurchaseLoading] = useState<string | null>(null)

    // Загружаем статистику по типам продуктов из КЭША (быстро!)
    // Кэш автоматически обновляется триггерами при изменениях
    useEffect(() => {
      const loadTypeStats = async () => {
        try {
          setLoadingTypeStats(true)
          const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
          setProductTypeStats(stats)
        } catch (error) {
          console.error('Ошибка загрузки статистики по категориям:', error)
        } finally {
          setLoadingTypeStats(false)
        }
      }
      
      // Загружаем только при открытии главной страницы
      if (activeTab === 'home') {
        loadTypeStats()
      }
    }, [activeTab, selectedFamilyId]) // Убрали products.length - кэш обновляется автоматически

    const handleDeleteProductType = async () => {
      if (!deleteTypeConfirm) return
      
      try {
        setDeletingType(true)
        console.log('🗑️ Удаляем тип продукта:', deleteTypeConfirm)
        
        await SupabaseService.deleteProductType(deleteTypeConfirm, selectedFamilyId)
        
        // Обновляем статистику типов
        const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
        setProductTypeStats(stats)
        
        console.log('✅ Тип продукта успешно удален')
        setDeleteTypeConfirm(null)
      } catch (error) {
        console.error('❌ Ошибка удаления типа продукта:', error)
        alert('Ошибка удаления типа продукта. Попробуйте еще раз.')
      } finally {
        setDeletingType(false)
      }
    }

    const handleVirtualPurchase = async (productType: string) => {
      try {
        setVirtualPurchaseLoading(productType)
        console.log('🔄 Добавляем виртуальную покупку для типа:', productType)
        
        // Добавляем виртуальную покупку для всех продуктов этого типа
        // Используем метод, который получает продукты напрямую из БД
        const updatedCount = await SupabaseService.addVirtualPurchaseForType(productType, selectedFamilyId)
        
        if (updatedCount === 0) {
          console.warn('⚠️ Нет продуктов для этого типа')
          alert('Не найдено продуктов этого типа')
          return
        }
        
        console.log(`✅ Виртуальные покупки добавлены для ${updatedCount} продуктов`)
        
        // Обновляем список продуктов (чтобы получить новые статусы)
        await refetchProducts()
        
        // Обновляем статистику типов
        const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
        setProductTypeStats(stats)
        
        console.log('✅ Продукты и статистика обновлены')
      } catch (error) {
        console.error('❌ Ошибка добавления виртуальной покупки:', error)
        alert('Ошибка обновления. Попробуйте еще раз.')
      } finally {
        setVirtualPurchaseLoading(null)
      }
    }

    return (
    <div className="space-y-6">
      {/* Модалка подтверждения удаления типа */}
      <ConfirmationModal
        isOpen={!!deleteTypeConfirm}
        onClose={() => setDeleteTypeConfirm(null)}
        onConfirm={handleDeleteProductType}
        title="Удалить тип продукта?"
        message={`Вы уверены, что хотите удалить тип продукта "${deleteTypeConfirm}"?\n\nУ всех продуктов этого типа будет очищен тип, и они перестанут отслеживаться как группа.\n\nЭто действие нельзя отменить.`}
        confirmText="Да, удалить"
        cancelText="Отмена"
        isLoading={deletingType}
        variant="danger"
      />
      
      {/* Статистика за месяц */}
      <div 
        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"
        onTouchStart={handleTouchStart}
      >
        {/* Навигация по месяцам */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <h2 className="text-xl font-bold px-4">
            {(() => {
              const monthStr = currentMonth.month.includes('-') 
                ? currentMonth.month.split('-')[1] 
                : currentMonth.month;
              const monthName = new Date(currentMonth.year, parseInt(monthStr) - 1).toLocaleString('ru', { month: 'long' });
              return `${monthName} ${currentMonth.year}`;
            })()}
          </h2>
          
          <button
            onClick={goToNextMonth}
            disabled={!canGoToNextMonth()}
            className={`p-2.5 rounded-lg transition-colors ${
              canGoToNextMonth()
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
            }`}
            title={canGoToNextMonth() ? "Следующий месяц" : "Нельзя перейти в будущее"}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Кнопка обновления */}
        <div className="mb-4">
          <button
            onClick={async () => {
              try {
                await recalculateStats();
              } catch (error) {
                console.error('Ошибка пересчета статистики:', error);
              }
            }}
            disabled={statsLoading}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              statsLoading 
                ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                : 'bg-white/20 hover:bg-white/30 active:bg-white/40'
            }`}
            title="Пересчитать статистику"
          >
            {statsLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                Обновление...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={16} />
                Обновить статистику
              </span>
            )}
          </button>
        </div>
        {statsError && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
            <div className="text-red-800 text-sm">
              <strong>Ошибка:</strong> {statsError}
            </div>
          </div>
        )}
        {statsLoading ? (
          <div className="text-center py-4">Загрузка статистики...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm opacity-90">Потрачено</div>
              <div className="text-2xl font-bold">€{monthlyStats.totalSpent.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm opacity-90">Калорий</div>
              <div className="text-2xl font-bold">{(monthlyStats.totalCalories / 1000).toFixed(0)}k</div>
            </div>
            <div>
              <div className="text-sm opacity-90">Среднее в день</div>
              <div className="text-xl font-semibold">{monthlyStats.avgCaloriesPerDay} ккал</div>
            </div>
            <div>
              <div className="text-sm opacity-90">Чеков</div>
              <div className="text-xl font-semibold">{monthlyStats.receiptsCount}</div>
            </div>
          </div>
        )}
      </div>

      {/* Обзор по типам продуктов */}
      {!loadingTypeStats && Object.keys(productTypeStats).length > 0 && (() => {
        // Сортируем типы: сначала те, которые заканчиваются, потом по количеству продуктов
        const sortedTypes = Object.entries(productTypeStats).sort(([, a], [, b]) => {
          // Приоритет статусов: ending-soon > ok > calculating
          const statusPriority = { 'ending-soon': 0, 'ok': 1, 'calculating': 2 };
          if (a.status !== b.status) {
            return statusPriority[a.status] - statusPriority[b.status];
          }
          // При одинаковом статусе сортируем по количеству продуктов
          return b.productCount - a.productCount;
        });

        return sortedTypes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Типы продуктов</h3>
            <div className="grid grid-cols-2 gap-3">
              {sortedTypes.map(([type, typeData]) => {
                const typeStatus = typeData.status;
                const isLoading = virtualPurchaseLoading === type;
                const colorScheme = getColorScheme(typeStatus);
                
                return (
                  <div 
                    key={type} 
                    className={`rounded-xl p-4 border-2 transition-all relative min-h-[120px] overflow-hidden ${colorScheme.border}`}
                    style={{
                      background: `linear-gradient(135deg, ${colorScheme.gradientStart} 0%, ${colorScheme.gradientEnd} 100%)`
                    }}
                  >
                    {/* Контент в три ряда */}
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      {/* Ряд 1: Название */}
                      <h4 className="font-bold text-gray-900 capitalize text-lg mb-2">{type}</h4>
                      
                      {/* Ряд 2: Статус */}
                      <div className={`text-sm font-medium mb-3 ${
                        typeStatus === 'ending-soon' 
                          ? 'text-orange-700' 
                          : typeStatus === 'ok'
                            ? 'text-green-700'
                            : 'text-blue-700'
                      }`}>
                        {typeStatus === 'ending-soon' && 'Заканчивается'}
                        {typeStatus === 'ok' && 'В наличии'}
                        {typeStatus === 'calculating' && 'Расчет...'}
                      </div>
                      
                      {/* Ряд 3: Иконки и кнопки */}
                      <div className="flex items-center gap-3 mt-auto">
                        {/* Иконка статуса */}
                        {typeStatus === 'ending-soon' && (
                          <div className="p-1.5 rounded-lg bg-orange-100/50">
                            <AlertCircle size={20} className="text-orange-600 flex-shrink-0" />
                          </div>
                        )}
                        {typeStatus === 'ok' && (
                          <div className="p-1.5 rounded-lg bg-green-100/50">
                            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                          </div>
                        )}
                        {typeStatus === 'calculating' && (
                          <div className="p-1.5 rounded-lg bg-blue-100/50">
                            <Clock size={20} className="text-blue-600 flex-shrink-0" />
                          </div>
                        )}
                        
                        {/* Кнопка удаления (корзина) */}
                        <button
                          onClick={() => setDeleteTypeConfirm(type)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить тип продукта"
                        >
                          <Trash2 size={18} />
                        </button>
                        
                        {/* Spacer - чтобы кнопка виртуальной покупки была справа */}
                        <div className="flex-1"></div>
                        
                        {/* Кнопка виртуальной покупки (только для ending-soon) */}
                        {typeStatus === 'ending-soon' && (
                          <button
                            onClick={() => handleVirtualPurchase(type)}
                            disabled={isLoading}
                            className={`p-2 rounded-lg transition-all shadow-md ${
                              isLoading 
                                ? 'bg-green-200 text-green-400 cursor-not-allowed' 
                                : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                            }`}
                            title="Продукт еще есть (+2 дня к прогнозу)"
                          >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
    );
  };

  // Receipt Detail Modal Component
  const ReceiptDetailModal = ({ 
    receiptId, 
    onClose, 
    onDateUpdated 
  }: { 
    receiptId: number, 
    onClose: () => void,
    onDateUpdated: () => void 
  }) => {
    const [products, setProducts] = useState<Array<ProductHistory & { product?: Product }>>([]);
    const [loading, setLoading] = useState(true);
    const [editingDate, setEditingDate] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [updating, setUpdating] = useState(false);
    const [receipt, setReceipt] = useState<any>(null);

    useEffect(() => {
      loadReceiptDetails();
    }, [receiptId]);

    const loadReceiptDetails = async () => {
      try {
        setLoading(true);
        
        // Get receipt info
        const receiptData = receipts.find(r => r.id === receiptId);
        setReceipt(receiptData);
        setNewDate(receiptData?.date || '');
        
        // Get products from this receipt
        const receiptProducts = await SupabaseService.getReceiptProducts(receiptId, selectedFamilyId);
        setProducts(receiptProducts);
      } catch (error) {
        console.error('Error loading receipt details:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleUpdateDate = async () => {
      try {
        setUpdating(true);
        await SupabaseService.updateReceiptDate(receiptId, selectedFamilyId, newDate);
        
        // Refresh data
        await loadReceiptDetails();
        onDateUpdated();
        setEditingDate(false);
      } catch (error) {
        console.error('Error updating date:', error);
      } finally {
        setUpdating(false);
      }
    };

    if (loading) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-indigo-600 mb-4 animate-spin" />
              <p className="text-gray-600">Загрузка чека...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Детали чека</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Date Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={20} />
                  <span className="font-medium">Дата покупки:</span>
                </div>
                {!editingDate && (
                  <button
                    onClick={() => setEditingDate(true)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Изменить дату"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
              </div>

              {editingDate ? (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateDate}
                      disabled={updating || !newDate || newDate === receipt?.date}
                      className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Обновление...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingDate(false);
                        setNewDate(receipt?.date || '');
                      }}
                      disabled={updating}
                      className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Info size={14} className="flex-shrink-0" />
                    При изменении даты будет пересчитана статистика для старого и нового месяца
                  </p>
                </div>
              ) : (
                <div className="text-lg font-semibold text-gray-900">
                  {receipt ? new Date(receipt.date).toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  }) : '—'}
                </div>
              )}
            </div>

            {/* Receipt Summary */}
            <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-500">Товаров</div>
                <div className="text-xl font-bold text-gray-900">{products.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Сумма</div>
                <div className="text-xl font-bold text-indigo-600">
                  €{receipt?.total_amount?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="p-6 space-y-3">
            <h3 className="font-semibold text-gray-900 mb-4">Продукты в чеке:</h3>
            {products.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
                <p>Нет продуктов в чеке</p>
              </div>
            ) : (
              products.map((item, index) => (
                <div 
                  key={index} 
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {item.product?.name || 'Неизвестный товар'}
                      </h4>
                      {item.product?.original_name && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {item.product.original_name}
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-indigo-600">
                      €{item.price.toFixed(2)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                    <div>
                      <div className="text-gray-500">Количество</div>
                      <div className="font-medium text-gray-900">{item.quantity}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Цена за ед.</div>
                      <div className="font-medium text-gray-900">€{item.unit_price.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Калории</div>
                      <div className="font-medium text-gray-900">
                        {item.product?.calories || 0} ккал
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Страница загрузки чека
  const UploadPage = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadErrorClosing, setUploadErrorClosing] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadSuccessClosing, setUploadSuccessClosing] = useState(false);
    const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Пожалуйста, выберите файл изображения');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Размер файла не должен превышать 10MB');
        return;
      }

      setIsProcessing(true);
      setUploadError(null);
      setUploadSuccess(false);

      try {
        // Upload image and create pending receipt (FAST - user can close app)
        console.log('📤 Uploading receipt for background processing...');
        const pendingReceipt = await SupabaseService.uploadReceiptForProcessing(
          selectedFamilyId,
          file
        );

        console.log('✅ Receipt uploaded, triggering background processing...');
        
        // Trigger background processing (fire and forget)
        await SupabaseService.triggerReceiptProcessing(pendingReceipt.id);
        
        setUploadSuccess(true);
        setUploadSuccessClosing(false);
        
        // Show success message with smooth closing animation
        // Start closing animation 500ms before hiding
        setTimeout(() => {
          setUploadSuccessClosing(true);
        }, 2500);
        
        // Hide message after animation completes
        setTimeout(() => {
          setUploadSuccess(false);
          setUploadSuccessClosing(false);
        }, 3000);

      } catch (error) {
        console.error('Error uploading receipt:', error);
        setUploadError(
          error instanceof Error 
            ? `Ошибка загрузки чека: ${error.message}` 
            : 'Не удалось загрузить чек. Попробуйте еще раз.'
        );
      } finally {
        setIsProcessing(false);
        // Reset file inputs
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
        if (galleryInputRef.current) {
          galleryInputRef.current.value = '';
        }
      }
    };

    const triggerCameraInput = () => {
      cameraInputRef.current?.click();
    };

    const triggerGalleryInput = () => {
      galleryInputRef.current?.click();
    };

    const handleDeleteReceipt = async (receiptId: number) => {
      try {
        setDeletingReceiptId(receiptId);
        console.log('🗑️ Удаляем чек #' + receiptId);
        
        // Удаляем чек из базы данных
        await deleteReceipt(receiptId);
        
        console.log('✅ Чек успешно удален из БД');
        setDeleteConfirmId(null);
        
        // Пересчитываем всю аналитику после удаления
        console.log('🔄 Пересчитываем всю аналитику...');
        await recalculateAllAnalytics();
        
        // Обновляем статистику
        console.log('🔄 Обновляем статистику...');
        await refetchStats();
        
        console.log('✅ Вся аналитика пересчитана');
      } catch (error) {
        console.error('❌ Ошибка удаления чека:', error);
        setUploadError(
          error instanceof Error 
            ? `Ошибка удаления чека: ${error.message}` 
            : 'Не удалось удалить чек. Попробуйте еще раз.'
        );
      } finally {
        setDeletingReceiptId(null);
      }
    };

    const handleDateUpdated = async () => {
      // Reload receipts and stats after date update
      await refetchStats();
      // The receipts will be automatically refreshed by the hook
    };

    return (
      <div className="space-y-6">
        {/* Receipt Detail Modal */}
        {selectedReceiptId && (
          <ReceiptDetailModal
            receiptId={selectedReceiptId}
            onClose={() => setSelectedReceiptId(null)}
            onDateUpdated={handleDateUpdated}
          />
        )}

        <h2 className="text-2xl font-bold">Загрузить чек</h2>
        
        {/* Success Message */}
        {uploadSuccess && (
          <div className={`bg-green-50 border border-green-200 rounded-xl p-4 transition-all ${
            uploadSuccessClosing ? 'message-fade-out' : 'message-fade-in'
          }`}>
            <div className="flex items-start gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0 animate-bounce" style={{ animationIterationCount: '2' }} />
              <div className="flex-1">
                <div className="font-semibold text-green-900 mb-1">Чек загружен!</div>
                <div className="text-sm text-green-700">
                  Чек обрабатывается в фоновом режиме. Вы можете закрыть приложение - 
                  обработка продолжится автоматически.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {uploadError && (
          <div className={`bg-red-50 border border-red-200 rounded-xl p-4 transition-all ${
            uploadErrorClosing ? 'message-fade-out' : 'message-fade-in'
          }`}>
            <div className="flex items-start gap-3">
              <XCircle size={24} className="text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-red-900 mb-1">Ошибка</div>
                <div className="text-sm text-red-700">{uploadError}</div>
              </div>
              <button 
                onClick={() => {
                  setUploadErrorClosing(true);
                  setTimeout(() => {
                    setUploadError(null);
                    setUploadErrorClosing(false);
                  }, 500);
                }}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isProcessing 
              ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed' 
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          {/* Input для камеры (с capture) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
          
          {/* Input для галереи (без capture) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
          
          {isProcessing ? (
            <>
              <Loader2 size={48} className="mx-auto text-indigo-600 mb-4 animate-spin" />
              <p className="text-lg font-semibold text-gray-700 mb-2">Загружаем чек...</p>
              <p className="text-sm text-gray-500">Это займет всего пару секунд</p>
            </>
          ) : (
            <>
              <Camera size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-semibold text-gray-700 mb-2">Сфотографируйте чек</p>
              <p className="text-sm text-gray-500 mb-2">или выберите фото из галереи</p>
              <p className="text-xs text-indigo-600 font-medium mb-4 flex items-center justify-center gap-1">
                <Sparkles size={14} className="flex-shrink-0" />
                Обработка в фоне - можно закрыть приложение!
              </p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerCameraInput();
                  }}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Camera size={20} />
                  Камера
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerGalleryInput();
                  }}
                  className="bg-white text-indigo-600 border-2 border-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
                >
                  <Upload size={20} />
                  Галерея
                </button>
              </div>
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Как это работает:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Сфотографируйте чек или выберите фото</li>
                <li>AI автоматически распознает продукты, цены и количество</li>
                <li>Калории рассчитываются для полного купленного объема</li>
                <li>Все данные автоматически добавляются в ваш список</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Receipts */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Последние чеки</h3>
          <div className="space-y-3">
            {receiptsLoading ? (
              <div className="text-center py-8 text-gray-500">Загрузка чеков...</div>
            ) : processedReceipts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Camera size={48} className="mx-auto mb-3 opacity-50" />
                <p>Пока нет загруженных чеков</p>
              </div>
            ) : (
              processedReceipts.map(receipt => (
                <div key={receipt.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  {deleteConfirmId === receipt.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle size={20} />
                        <span className="font-semibold">Удалить этот чек?</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Все продукты из этого чека будут удалены из подсчетов. Это действие нельзя отменить.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteReceipt(receipt.id)}
                          disabled={deletingReceiptId === receipt.id}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingReceiptId === receipt.id ? 'Удаление...' : 'Да, удалить'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deletingReceiptId === receipt.id}
                          className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedReceiptId(receipt.id)}
                      >
                        <div className="font-semibold text-gray-900">{new Date(receipt.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                        <div className="text-sm text-gray-500">{receipt.items} товаров</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-gray-900">€{receipt.total.toFixed(2)}</div>
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Обработан
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedReceiptId(receipt.id)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Просмотреть чек"
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(receipt.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить чек"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Кнопка "Загрузить еще" */}
          {!receiptsLoading && hasMoreReceipts && processedReceipts.length > 0 && loadMoreReceipts && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => loadMoreReceipts(20)}
                disabled={loadingMoreReceipts}
                className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                  loadingMoreReceipts
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loadingMoreReceipts ? 'Загрузка...' : 'Загрузить еще'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Страница аналитики
  const AnalyticsPage = () => {
    const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
    const [dateRange, setDateRange] = useState('month'); // week, month, 3months, all
    const [showProductSelect, setShowProductSelect] = useState(false);
    const [chartType, setChartType] = useState('quantity'); // quantity, price

    // Получаем историю продукта из Supabase
    const { history: productHistory, loading: historyLoading } = useProductHistory(selectedProduct || 0, selectedFamilyId);

    const dateRangeOptions = [
      { value: 'week', label: 'Неделя' },
      { value: 'month', label: 'Месяц' },
      { value: '3months', label: '3 месяца' },
      { value: 'all', label: 'Всё время' }
    ];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Аналитика</h2>
        
        {/* Выбор продукта */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="font-semibold mb-4">Динамика продукта</h3>
          
          <div className="space-y-4">
            {/* Селектор продукта */}
            <div className="relative">
              <button
                onClick={() => setShowProductSelect(!showProductSelect)}
                className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:border-indigo-500 transition-colors"
              >
                <span className={selectedProduct ? 'text-gray-900' : 'text-gray-500'}>
                  {selectedProduct ? processedProducts.find(p => p.id === selectedProduct)?.name : 'Выберите продукт'}
                </span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showProductSelect ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProductSelect && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {(() => {
                    // Фильтруем продукты: только те, что куплены более 3 раз
                    const frequentProducts = processedProducts.filter(p => p.purchaseCount > 3);
                    
                    if (frequentProducts.length === 0) {
                      return (
                        <div className="p-4 text-center text-gray-500">
                          <p>Нет продуктов для отображения</p>
                          <p className="text-sm mt-1">Нужно купить продукт более 3 раз, чтобы увидеть его динамику</p>
                        </div>
                      );
                    }
                    
                    return frequentProducts
                      .sort((a, b) => b.purchaseCount - a.purchaseCount)
                      .map(product => (
                        <button
                          key={product.id}
                          onClick={() => {
                            setSelectedProduct(product.id);
                            setShowProductSelect(false);
                          }}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            {product.purchaseCount} {product.purchaseCount === 1 ? 'покупка' : product.purchaseCount < 5 ? 'покупки' : 'покупок'}
                          </div>
                        </button>
                      ));
                  })()}
                </div>
              )}
            </div>

            {/* Выбор периода и типа графика */}
            {selectedProduct && (
              <>
                <div className="space-y-4">
                  {/* Переключатель типа графика */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartType('quantity')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'quantity'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Количество
                    </button>
                    <button
                      onClick={() => setChartType('price')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'price'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Цена
                    </button>
                  </div>

                  {/* Выбор периода */}
                  <div className="flex gap-2">
                    {dateRangeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDateRange(option.value)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          dateRange === option.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* График */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">
                      {chartType === 'quantity' ? 'Динамика количества покупок' : 'Динамика цены продукта'}
                    </h4>
                    <div className="text-sm text-gray-500">
                      {productHistory?.length || 0} покупок
                    </div>
                  </div>
                  
                  {historyLoading ? (
                    <div className="text-center py-8 text-gray-500">Загрузка истории...</div>
                  ) : productHistory && productHistory.length > 0 ? (
                    <>
                      <div className="flex gap-3">
                        {/* Ось Y (боковая шкала) */}
                        <div className="flex flex-col justify-between h-48 py-2">
                          {(() => {
                            const data = productHistory.map(h => chartType === 'quantity' ? h.quantity : h.unit_price);
                            const maxValue = Math.max(...data);
                            const minValue = Math.min(...data);
                            const range = maxValue - minValue;
                            
                            // Генерируем 5 делений шкалы
                            const steps = 5;
                            const stepValue = range / (steps - 1);
                            
                            return Array.from({ length: steps }, (_, i) => {
                              const value = maxValue - (stepValue * i);
                              return (
                                <div key={i} className="text-xs text-gray-500 font-medium text-right pr-2 leading-none">
                                  {chartType === 'quantity' 
                                    ? Math.round(value)
                                    : `€${value.toFixed(2)}`
                                  }
                                </div>
                              );
                            });
                          })()}
                        </div>
                        
                        {/* График с горизонтальными линиями сетки */}
                        <div className="flex-1 relative">
                          {/* Горизонтальные линии сетки */}
                          <div className="absolute inset-0 flex flex-col justify-between py-2">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div key={i} className="border-t border-gray-100"></div>
                            ))}
                          </div>
                          
                          {/* Столбцы графика */}
                          <div className="relative flex items-end justify-between gap-2 h-48 border-b border-l border-gray-300 pb-2 pl-2">
                            {productHistory.map((item, i) => {
                              const data = chartType === 'quantity' ? item.quantity : item.unit_price;
                              const maxValue = chartType === 'quantity' 
                                ? Math.max(...productHistory.map(h => h.quantity))
                                : Math.max(...productHistory.map(h => h.unit_price));
                              const height = (data / maxValue) * 100;
                              
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 relative z-10">
                                  <div className="text-xs font-semibold text-gray-700">
                                    {chartType === 'quantity' ? item.quantity : `€${item.unit_price.toFixed(2)}`}
                                  </div>
                                  <div 
                                    className={`w-full rounded-t hover:opacity-80 transition-all cursor-pointer ${
                                      chartType === 'quantity' 
                                        ? 'bg-gradient-to-t from-indigo-500 to-indigo-400 hover:from-indigo-600 hover:to-indigo-500'
                                        : 'bg-gradient-to-t from-green-500 to-green-400 hover:from-green-600 hover:to-green-500'
                                    }`}
                                    style={{ height: `${height}%` }}
                                  ></div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Ось X (время) */}
                      <div className="flex gap-3">
                        <div className="w-12"></div> {/* Отступ для выравнивания с осью Y */}
                        <div className="flex-1 flex justify-between mt-2 text-xs text-gray-500 pl-2">
                          {productHistory.map((item, i) => (
                            <div key={i} className="flex-1 text-center">
                              {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Статистика по продукту */}
                      <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                        {chartType === 'quantity' ? (
                          <>
                            <div>
                              <div className="text-xs text-gray-500">Всего куплено</div>
                              <div className="text-lg font-bold text-gray-900">
                                {productHistory.reduce((sum, item) => sum + item.quantity, 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Потрачено</div>
                              <div className="text-lg font-bold text-gray-900">
                                €{productHistory.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Частота</div>
                              <div className="text-lg font-bold text-gray-900">
                                {processedProducts.find(p => p.id === selectedProduct)?.avgDays} дн
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <div className="text-xs text-gray-500">Средняя цена</div>
                              <div className="text-lg font-bold text-gray-900">
                                €{(productHistory.reduce((sum, item) => sum + item.unit_price, 0) / productHistory.length).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Изменение</div>
                              <div className={`text-lg font-bold ${
                                (() => {
                                  if (!productHistory || productHistory.length < 2) return 'text-gray-900';
                                  const firstPrice = productHistory[0].unit_price;
                                  const lastPrice = productHistory[productHistory.length - 1].unit_price;
                                  const change = ((lastPrice - firstPrice) / firstPrice) * 100;
                                  return change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-900';
                                })()
                              }`}>
                                {(() => {
                                  if (!productHistory || productHistory.length < 2) return '—';
                                  const firstPrice = productHistory[0].unit_price;
                                  const lastPrice = productHistory[productHistory.length - 1].unit_price;
                                  const change = ((lastPrice - firstPrice) / firstPrice) * 100;
                                  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
                                })()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Диапазон</div>
                              <div className="text-lg font-bold text-gray-900">
                                €{Math.min(...productHistory.map(h => h.unit_price)).toFixed(2)} - €{Math.max(...productHistory.map(h => h.unit_price)).toFixed(2)}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Нет данных для отображения</div>
                  )}
                </div>
              </>
            )}

            {!selectedProduct && (
              <div className="py-12 text-center text-gray-400">
                <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                <p>Выберите продукт для просмотра динамики</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="font-semibold mb-4">Топ продуктов по калориям</h3>
          <div className="space-y-3">
            {processedProducts.sort((a, b) => b.calories - a.calories).map(product => (
              <div key={product.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium">{product.name}</div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div 
                      className="bg-orange-400 h-2 rounded-full" 
                      style={{ width: `${(product.calories / 1500) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="ml-4 text-sm font-semibold text-gray-700">{product.calories} ккал</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Страница продуктов
  const ProductsPage = () => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editedCalories, setEditedCalories] = useState<string>('');
    const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
    const [editedProductType, setEditedProductType] = useState<string>('');
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [isClearingCache, setIsClearingCache] = useState(false);

    const startEditing = (product: typeof processedProducts[0]) => {
      setEditingId(product.id);
      setEditedCalories(product.calories.toString());
    };

    const startEditingType = (product: typeof processedProducts[0]) => {
      setEditingTypeId(product.id);
      setEditedProductType(product.product_type || '');
    };

    const cancelEditing = () => {
      setEditingId(null);
      setEditedCalories('');
    };

    const cancelEditingType = () => {
      setEditingTypeId(null);
      setEditedProductType('');
    };

    const saveCalories = async (productId: number) => {
      const newCalories = parseInt(editedCalories);
      if (!isNaN(newCalories) && newCalories >= 0) {
        try {
          await updateProduct(productId, { calories: newCalories });
          setEditingId(null);
          setEditedCalories('');
          
          // Показываем уведомление о пересчете статистики
          setSuccessMessage('Калорийность обновлена');
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        } catch (error) {
          console.error('Ошибка обновления калорий:', error);
        }
      }
    };

    const saveProductType = async (productId: number) => {
      try {
        // Приводим к нижнему регистру и убираем лишние пробелы
        const normalizedType = editedProductType.trim().toLowerCase();
        
        await updateProduct(productId, { product_type: normalizedType || undefined });
        
        // Пересчитываем статистику для этого продукта
        await SupabaseService.updateProductStats(productId, selectedFamilyId);
        
        setEditingTypeId(null);
        setEditedProductType('');
        
        // Показываем уведомление
        setSuccessMessage('Тип продукта обновлен. Прогноз пересчитан с учетом группы.');
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 5000);
      } catch (error) {
        console.error('Ошибка обновления типа продукта:', error);
      }
    };

    const handleClearCache = async () => {
      try {
        setIsClearingCache(true);
        console.log('🧹 Начинаем очистку кэша...');

        // 1. Очищаем все кэши браузера
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          console.log('📦 Найдено кэшей:', cacheNames.length);
          await Promise.all(cacheNames.map(name => {
            console.log('🗑️ Удаляем кэш:', name);
            return caches.delete(name);
          }));
          console.log('✅ Все кэши удалены');
        }

        // 2. Очищаем localStorage (кроме критичных данных)
        const savedTab = localStorage.getItem('groceryTrackerActiveTab');
        console.log('🧹 Очищаем localStorage...');
        localStorage.clear();
        // Восстанавливаем только текущую вкладку
        if (savedTab) {
          localStorage.setItem('groceryTrackerActiveTab', savedTab);
        }
        console.log('✅ localStorage очищен');

        // 3. Пересчитываем всю аналитику
        console.log('📊 Пересчитываем аналитику...');
        await recalculateAllAnalytics();
        console.log('✅ Аналитика пересчитана');

        // 4. Обновляем Service Worker
        if ('serviceWorker' in navigator) {
          console.log('🔄 Обновляем Service Worker...');
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.update();
          }
          console.log('✅ Service Worker обновлен');
        }

        setSuccessMessage('Кэш очищен! Аналитика пересчитана. Приложение обновлено.');
        setShowSuccessMessage(true);
        
        // Перезагружаем страницу через 2 секунды
        setTimeout(() => {
          console.log('🔄 Перезагружаем страницу...');
          window.location.reload();
        }, 2000);
        
      } catch (error) {
        console.error('❌ Ошибка очистки кэша:', error);
        alert('Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
      } finally {
        setIsClearingCache(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Мои продукты</h2>
          
          {/* Кнопка очистки кэша */}
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ease-in-out transform ${
              isClearingCache
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed scale-95 opacity-80'
                : 'bg-red-600 text-white hover:bg-red-700 hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-md'
            }`}
            title="Очистить кэш и обновить приложение"
          >
            {isClearingCache ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Очистка...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Сброс кэша
              </>
            )}
          </button>
        </div>
        
        {/* Уведомление об успехе */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <div className="font-medium text-green-800">{successMessage}</div>
              <div className="text-sm text-green-600">Статистика автоматически пересчитана</div>
            </div>
          </div>
        )}

        {/* Информация о сбросе кэша */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Что делает кнопка "Сброс кэша"?</p>
              <p>Полностью очищает кэш приложения, обновляет все данные и пересчитывает аналитику. Используйте это после внесения изменений в приложение, чтобы не переустанавливать PWA.</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {productsLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка продуктов...</div>
          ) : (
            processedProducts.map(product => (
              <div key={product.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
                    {product.originalName && (
                      <div className="text-xs text-gray-400 mt-0.5">{product.originalName}</div>
                    )}
                    <div className="text-sm text-gray-500 mt-1">
                      Куплено {product.purchaseCount} раз
                    </div>
                  </div>
                  <div className="text-xl font-bold text-indigo-600">
                    €{product.price.toFixed(2)}
                  </div>
                </div>

                {/* Редактирование типа продукта */}
                <div className="border-t border-gray-100 pt-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm text-gray-600">Тип продукта:</span>
                      {editingTypeId === product.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={editedProductType}
                            onChange={(e) => setEditedProductType(e.target.value)}
                            placeholder="например: молоко, хлеб белый"
                            className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          {product.product_type ? (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                              {product.product_type}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              Не указан (кликните для добавления)
                            </span>
                          )}
                        </div>
                      )}
                      {editingTypeId === product.id && (
                        <p className="text-xs text-gray-500 mt-1">
                          Укажите общую категорию без бренда (напр: "молоко", а не "Простоквашино")
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-2">
                      {editingTypeId === product.id ? (
                        <>
                          <button
                            onClick={() => saveProductType(product.id)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Сохранить"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={cancelEditingType}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Отмена"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditingType(product)}
                          className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                          title="Изменить тип продукта"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Редактирование калорий */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Калорийность:</span>
                      {editingId === product.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editedCalories}
                            onChange={(e) => setEditedCalories(e.target.value)}
                            className="w-24 px-2 py-1 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <span className="text-sm text-gray-600">ккал</span>
                        </div>
                      ) : (
                        <span className="text-base font-semibold text-gray-900">
                          {product.calories} ккал
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editingId === product.id ? (
                        <>
                          <button
                            onClick={() => saveCalories(product.id)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Сохранить"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Отмена"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(product)}
                          className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                          title="Изменить калорийность"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Последняя покупка</div>
                      <div className="font-medium text-gray-900">
                        {new Date(product.lastPurchase).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                      </div>
                    </div>
                    {product.avgDays && (
                      <div>
                        <div className="text-gray-500">Частота покупки</div>
                        <div className="font-medium text-gray-900">
                          Каждые {product.avgDays} дней
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Кнопка "Загрузить еще" */}
        {!productsLoading && hasMoreProducts && processedProducts.length > 0 && loadMoreProducts && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => loadMoreProducts(20)}
              disabled={loadingMoreProducts}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                loadingMoreProducts
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {loadingMoreProducts ? 'Загрузка...' : 'Загрузить еще'}
            </button>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <ShoppingCart size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Всего продуктов: {processedProducts.length}</h4>
              <div className="text-sm text-gray-600">
                Общая калорийность: {processedProducts.reduce((sum, p) => sum + p.calories, 0)} ккал
              </div>
              <div className="text-sm text-gray-600">
                Средняя цена: €{(processedProducts.reduce((sum, p) => sum + p.price, 0) / processedProducts.length).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Уведомление о восстановлении вкладки */}
      {showRestoredMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 message-fade-in">
          <div className="max-w-md mx-auto px-6 pt-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-indigo-600 flex-shrink-0" />
                <div className="text-sm text-indigo-800 font-medium">
                  Раздел восстановлен после обновления
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">Grocery Tracker</h1>
          <PWAInstallButton />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-6 pb-24">
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'upload' && <UploadPage />}
          {activeTab === 'products' && <ProductsPage />}
          {activeTab === 'analytics' && <AnalyticsPage />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 z-50 shadow-lg safe-area-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button 
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'home' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Home size={22} />
            <span className="text-xs font-medium">Главная</span>
          </button>
          <button 
            onClick={() => handleTabChange('upload')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'upload' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Camera size={22} />
            <span className="text-xs font-medium">Чек</span>
          </button>
          <button 
            onClick={() => handleTabChange('products')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'products' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <ShoppingCart size={22} />
            <span className="text-xs font-medium">Продукты</span>
          </button>
          <button 
            onClick={() => handleTabChange('analytics')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'analytics' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <BarChart3 size={22} />
            <span className="text-xs font-medium">Аналитика</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroceryTrackerApp;