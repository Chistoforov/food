import { useState, useRef, useEffect } from 'react';
import { Camera, ShoppingCart, Home, Clock, AlertCircle, CheckCircle, Edit2, Save, X, Upload, Loader2, XCircle, Trash2, ChevronLeft, ChevronRight, Eye, Calendar, RefreshCw, AlertTriangle, Info, Sparkles, User } from 'lucide-react';
import { useProducts, useReceipts, useMonthlyStats } from './hooks/useSupabaseData';
import { SupabaseService } from './services/supabaseService';
import type { ProductHistory, Product } from './lib/supabase';
import ConfirmationModal from './components/ConfirmationModal';
import ReceiptLanguageModal from './components/ReceiptLanguageModal';
import PWAInstallButton from './components/PWAInstallButton';
// import { getColorScheme } from './components/ProductTypePatterns';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';

// Проверяем переменные окружения при загрузке
console.log('🔍 Environment check:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Настроен' : '❌ Отсутствует',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Настроен' : '❌ Отсутствует',
  VITE_PERPLEXITY_API_KEY: import.meta.env.VITE_PERPLEXITY_API_KEY ? '✅ Настроен' : '❌ Отсутствует'
});

const GroceryTrackerApp = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Check for receipt language setting
  useEffect(() => {
    if (profile && (profile.receipt_language === null || profile.receipt_language === undefined)) {
      setShowLanguageModal(true);
    } else {
      setShowLanguageModal(false);
    }
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
      const validTabs = ['home', 'upload', 'products', 'account'];
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
    recalculateStats,
    recalculateAllAnalytics,
    error: statsError,
    refetch: refetchStats
  } = useMonthlyStats(safeFamilyId, currentMonth.month, currentMonth.year);

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
    const [earlyDepletionLoading, setEarlyDepletionLoading] = useState<string | null>(null)

    // Загружаем статистику по типам продуктов из КЭША (быстро!)
    // Кэш автоматически обновляется триггерами при изменениях
    useEffect(() => {
      const loadTypeStats = async () => {
        try {
          setLoadingTypeStats(true)
          console.log('📊 Загружаем статистику типов продуктов...')
          const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
          console.log('📊 Загружена статистика типов продуктов:', stats)
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
    
    // Отслеживаем изменения в productTypeStats
    useEffect(() => {
      console.log('🔄 [STATE CHANGE] productTypeStats обновлен:', productTypeStats)
    }, [productTypeStats])

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
        
        // ВАЖНО: Ждем немного, чтобы триггеры БД успели сработать
        console.log('⏳ Ждем завершения обновлений в БД...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // ВАЖНО: Явно пересчитываем кэш типов продуктов ПЕРЕД его чтением
        // Триггеры БД срабатывают асинхронно и могут не успеть обновить кэш
        console.log('🔄 Пересчитываем кэш статистики типов продуктов...')
        await SupabaseService.recalculateProductTypeStats(selectedFamilyId)
        
        // Ждем еще немного после пересчета кэша
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Обновляем список продуктов (чтобы получить новые статусы)
        console.log('🔄 Обновляем список продуктов...')
        await refetchProducts()
        
        // Обновляем статистику типов из пересчитанного кэша
        console.log('🔄 Загружаем обновленную статистику типов...')
        const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
        console.log('📊 Новая статистика типов:', stats)
        // Создаем новый объект, чтобы React точно заметил изменения
        setProductTypeStats({...stats})
        
        console.log('✅ Продукты и статистика обновлены')
      } catch (error) {
        console.error('❌ Ошибка добавления виртуальной покупки:', error)
        alert('Ошибка обновления. Попробуйте еще раз.')
      } finally {
        setVirtualPurchaseLoading(null)
      }
    }

    const handleEarlyDepletion = async (productType: string) => {
      try {
        setEarlyDepletionLoading(productType)
        console.log('⚠️ Отмечаем продукты типа как досрочно закончившиеся:', productType)
        
        // Отмечаем все продукты этого типа как досрочно закончившиеся
        const updatedCount = await SupabaseService.markTypeAsDepletedEarly(productType, selectedFamilyId)
        
        if (updatedCount === 0) {
          console.warn('⚠️ Нет продуктов для этого типа')
          alert('Не найдено продуктов этого типа')
          return
        }
        
        console.log(`✅ ${updatedCount} продуктов отмечены как досрочно закончившиеся`)
        
        // ВАЖНО: Ждем немного, чтобы триггеры БД успели сработать
        console.log('⏳ Ждем завершения обновлений в БД...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // ВАЖНО: Явно пересчитываем кэш типов продуктов ПЕРЕД его чтением
        // Триггеры БД срабатывают асинхронно и могут не успеть обновить кэш
        console.log('🔄 Пересчитываем кэш статистики типов продуктов...')
        await SupabaseService.recalculateProductTypeStats(selectedFamilyId)
        
        // Ждем еще немного после пересчета кэша
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Обновляем список продуктов (чтобы получить новые статусы)
        console.log('🔄 Обновляем список продуктов...')
        await refetchProducts()
        
        // Обновляем статистику типов из пересчитанного кэша
        console.log('🔄 Загружаем обновленную статистику типов...')
        const stats = await SupabaseService.getProductTypeStats(selectedFamilyId)
        console.log('📊 Новая статистика типов:', stats)
        // Создаем новый объект, чтобы React точно заметил изменения
        setProductTypeStats({...stats})
        
        console.log('✅ Продукты и статистика обновлены')
      } catch (error) {
        console.error('❌ Ошибка отметки досрочного окончания:', error)
        alert('Ошибка обновления. Попробуйте еще раз.')
      } finally {
        setEarlyDepletionLoading(null)
      }
    }

    return (
    <div className="space-y-8 animate-fadeIn">
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
        className="relative overflow-hidden bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl"
        onTouchStart={handleTouchStart}
      >
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

        {/* Навигация по месяцам */}
        <div className="relative z-10 flex items-center justify-between mb-8">
          <button
            onClick={goToPreviousMonth}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-xl font-bold tracking-tight">
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
            className={`p-3 rounded-2xl transition-all active:scale-95 backdrop-blur-sm ${
              canGoToNextMonth()
                ? 'bg-white/10 hover:bg-white/20'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {statsError ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mb-4 backdrop-blur-md">
            <div className="text-red-200 text-sm">
              <strong>Ошибка:</strong> {statsError}
            </div>
          </div>
        ) : statsLoading ? (
           <div className="flex flex-col items-center justify-center py-12 gap-3">
             <Loader2 className="animate-spin text-primary-400" size={32} />
             <span className="text-white/60 font-medium">Считаем расходы...</span>
           </div>
        ) : (
          <div className="relative z-10">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <div className="text-sm text-white/60 mb-1 font-medium">Потрачено</div>
                <div className="text-3xl font-bold tracking-tight">€{monthlyStats.totalSpent.toFixed(0)}<span className="text-lg text-white/60">.{monthlyStats.totalSpent.toFixed(2).split('.')[1]}</span></div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <div className="text-sm text-white/60 mb-1 font-medium">Калории</div>
                <div className="text-3xl font-bold tracking-tight">{(monthlyStats.totalCalories / 1000).toFixed(1)}k</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-white/60 mb-1 font-medium">В день</div>
                <div className="text-xl font-semibold tracking-tight">{monthlyStats.avgCaloriesPerDay} <span className="text-sm font-normal text-white/40">ккал</span></div>
              </div>
              <div>
                <div className="text-sm text-white/60 mb-1 font-medium">Чеков</div>
                <div className="text-xl font-semibold tracking-tight">{monthlyStats.receiptsCount}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Кнопка обновления */}
        <button
          onClick={async () => {
            try {
              await recalculateStats();
            } catch (error) {
              console.error('Ошибка пересчета статистики:', error);
            }
          }}
          disabled={statsLoading}
          className={`absolute top-6 right-16 p-3 rounded-2xl text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95 ${statsLoading ? 'opacity-50' : ''}`}
        >
          <RefreshCw size={20} className={statsLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Обзор по типам продуктов */}
      {!loadingTypeStats && Object.keys(productTypeStats).length > 0 && (() => {
        const sortedTypes = Object.entries(productTypeStats).sort(([, a], [, b]) => {
          const statusPriority = { 'ending-soon': 0, 'ok': 1, 'calculating': 2 };
          if (a.status !== b.status) {
            return statusPriority[a.status] - statusPriority[b.status];
          }
          return b.productCount - a.productCount;
        });

        return sortedTypes.length > 0 && (
          <div className="animate-fadeIn" style={{animationDelay: '0.1s'}}>
            <h3 className="text-xl font-bold text-surface-900 mb-4 px-1">Мои продукты</h3>
            <div className="grid grid-cols-2 gap-3">
              {sortedTypes.map(([type, typeData], index) => {
                const typeStatus = typeData.status;
                const isLoading = virtualPurchaseLoading === type;
                
                // Determine styling based on status
                let cardStyle = "bg-white border-surface-100";
                let iconBg = "bg-surface-100 text-surface-500";
                let statusColor = "text-surface-500";
                
                if (typeStatus === 'ending-soon') {
                  cardStyle = "bg-red-50 border-red-100 shadow-sm ring-1 ring-red-100";
                  iconBg = "bg-red-100 text-red-600";
                  statusColor = "text-red-600";
                } else if (typeStatus === 'ok') {
                  cardStyle = "bg-white border-surface-200";
                  iconBg = "bg-emerald-100 text-emerald-600";
                  statusColor = "text-emerald-600";
                }
                
                return (
                  <div 
                    key={type} 
                    className={`group relative rounded-[24px] p-4 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${cardStyle}`}
                    style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  >
                    <div className="flex flex-col h-full min-h-[140px]">
                      <div className="flex justify-between items-start mb-3">
                         <div className={`p-2.5 rounded-2xl ${iconBg} transition-colors`}>
                           {typeStatus === 'ending-soon' ? <AlertCircle size={20} /> : 
                            typeStatus === 'ok' ? <CheckCircle size={20} /> : 
                            <Clock size={20} />}
                         </div>
                         
                         <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTypeConfirm(type);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-surface-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h4 className="font-bold text-surface-900 capitalize text-lg leading-tight mb-1">{type}</h4>
                      
                      <div className={`text-xs font-semibold uppercase tracking-wider mb-auto ${statusColor}`}>
                        {typeStatus === 'ending-soon' && 'Заканчивается'}
                        {typeStatus === 'ok' && 'В наличии'}
                        {typeStatus === 'calculating' && 'Расчет...'}
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/5">
                        {typeStatus === 'ok' && (
                           <button
                             onClick={() => handleEarlyDepletion(type)}
                             disabled={earlyDepletionLoading === type}
                             className="flex-1 py-2 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5"
                           >
                             <AlertTriangle size={14} />
                             <span>Кончилось</span>
                           </button>
                        )}
                        
                        {typeStatus === 'ending-soon' && (
                          <button
                            onClick={() => handleVirtualPurchase(type)}
                            disabled={isLoading}
                            className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-semibold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                             <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                             <span>Купил</span>
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
    // const [uploadErrorClosing, setUploadErrorClosing] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadSuccessClosing, setUploadSuccessClosing] = useState(false);
    const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
      console.log('📁 File selection triggered');
      const file = event.target.files?.[0];
      if (!file) {
        console.log('⚠️ No file selected or selection cancelled');
        return;
      }
      
      console.log('📄 File selected:', file.name, file.type, file.size);

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
          file,
          user?.id
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
        // Reset file inputs - though we also do this on click now
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
      <div className="space-y-8 animate-fadeIn">
        {/* Receipt Detail Modal */}
        {selectedReceiptId && (
          <ReceiptDetailModal
            receiptId={selectedReceiptId}
            onClose={() => setSelectedReceiptId(null)}
            onDateUpdated={handleDateUpdated}
          />
        )}

        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900">Сканировать чек</h2>
            <div className="text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">AI Powered</div>
        </div>
        
        {/* Success Message */}
        {uploadSuccess && (
          <div className={`bg-emerald-50 border border-emerald-100 rounded-[24px] p-5 transition-all shadow-sm ${
            uploadSuccessClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                  <CheckCircle size={28} className="animate-bounce" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-emerald-900 mb-1 text-lg">Чек принят!</div>
                <div className="text-sm text-emerald-700 font-medium">
                  Обрабатываем в фоне. Можете закрыть приложение.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-50 border border-red-100 rounded-[24px] p-5 shadow-sm animate-shake">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-full text-red-600 mt-1">
                 <XCircle size={24} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-red-900 mb-1">Ошибка</div>
                <div className="text-sm text-red-700">{uploadError}</div>
              </div>
              <button 
                onClick={() => setUploadError(null)}
                className="p-2 text-red-400 hover:text-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div 
          className={`relative overflow-hidden rounded-[32px] transition-all duration-300 group ${
            isProcessing 
              ? 'bg-surface-100 border-2 border-dashed border-surface-300' 
              : 'bg-white border-2 border-dashed border-surface-200 hover:border-primary-400 shadow-sm hover:shadow-md'
          }`}
        >
          {/* Input для камеры (с capture) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            onClick={(e) => (e.target as HTMLInputElement).value = ''}
            className="hidden"
            disabled={isProcessing}
          />
          
          {/* Input для галереи (без capture) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            onClick={(e) => (e.target as HTMLInputElement).value = ''}
            className="hidden"
            disabled={isProcessing}
          />
          
          <div className="p-8 py-12 text-center">
             {isProcessing ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                    <Loader2 size={64} className="relative text-primary-600 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-surface-900 mb-2">Анализируем чек...</h3>
                  <p className="text-surface-500 font-medium">Это займет пару секунд</p>
                </div>
             ) : (
                <div className="flex flex-col items-center">
                   <div className="mb-8 relative group-hover:scale-110 transition-transform duration-300">
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary-400 to-violet-500 blur-2xl opacity-20 rounded-full"></div>
                      <Camera size={64} className="relative text-surface-400 group-hover:text-primary-600 transition-colors" />
                   </div>
                   
                   <h3 className="text-2xl font-bold text-surface-900 mb-3">Добавить чек</h3>
                   <p className="text-surface-500 mb-8 max-w-[200px] mx-auto">Сфотографируйте чек или загрузите из галереи</p>
                   
                   <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mx-auto">
                     <button 
                       onClick={(e) => { e.stopPropagation(); triggerCameraInput(); }}
                       className="flex-1 bg-surface-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                     >
                       <Camera size={20} />
                       <span>Камера</span>
                     </button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); triggerGalleryInput(); }}
                       className="flex-1 bg-white text-surface-900 border border-surface-200 px-6 py-4 rounded-2xl font-bold hover:bg-surface-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                     >
                       <Upload size={20} />
                       <span>Галерея</span>
                     </button>
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-[24px] p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
               <Sparkles size={20} />
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-2">Как это работает</p>
              <ul className="space-y-1.5 opacity-80 font-medium">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>Загрузите фото чека</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>AI распознает продукты и цены</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>Данные добавятся автоматически</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Receipts */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-surface-900">История загрузок</h3>
             {processedReceipts.length > 0 && (
                <span className="text-xs font-bold bg-surface-100 text-surface-500 px-2 py-1 rounded-lg">{processedReceipts.length}</span>
             )}
          </div>
          
          <div className="space-y-3">
            {receiptsLoading ? (
               <div className="flex flex-col items-center justify-center py-12 gap-3">
                 <Loader2 className="animate-spin text-surface-400" size={24} />
               </div>
            ) : processedReceipts.length === 0 ? (
              <div className="text-center py-12 text-surface-400 bg-surface-50 rounded-[24px] border border-dashed border-surface-200">
                <Camera size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">История пуста</p>
              </div>
            ) : (
              processedReceipts.map((receipt, index) => (
                <div 
                   key={receipt.id} 
                   className="bg-white rounded-[24px] p-5 border border-surface-100 hover:shadow-lg hover:border-surface-200 transition-all duration-300 group"
                   style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {deleteConfirmId === receipt.id ? (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-3 text-red-600 bg-red-50 p-3 rounded-xl">
                        <AlertCircle size={20} />
                        <span className="font-bold text-sm">Удалить этот чек?</span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeleteReceipt(receipt.id)}
                          disabled={deletingReceiptId === receipt.id}
                          className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                        >
                          {deletingReceiptId === receipt.id ? <Loader2 className="animate-spin mx-auto"/> : 'Удалить'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deletingReceiptId === receipt.id}
                          className="flex-1 bg-surface-100 text-surface-900 px-4 py-3 rounded-xl font-bold text-sm hover:bg-surface-200 transition-colors"
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
                        <div className="font-bold text-surface-900 text-lg mb-0.5">{new Date(receipt.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                        <div className="text-sm text-surface-500 font-medium">{receipt.items} товаров</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold text-primary-600 text-lg">€{receipt.total.toFixed(2)}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center justify-end gap-1 bg-emerald-50 px-2 py-0.5 rounded-md mt-1">
                            <CheckCircle size={10} />
                            Готово
                          </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedReceiptId(receipt.id)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                            >
                              <Eye size={20} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(receipt.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Кнопка "Загрузить еще" */}
          {!receiptsLoading && hasMoreReceipts && processedReceipts.length > 0 && loadMoreReceipts && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => loadMoreReceipts(20)}
                disabled={loadingMoreReceipts}
                className="px-8 py-3 rounded-2xl font-bold bg-white border border-surface-200 text-surface-900 shadow-sm hover:bg-surface-50 transition-all active:scale-95"
              >
                {loadingMoreReceipts ? <Loader2 className="animate-spin" /> : 'Показать еще'}
              </button>
            </div>
          )}
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
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-surface-900">Список покупок</h2>
          
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className={`p-2 rounded-xl transition-all duration-300 ${
              isClearingCache
                ? 'bg-surface-100 text-surface-400 cursor-wait'
                : 'bg-surface-100 text-surface-500 hover:bg-red-50 hover:text-red-600'
            }`}
            title="Сброс кэша"
          >
            {isClearingCache ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
          </button>
        </div>
        
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm animate-scaleIn">
            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
               <CheckCircle size={18} />
            </div>
            <div>
              <div className="font-semibold text-emerald-900 text-sm">{successMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {productsLoading ? (
             <div className="flex flex-col items-center justify-center py-12 gap-3">
               <Loader2 className="animate-spin text-surface-400" size={32} />
               <span className="text-surface-400 font-medium">Загрузка продуктов...</span>
             </div>
          ) : (
            processedProducts.map((product, index) => (
              <div 
                key={product.id} 
                className="bg-white rounded-[24px] p-5 shadow-sm border border-surface-100 hover:shadow-md transition-all duration-300"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-bold text-surface-900 text-lg leading-tight truncate">{product.name}</h3>
                    {product.originalName && (
                      <div className="text-xs text-surface-400 mt-1 truncate">{product.originalName}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-50 text-surface-600 text-xs font-medium">
                        {product.purchaseCount} покупок
                      </span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-xl">
                    €{product.price.toFixed(2)}
                  </div>
                </div>

                {/* Edit Sections */}
                <div className="space-y-3 pt-3 border-t border-surface-50">
                  {/* Type */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-surface-500 font-medium">Тип</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                       {editingTypeId === product.id ? (
                         <div className="flex items-center gap-2 w-full max-w-[200px] animate-fadeIn">
                           <input
                             type="text"
                             value={editedProductType}
                             onChange={(e) => setEditedProductType(e.target.value)}
                             placeholder="Тип..."
                             className="flex-1 px-3 py-1.5 border border-primary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 bg-surface-50"
                             autoFocus
                           />
                           <button onClick={() => saveProductType(product.id)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Save size={16}/></button>
                           <button onClick={cancelEditingType} className="p-1.5 bg-surface-100 text-surface-600 rounded-lg"><X size={16}/></button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 cursor-pointer group" onClick={() => startEditingType(product)}>
                            {product.product_type ? (
                              <span className="px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-sm font-medium border border-violet-100">
                                {product.product_type}
                              </span>
                            ) : (
                              <span className="text-sm text-surface-400 italic">Не указан</span>
                            )}
                            <Edit2 size={14} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Calories */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-surface-500 font-medium">Ккал</span>
                    <div className="flex items-center gap-2">
                       {editingId === product.id ? (
                         <div className="flex items-center gap-2 animate-fadeIn">
                           <input
                             type="number"
                             value={editedCalories}
                             onChange={(e) => setEditedCalories(e.target.value)}
                             className="w-20 px-3 py-1.5 border border-primary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 bg-surface-50"
                             autoFocus
                           />
                           <button onClick={() => saveCalories(product.id)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Save size={16}/></button>
                           <button onClick={cancelEditing} className="p-1.5 bg-surface-100 text-surface-600 rounded-lg"><X size={16}/></button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 cursor-pointer group" onClick={() => startEditing(product)}>
                            <span className="text-sm font-semibold text-surface-900">{product.calories}</span>
                            <Edit2 size={14} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-50 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-surface-400 mb-0.5">Последняя покупка</div>
                    <div className="text-sm font-medium text-surface-700">
                      {new Date(product.lastPurchase).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  {product.avgDays && (
                    <div>
                      <div className="text-xs text-surface-400 mb-0.5">Частота</div>
                      <div className="text-sm font-medium text-surface-700">
                        ~{product.avgDays} дн.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {!productsLoading && hasMoreProducts && processedProducts.length > 0 && loadMoreProducts && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => loadMoreProducts(20)}
              disabled={loadingMoreProducts}
              className="px-8 py-3 rounded-2xl font-semibold bg-white border border-surface-200 text-surface-900 shadow-sm hover:bg-surface-50 transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingMoreProducts ? <Loader2 className="animate-spin" /> : 'Загрузить еще'}
            </button>
          </div>
        )}

        <div className="bg-gradient-to-br from-primary-900 to-surface-900 rounded-[24px] p-6 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
              <ShoppingCart size={24} className="text-primary-300" />
            </div>
            <div>
              <div className="text-surface-300 text-sm font-medium mb-1">Итого в списке</div>
              <div className="text-2xl font-bold">{processedProducts.length} <span className="text-base font-normal text-surface-400">товаров</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Language Selection Modal */}
      <ReceiptLanguageModal 
        isOpen={showLanguageModal} 
        onClose={() => setShowLanguageModal(false)} 
      />

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
      <div className="px-6 pt-6 pb-2 flex-shrink-0 z-10">
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
        <div className="max-w-md mx-auto px-6 py-6 pb-32">
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'upload' && <UploadPage />}
          {activeTab === 'products' && <ProductsPage />}
          {activeTab === 'account' && <AccountPage />}
        </div>
      </div>

      {/* Modern Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-0 right-0 z-50 px-6 safe-area-bottom pointer-events-none">
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
            onClick={() => handleTabChange('upload')}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
              activeTab === 'upload' 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Camera size={24} strokeWidth={activeTab === 'upload' ? 2.5 : 2} />
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