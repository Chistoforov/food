import { useState, useRef } from 'react';
import { Camera, ShoppingCart, Home, BarChart3, Users, Plus, Clock, AlertCircle, CheckCircle, Edit2, Save, X, Upload, Loader2, XCircle } from 'lucide-react';
import { useProducts, useReceipts, useFamilies, useProductHistory, useMonthlyStats } from './hooks/useSupabaseData';
import { parseReceiptImage, ReceiptItem } from './services/perplexityService';
import { SupabaseService } from './services/supabaseService';

const GroceryTrackerApp = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFamilyId] = useState<number>(1);

  // Получаем данные из Supabase
  const { families, loading: familiesLoading } = useFamilies();
  const { products, loading: productsLoading, updateProduct } = useProducts(selectedFamilyId);
  const { receipts, loading: receiptsLoading } = useReceipts(selectedFamilyId);
  const { stats: monthlyStatsData, loading: statsLoading, recalculateStats, error: statsError } = useMonthlyStats(selectedFamilyId);

  // Находим выбранную семью
  const selectedFamily = families.find(f => f.id === selectedFamilyId)?.name || 'Моя семья';

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

  const monthlyStats = monthlyStatsData[0] ? {
    totalSpent: monthlyStatsData[0].total_spent,
    totalCalories: monthlyStatsData[0].total_calories,
    avgCaloriesPerDay: monthlyStatsData[0].avg_calories_per_day,
    receiptsCount: monthlyStatsData[0].receipts_count,
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
  const HomePage = () => (
    <div className="space-y-6">
      {/* Статистика за месяц */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Статистика за октябрь</h2>
          <button
            onClick={async () => {
              try {
                await recalculateStats();
              } catch (error) {
                console.error('Ошибка пересчета статистики:', error);
              }
            }}
            disabled={statsLoading}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              statsLoading 
                ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
            title="Пересчитать статистику"
          >
            {statsLoading ? 'Обновление...' : 'Обновить'}
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
                  <StatusBadge status={product.status} />
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Страница загрузки чека
  const UploadPage = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [parsedItems, setParsedItems] = useState<ReceiptItem[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
      setParsedItems(null);

      try {
        // Parse receipt using Perplexity AI
        const parsedReceipt = await parseReceiptImage(file);
        
        // Process receipt and save to database
        await SupabaseService.processReceipt(
          selectedFamilyId,
          parsedReceipt.items,
          parsedReceipt.total,
          parsedReceipt.date || new Date().toISOString().split('T')[0]
        );

        setParsedItems(parsedReceipt.items);
        setUploadSuccess(true);
        
        // Show success message for 3 seconds
        setTimeout(() => {
          setUploadSuccess(false);
          setParsedItems(null);
        }, 5000);

      } catch (error) {
        console.error('Error processing receipt:', error);
        setUploadError(
          error instanceof Error 
            ? `Ошибка обработки чека: ${error.message}` 
            : 'Не удалось обработать чек. Попробуйте еще раз.'
        );
      } finally {
        setIsProcessing(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    const triggerFileInput = () => {
      fileInputRef.current?.click();
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Загрузить чек</h2>
        
        {/* Success Message */}
        {uploadSuccess && parsedItems && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="font-semibold text-green-900 mb-1">Чек успешно обработан!</div>
                <div className="text-sm text-green-700 mb-2">Добавлено {parsedItems.length} товаров:</div>
                <div className="space-y-2">
                  {parsedItems.map((item, idx) => (
                    <div key={idx} className="text-xs text-green-800">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[10px] text-green-600 opacity-75 mb-0.5">{item.originalName}</div>
                      <div>{item.quantity} {item.unit} - €{item.price.toFixed(2)} ({item.calories} ккал)</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <XCircle size={24} className="text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-red-900 mb-1">Ошибка</div>
                <div className="text-sm text-red-700">{uploadError}</div>
              </div>
              <button 
                onClick={() => setUploadError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div 
          onClick={!isProcessing ? triggerFileInput : undefined}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isProcessing 
              ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed' 
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
          
          {isProcessing ? (
            <>
              <Loader2 size={48} className="mx-auto text-indigo-600 mb-4 animate-spin" />
              <p className="text-lg font-semibold text-gray-700 mb-2">Обрабатываем чек...</p>
              <p className="text-sm text-gray-500">Это может занять несколько секунд</p>
            </>
          ) : (
            <>
              <Camera size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-semibold text-gray-700 mb-2">Сфотографируйте чек</p>
              <p className="text-sm text-gray-500 mb-4">или выберите фото из галереи</p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Camera size={20} />
                  Камера
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
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
                <div key={receipt.id} className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="font-semibold text-gray-900">{new Date(receipt.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                    <div className="text-sm text-gray-500">{receipt.items} товаров</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">€{receipt.total.toFixed(2)}</div>
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={12} />
                      Обработан
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
                  {processedProducts.filter(p => p.purchaseCount >= 3).map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product.id);
                        setShowProductSelect(false);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.purchaseCount} покупок</div>
                    </button>
                  ))}
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

  // Страница семей
  const FamiliesPage = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Семьи</h2>
        <button className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus size={24} />
        </button>
      </div>

      <div className="space-y-3">
        {familiesLoading ? (
          <div className="text-center py-8 text-gray-500">Загрузка семей...</div>
        ) : (
          families.map(family => (
            <div key={family.id} className={`bg-white rounded-xl p-5 border-2 ${family.is_active ? 'border-indigo-500' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${family.is_active ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <Users size={24} className={family.is_active ? 'text-indigo-600' : 'text-gray-400'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{family.name}</h3>
                    <p className="text-sm text-gray-500">{family.member_count} участника</p>
                  </div>
                </div>
                {family.is_active && (
                  <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-semibold">
                    Активна
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Расход за месяц: <span className="font-semibold">€{monthlyStats.totalSpent.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
        <Plus size={20} />
        Создать новую семью
      </button>
    </div>
  );

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
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Grocery Tracker</h1>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-sm">
            <Users size={16} className="text-gray-600" />
            <span className="font-medium text-gray-700">{selectedFamily}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-6 py-6 pb-24">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'upload' && <UploadPage />}
        {activeTab === 'products' && <ProductsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'families' && <FamiliesPage />}
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
          <button 
            onClick={() => setActiveTab('families')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'families' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Users size={22} />
            <span className="text-xs font-medium">Семьи</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroceryTrackerApp;