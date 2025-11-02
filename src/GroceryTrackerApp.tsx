import { useState, useRef, useEffect } from 'react';
import { Camera, ShoppingCart, Home, BarChart3, Clock, AlertCircle, CheckCircle, Edit2, Save, X, Upload, Loader2, XCircle, Trash2, ChevronLeft, ChevronRight, Eye, Calendar, RefreshCw, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useProducts, useReceipts, useProductHistory, useMonthlyStats } from './hooks/useSupabaseData';
import { SupabaseService } from './services/supabaseService';
import type { ProductHistory, Product } from './lib/supabase';

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
    const savedTab = localStorage.getItem('activeTab');
    return savedTab || 'home';
  });
  const [selectedFamilyId] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<{month: string, year: number} | null>(null);

  // Сохраняем текущую вкладку в localStorage при каждом изменении
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    console.log('💾 Сохранили текущую вкладку:', activeTab);
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
  let products, productsLoading, updateProduct, deleteProduct, loadMoreProducts, loadingMoreProducts, hasMoreProducts, receipts, receiptsLoading, deleteReceipt, loadMoreReceipts, loadingMoreReceipts, hasMoreReceipts, monthlyStatsData, statsLoading, recalculateStats, recalculateAllAnalytics, statsError, refetchStats;
  
  try {
    console.log('🔄 Инициализируем хуки Supabase...');
    
    const productsHook = useProducts(selectedFamilyId);
    products = productsHook.products;
    productsLoading = productsHook.loading;
    updateProduct = productsHook.updateProduct;
    deleteProduct = productsHook.deleteProduct;
    loadMoreProducts = productsHook.loadMore;
    loadingMoreProducts = productsHook.loadingMore;
    hasMoreProducts = productsHook.hasMore;
    
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

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'ending-soon') {
      return (
        <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs">
          <AlertCircle size={12} />
          <span>Скоро закончится</span>
        </div>
      );
    }
    if (status === 'calculating') {
      return (
        <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
          <Clock size={12} />
          <span>Calculating...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
        <CheckCircle size={12} />
        <span>В наличии</span>
      </div>
    );
  };

  // Главная страница
  const HomePage = () => {
    const [deleteConfirmProductId, setDeleteConfirmProductId] = useState<number | null>(null);
    const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

    const handleDeleteProduct = async (productId: number) => {
      try {
        setDeletingProductId(productId);
        console.log('🗑️ Удаляем товар #' + productId);
        
        // Удаляем товар из базы данных
        await deleteProduct(productId);
        
        console.log('✅ Товар успешно удален из БД');
        setDeleteConfirmProductId(null);
        
        // Пересчитываем всю аналитику после удаления
        console.log('🔄 Пересчитываем всю аналитику...');
        await recalculateAllAnalytics();
        
        // Обновляем статистику
        console.log('🔄 Обновляем статистику...');
        await refetchStats();
        
        console.log('✅ Вся аналитика пересчитана');
      } catch (error) {
        console.error('❌ Ошибка удаления товара:', error);
      } finally {
        setDeletingProductId(null);
      }
    };

    return (
    <div className="space-y-6">
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

      {/* Список продуктов с напоминаниями */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Мои продукты</h3>
        <div className="space-y-3">
          {productsLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка продуктов...</div>
          ) : (
            processedProducts.map(product => (
              <div key={product.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
                {deleteConfirmProductId === product.id ? (
                  // Модалка подтверждения удаления
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle size={20} />
                      <span className="font-semibold">Удалить этот товар?</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Вся история покупок и данные о "{product.name}" будут удалены из базы. 
                      Статистика будет пересчитана. Это действие нельзя отменить.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deletingProductId === product.id}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingProductId === product.id ? 'Удаление...' : 'Да, удалить'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmProductId(null)}
                        disabled={deletingProductId === product.id}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  // Обычная карточка товара
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{product.name}</h4>
                        {product.originalName && (
                          <div className="text-xs text-gray-400 mt-0.5">{product.originalName}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          Куплено {product.purchaseCount} раз
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={product.status} />
                        <button
                          onClick={() => setDeleteConfirmProductId(product.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить товар"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-600">
                      <div>
                        <div className="text-gray-400">Последняя покупка</div>
                        <div className="font-medium">{product.lastPurchase ? new Date(product.lastPurchase).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Не указано'}</div>
                      </div>
                      {product.avgDays ? (
                        <>
                          <div>
                            <div className="text-gray-400">Частота</div>
                            <div className="font-medium">{product.avgDays} дней</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Закончится</div>
                            <div className="font-medium">{product.predictedEnd ? new Date(product.predictedEnd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Неизвестно'}</div>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 flex items-center text-blue-600">
                          <Clock size={14} className="mr-1" />
                          Собираем данные для прогноза
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="text-sm text-gray-600">{product.calories} ккал</div>
                      <div className="text-sm font-semibold text-gray-900">€{product.price.toFixed(2)}</div>
                    </div>
                  </>
                )}
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
      </div>
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
    const [pendingReceipts, setPendingReceipts] = useState<any[]>([]);
    const [completedReceiptTimers, setCompletedReceiptTimers] = useState<Record<number, number>>({});
    const [receiptStatusAnimations, setReceiptStatusAnimations] = useState<Record<number, string>>({});
    const [previousReceiptStatuses, setPreviousReceiptStatuses] = useState<Record<number, string>>({});
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const autoCloseTimersRef = useRef<Record<number, number>>({});
    const lastVisibleTimeRef = useRef<number>(Date.now());

    // Handle page visibility for PWA (pause/resume timers when app goes to background)
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // App went to background
          console.log('📱 PWA: Приложение ушло в фон');
          lastVisibleTimeRef.current = Date.now();
        } else {
          // App came back to foreground
          console.log('📱 PWA: Приложение вернулось на передний план');
          const timeInBackground = Date.now() - lastVisibleTimeRef.current;
          console.log(`⏱️ PWA: Время в фоне: ${timeInBackground}ms`);
          
          // Immediately check for updates when app comes back
          loadPendingReceipts().then((receipts) => {
            if (receipts) {
              const completedReceipts = receipts.filter((r: any) => r.status === 'completed');
              if (completedReceipts.length > 0) {
                console.log('✅ PWA: Найдены завершенные чеки после возврата');
                refetchStats();
              }
            }
          });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, []);

    // Load pending receipts and poll for updates
    // Note: Realtime is disabled because it's not available in the current Supabase plan
    useEffect(() => {
      console.log('🔄 UploadPage: Загружаем pending receipts и запускаем polling');
      loadPendingReceipts();
      
      // Store previous receipts to detect changes
      let previousReceipts: any[] = [];
      
      // Polling: check pending receipts every 1 second for responsive updates
      // This ensures updates work without Realtime and works well in PWA
      console.log('⏲️ UploadPage: Запускаем polling (каждую секунду)');
      const pollingInterval = setInterval(async () => {
        // Skip polling if page is not visible (PWA in background)
        if (document.hidden) {
          return;
        }
        
        console.log('🔄 Polling: Проверяем статус pending receipts');
        const receipts = await loadPendingReceipts();
        
        if (!receipts || receipts.length === 0) {
          previousReceipts = [];
          return;
        }
        
        // Detect status changes and trigger animations
        receipts.forEach((receipt: any) => {
          const prevReceipt = previousReceipts.find((prev: any) => prev.id === receipt.id);
          if (prevReceipt && prevReceipt.status !== receipt.status) {
            console.log(`🔄 Статус изменился для чека ${receipt.id}: ${prevReceipt.status} → ${receipt.status}`);
            // Trigger flip animation on status change
            setReceiptStatusAnimations(prev => ({
              ...prev,
              [receipt.id]: 'receipt-status-change'
            }));
            // Clear animation class after animation completes
            setTimeout(() => {
              setReceiptStatusAnimations(prev => {
                const newAnims = { ...prev };
                delete newAnims[receipt.id];
                return newAnims;
              });
            }, 600);
          }
        });
        
        // Check if any receipts changed to completed status
        const newlyCompleted = receipts.filter((r: any) => {
          const wasProcessing = previousReceipts.find((prev: any) => 
            prev.id === r.id && prev.status === 'processing'
          );
          return r.status === 'completed' && wasProcessing;
        });
        
        if (newlyCompleted.length > 0) {
          console.log('✅ Polling: Найдены новые завершенные чеки:', newlyCompleted.map((r: any) => r.id));
          refetchStats();
        }
        
        previousReceipts = receipts;
      }, 1000); // Poll every 1 second for responsive updates

      return () => {
        console.log('🔕 UploadPage: Размонтируем компонент, останавливаем polling');
        clearInterval(pollingInterval);
      };
    }, [selectedFamilyId]);

    // Auto-close completed receipts after 3 seconds with countdown
    // Enhanced for PWA: uses timestamp tracking instead of just timers
    useEffect(() => {
      const AUTO_CLOSE_DELAY = 3000; // 3 seconds
      const countdownIntervals: NodeJS.Timeout[] = [];

      // Process each completed receipt
      pendingReceipts.forEach((receipt) => {
        if (receipt.status === 'completed') {
          // Initialize start time if not exists
          if (!autoCloseTimersRef.current[receipt.id]) {
            console.log('⏱️ Инициализируем таймер автоудаления для чека:', receipt.id);
            autoCloseTimersRef.current[receipt.id] = Date.now();
            
            // Set initial countdown
            setCompletedReceiptTimers(prev => ({
              ...prev,
              [receipt.id]: 3
            }));
          }

          // Calculate remaining time
          const startTime = autoCloseTimersRef.current[receipt.id];
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, AUTO_CLOSE_DELAY - elapsed);
          const remainingSeconds = Math.ceil(remaining / 1000);

          // Update countdown display
          if (remainingSeconds > 0 && !completedReceiptTimers[receipt.id]) {
            setCompletedReceiptTimers(prev => ({
              ...prev,
              [receipt.id]: remainingSeconds
            }));
          }

          // Auto-delete if time has passed
          if (remaining <= 0) {
            console.log('🗑️ Автоматически удаляем завершенный чек:', receipt.id);
            handleAutoDeleteReceipt(receipt.id);
          }
        }
      });

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        // Skip if page is not visible (PWA in background)
        if (document.hidden) {
          return;
        }

        const updates: Record<number, number> = {};
        let hasChanges = false;

        pendingReceipts.forEach((receipt) => {
          if (receipt.status === 'completed' && autoCloseTimersRef.current[receipt.id]) {
            const startTime = autoCloseTimersRef.current[receipt.id];
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, AUTO_CLOSE_DELAY - elapsed);
            const remainingSeconds = Math.ceil(remaining / 1000);

            if (remainingSeconds !== completedReceiptTimers[receipt.id]) {
              updates[receipt.id] = remainingSeconds;
              hasChanges = true;
            }

            // Auto-delete if time has passed
            if (remaining <= 0) {
              console.log('🗑️ Автоматически удаляем завершенный чек:', receipt.id);
              handleAutoDeleteReceipt(receipt.id);
            }
          }
        });

        if (hasChanges) {
          setCompletedReceiptTimers(prev => ({ ...prev, ...updates }));
        }
      }, 100); // Check every 100ms for smoother countdown in PWA

      countdownIntervals.push(countdownInterval);

      // Cleanup
      return () => {
        countdownIntervals.forEach(interval => clearInterval(interval));
      };
    }, [pendingReceipts, completedReceiptTimers]);

    // Helper function to handle auto-deletion
    const handleAutoDeleteReceipt = async (receiptId: number) => {
      try {
        // Clean up timer reference
        delete autoCloseTimersRef.current[receiptId];
        
        // Remove from countdown display
        setCompletedReceiptTimers(prev => {
          const newTimers = { ...prev };
          delete newTimers[receiptId];
          return newTimers;
        });

        await SupabaseService.deletePendingReceipt(receiptId);
        console.log('✅ Чек успешно удален');
        
        loadPendingReceipts();
        
        // Обновляем статистику после удаления чека
        console.log('🔄 Обновляем статистику после удаления чека');
        refetchStats();
      } catch (error) {
        console.error('❌ Ошибка автоудаления чека:', error);
      }
    };

    const loadPendingReceipts = async () => {
      try {
        const receipts = await SupabaseService.getPendingReceipts(selectedFamilyId);
        setPendingReceipts(receipts);
        return receipts;
      } catch (error) {
        console.error('Error loading pending receipts:', error);
        return [];
      }
    };

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
        
        // Load pending receipts to show the new one
        await loadPendingReceipts();
        
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
        
        {/* Pending Receipts Status */}
        {pendingReceipts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 receipt-slide-in">
            <h3 className="font-semibold text-blue-900 mb-3">
              Обрабатываемые чеки ({pendingReceipts.length})
            </h3>
            <div className="space-y-2">
              {pendingReceipts.map((receipt) => (
                <div 
                  key={receipt.id} 
                  className={`bg-white rounded-lg p-3 flex items-center gap-3 transition-all duration-300 ${
                    receiptStatusAnimations[receipt.id] || ''
                  }`}
                  style={{ 
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  {receipt.status === 'pending' && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-yellow-500 status-pulse"></div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700">Ожидает обработки...</div>
                        <div className="text-xs text-gray-500">
                          {new Date(receipt.created_at).toLocaleString('ru')}
                        </div>
                      </div>
                    </>
                  )}
                  {receipt.status === 'processing' && (
                    <>
                      <Loader2 size={16} className="text-blue-600 animate-spin" />
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 font-medium">Обрабатывается...</div>
                        <div className="text-xs text-gray-500">
                          {new Date(receipt.created_at).toLocaleString('ru')}
                        </div>
                      </div>
                    </>
                  )}
                  {receipt.status === 'completed' && (
                    <>
                      <CheckCircle size={16} className="text-green-600 animate-bounce" style={{ animationIterationCount: '3' }} />
                      <div className="flex-1">
                        <div className="text-sm text-green-700 font-medium">
                          Обработан ✅
                          {completedReceiptTimers[receipt.id] !== undefined && completedReceiptTimers[receipt.id] > 0 && (
                            <span className="ml-2 text-xs text-green-600 font-normal">
                              (закрытие через {completedReceiptTimers[receipt.id]}с)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {receipt.parsed_data?.items?.length || 0} товаров добавлено
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleAutoDeleteReceipt(receipt.id);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Закрыть уведомление"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                  {receipt.status === 'failed' && (
                    <>
                      <XCircle size={16} className="text-red-600" />
                      <div className="flex-1">
                        <div className="text-sm text-red-700 font-medium">Ошибка</div>
                        <div className="text-xs text-gray-500">
                          {receipt.error_message || 'Не удалось обработать'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          delete autoCloseTimersRef.current[receipt.id];
                          SupabaseService.deletePendingReceipt(receipt.id).then(loadPendingReceipts);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))}
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
                  {processedProducts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <p>Нет продуктов для отображения</p>
                      <p className="text-sm mt-1">Добавьте чеки, чтобы увидеть продукты</p>
                    </div>
                  ) : (
                    processedProducts
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
                      ))
                  )}
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
                      <div className="flex items-end justify-between gap-2 h-48 border-b border-gray-200 pb-2">
                        {productHistory.map((item, i) => {
                          const data = chartType === 'quantity' ? item.quantity : item.unit_price;
                          const maxValue = chartType === 'quantity' 
                            ? Math.max(...productHistory.map(h => h.quantity))
                            : Math.max(...productHistory.map(h => h.unit_price));
                          const height = (data / maxValue) * 100;
                          
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
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
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        {productHistory.map((item, i) => (
                          <div key={i} className="flex-1 text-center">
                            {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </div>
                        ))}
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
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    const startEditing = (product: typeof processedProducts[0]) => {
      setEditingId(product.id);
      setEditedCalories(product.calories.toString());
    };

    const cancelEditing = () => {
      setEditingId(null);
      setEditedCalories('');
    };

    const saveCalories = async (productId: number) => {
      const newCalories = parseInt(editedCalories);
      if (!isNaN(newCalories) && newCalories >= 0) {
        try {
          await updateProduct(productId, { calories: newCalories });
          setEditingId(null);
          setEditedCalories('');
          
          // Показываем уведомление о пересчете статистики
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        } catch (error) {
          console.error('Ошибка обновления калорий:', error);
        }
      }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Мои продукты</h2>
        
        {/* Уведомление о пересчете статистики */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <div className="font-medium text-green-800">Калорийность обновлена</div>
              <div className="text-sm text-green-600">Статистика автоматически пересчитана</div>
            </div>
          </div>
        )}
        
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Grocery Tracker</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-6 py-6 pb-24">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'upload' && <UploadPage />}
        {activeTab === 'products' && <ProductsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'home' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Home size={22} />
            <span className="text-xs font-medium">Главная</span>
          </button>
          <button 
            onClick={() => setActiveTab('upload')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'upload' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Camera size={22} />
            <span className="text-xs font-medium">Чек</span>
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'products' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <ShoppingCart size={22} />
            <span className="text-xs font-medium">Продукты</span>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
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