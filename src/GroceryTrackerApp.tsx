import { useState, useEffect } from 'react';
import { ShoppingCart, Home, AlertTriangle, User, Loader2, RefreshCw } from 'lucide-react';
import { useProducts, useReceipts, useMonthlyStats } from './hooks/useSupabaseData';
import { SupabaseService } from './services/supabaseService';
import PWAInstallButton from './components/PWAInstallButton';
import { useAuth } from './contexts/AuthContext';
import { clearAppCache } from './utils/cacheHelper';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';
import HomePage from './components/HomePage';
import ProductsPage from './components/ProductsPage';

console.log('🔍 Environment check:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Настроен' : '❌ Отсутствует',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Настроен' : '❌ Отсутствует'
});

const GroceryTrackerApp = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Автоматическая очистка кэша при входе (если был установлен флаг)
  useEffect(() => {
    const checkAndClearCache = async () => {
      const needsReset = localStorage.getItem('needs_cache_reset');
      
      // Ждем пока загрузится профиль, так как нам нужен family_id для пересчета аналитики
      if (needsReset === 'true' && profile?.family_id) {
        console.log('🧹 Обнаружен флаг сброса кэша после входа. Выполняем очистку...');
        
        // Удаляем флаг СРАЗУ, чтобы избежать циклов
        localStorage.removeItem('needs_cache_reset');
        
        try {
          // Очищаем кэш, сохраняя авторизацию (true)
          await clearAppCache(profile.family_id, true);
          console.log('✅ Кэш очищен, перезагрузка...');
          window.location.reload();
        } catch (e) {
          console.error('❌ Ошибка при авто-очистке кэша:', e);
        }
      }
    };
    
    checkAndClearCache();
  }, [profile]);

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
      const validTabs = ['home', 'products', 'account'];
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
  
  const selectedFamilyId = profile?.family_id || 1;
  const [selectedMonth, setSelectedMonth] = useState<{month: string, year: number} | null>(null);
  const [showRestoredMessage, setShowRestoredMessage] = useState(false);

  // Функции для навигации по месяцам
  const getCurrentMonth = () => {
    const now = new Date();
    return {
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: now.getFullYear()
    };
  };

  // Получаем текущий месяц (используем для хука и рендера)
  const currentMonth = selectedMonth || getCurrentMonth();

  // Инициализируем хуки Supabase (безусловно, чтобы не нарушать Rules of Hooks)
  // Используем familyId=0 если профиль еще не загружен, чтобы избежать лишних запросов
  const safeFamilyId = profile?.family_id || 0;

  const {
    products,
    loading: productsLoading,
    updateProduct,
    loadMore: loadMoreProducts,
    loadingMore: loadingMoreProducts,
    hasMore: hasMoreProducts,
    refetch: refetchProducts
  } = useProducts(safeFamilyId);

  const {
    receipts,
    loading: receiptsLoading,
    deleteReceipt,
    loadMore: loadMoreReceipts,
    loadingMore: loadingMoreReceipts,
    hasMore: hasMoreReceipts
  } = useReceipts(safeFamilyId);

  const {
    stats: monthlyStatsData,
    loading: statsLoading,
    recalculateAllAnalytics,
    error: statsError,
    refetch: refetchStats
  } = useMonthlyStats(safeFamilyId);

  // Загружаем статистику по типам продуктов из КЭША (быстро!)
  const [productTypeStats, setProductTypeStats] = useState<Record<string, {
      status: 'ending-soon' | 'ok' | 'calculating'
      productCount: number
  }>>({})

  // Кэш автоматически обновляется триггерами при изменениях
  useEffect(() => {
    // Only load stats if we have a valid family ID and are on the home tab
    if (safeFamilyId === 0 || activeTab !== 'home') return;

    const loadTypeStats = async () => {
      try {
        console.log('📊 Загружаем статистику типов продуктов...')
        const stats = await SupabaseService.getProductTypeStats(safeFamilyId)
        console.log('📊 Загружена статистика типов продуктов:', stats)
        setProductTypeStats(stats)
      } catch (error) {
        console.error('Ошибка загрузки статистики по категориям:', error)
      }
    }
    
    loadTypeStats()
  }, [activeTab, safeFamilyId]) 

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

  // Show loader while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Show loader if profile is not yet loaded (e.g. creating after signup)
  if (!profile) {
     return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-gray-500">Подготовка вашего аккаунта...</p>
      </div>
    );
  }

  const goToPreviousMonth = () => {
    setSlideDirection('left');
    const date = new Date(currentMonth.year, parseInt(currentMonth.month) - 1, 1);
    date.setMonth(date.getMonth() - 1);
    
    setSelectedMonth({
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: date.getFullYear()
    });
  };

  const goToNextMonth = () => {
    setSlideDirection('right');
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
    purchaseCount: product.purchase_count
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
    receiptsCount: selectedStats.receipts_count
  } : {
    totalSpent: 0,
    receiptsCount: 0
  };

  const handleDeleteReceiptAction = async (receiptId: number) => {
    await deleteReceipt(receiptId);
    await recalculateAllAnalytics();
    await refetchStats();
  };

  const handleDateUpdated = async () => {
    // Reload receipts and stats after date update
    await refetchStats();
    // The receipts will be automatically refreshed by the hook
  };

  return (
    <div className="h-full flex flex-col">
      {/* Уведомление о восстановлении вкладки */}
      {showRestoredMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 message-fade-in">
          <div className="max-w-md mx-auto px-6 pt-4">
            <div className="bg-primary-50/90 backdrop-blur-md border border-primary-100 rounded-3xl p-4 shadow-lg mx-4 mt-2">
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className="text-primary-600 flex-shrink-0" />
                <div className="text-sm text-primary-900 font-medium">
                  Раздел восстановлен после обновления
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-2 flex-shrink-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Grocery Tracker</h1>
            <p className="text-surface-500 text-sm font-medium">Manage your pantry smart</p>
          </div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-6 pb-32">
          {activeTab === 'home' && (
            <HomePage
              monthlyStats={monthlyStats}
              currentMonth={currentMonth}
              productTypeStats={productTypeStats}
              setProductTypeStats={setProductTypeStats}
              familyId={selectedFamilyId}
              onNavigateMonth={{
                prev: goToPreviousMonth,
                next: goToNextMonth,
                canNext: canGoToNextMonth
              }}
              slideDirection={slideDirection}
              statsError={statsError}
              statsLoading={statsLoading}
              refetchProducts={refetchProducts}
              receipts={receipts}
              receiptsLoading={receiptsLoading}
              hasMoreReceipts={hasMoreReceipts}
              loadMoreReceipts={loadMoreReceipts}
              loadingMoreReceipts={loadingMoreReceipts}
              onDeleteReceipt={handleDeleteReceiptAction}
              onDateUpdated={handleDateUpdated}
            />
          )}
          {activeTab === 'products' && (
            <ProductsPage 
              products={processedProducts}
              loading={productsLoading}
              hasMore={hasMoreProducts}
              loadMore={loadMoreProducts}
              loadingMore={loadingMoreProducts}
              updateProduct={updateProduct}
              familyId={selectedFamilyId}
            />
          )}
          {activeTab === 'account' && <AccountPage />}
        </div>
      </div>

      {/* Modern Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-0 right-0 z-50 px-4 sm:px-6 safe-area-bottom pointer-events-none">
        <div className="pointer-events-auto max-w-[320px] mx-auto bg-white/80 backdrop-blur-xl border border-white/40 rounded-full shadow-glass p-1.5 flex items-center justify-between">
          <button
            onClick={() => handleTabChange('home')}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
              activeTab === 'home'
                ? 'bg-slate-900 text-white shadow-lg scale-105'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          </button>

          <button
            onClick={() => handleTabChange('products')}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
              activeTab === 'products' 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart size={24} strokeWidth={activeTab === 'products' ? 2.5 : 2} />
          </button>
          
          <button 
            onClick={() => handleTabChange('account')}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
              activeTab === 'account' 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User size={24} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroceryTrackerApp;
