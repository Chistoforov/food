import React, { useState } from 'react';
import { Camera, TrendingUp, ShoppingCart, Home, BarChart3, Users, Plus, Clock, AlertCircle, CheckCircle, Calendar, Euro, Edit2, Save, X } from 'lucide-react';

const GroceryTrackerApp = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFamily, setSelectedFamily] = useState('Моя семья');

  // Моковые данные
  const [products, setProducts] = useState([
    { 
      id: 1, 
      name: 'Молоко 2L', 
      lastPurchase: '2024-10-21',
      avgDays: 7,
      predictedEnd: '2024-10-28',
      status: 'ending-soon',
      calories: 1240,
      price: 1.89,
      purchaseCount: 5
    },
    { 
      id: 2, 
      name: 'Хлеб белый', 
      lastPurchase: '2024-10-25',
      avgDays: 3,
      predictedEnd: '2024-10-28',
      status: 'ending-soon',
      calories: 1320,
      price: 1.25,
      purchaseCount: 12
    },
    { 
      id: 3, 
      name: 'Сникерс', 
      lastPurchase: '2024-10-20',
      avgDays: 14,
      predictedEnd: '2024-11-03',
      status: 'ok',
      calories: 250,
      price: 0.89,
      purchaseCount: 4
    },
    { 
      id: 4, 
      name: 'Творог 500г', 
      lastPurchase: '2024-10-27',
      avgDays: null,
      predictedEnd: null,
      status: 'calculating',
      calories: 680,
      price: 2.49,
      purchaseCount: 2
    },
  ]);

  const receipts = [
    { id: 1, date: '2024-10-27', items: 5, total: 23.45, status: 'processed' },
    { id: 2, date: '2024-10-25', items: 8, total: 45.20, status: 'processed' },
    { id: 3, date: '2024-10-21', items: 12, total: 67.89, status: 'processed' },
  ];

  const monthlyStats = {
    totalSpent: 456.78,
    totalCalories: 145600,
    avgCaloriesPerDay: 4700,
    receiptsCount: 15,
    trends: {
      spending: 12, // % изменение
      calories: -8,
      receipts: 5
    },
    highlights: [
      { text: 'Купили на 45% больше молока', trend: 'up', product: 'Молоко 2L' },
      { text: 'Хлеба на 22% меньше чем обычно', trend: 'down', product: 'Хлеб белый' },
      { text: 'Новый продукт: Творог 500г', trend: 'new', product: 'Творог 500г' }
    ]
  };

  const StatusBadge = ({ status }) => {
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
        <h2 className="text-lg font-semibold mb-4">Статистика за октябрь</h2>
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
      </div>

      {/* Список продуктов с напоминаниями */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Мои продукты</h3>
        <div className="space-y-3">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{product.name}</h4>
                  <div className="text-sm text-gray-500 mt-1">
                    Куплено {product.purchaseCount} раз
                  </div>
                </div>
                <StatusBadge status={product.status} />
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-600">
                <div>
                  <div className="text-gray-400">Последняя покупка</div>
                  <div className="font-medium">{new Date(product.lastPurchase).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                </div>
                {product.avgDays ? (
                  <>
                    <div>
                      <div className="text-gray-400">Частота</div>
                      <div className="font-medium">{product.avgDays} дней</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Закончится</div>
                      <div className="font-medium">{new Date(product.predictedEnd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
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
          ))}
        </div>
      </div>
    </div>
  );

  // Страница загрузки чека
  const UploadPage = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Загрузить чек</h2>
      
      <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
        <Camera size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700 mb-2">Сфотографируйте чек</p>
        <p className="text-sm text-gray-500">или выберите фото из галереи</p>
        <button className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
          Выбрать фото
        </button>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Последние чеки</h3>
        <div className="space-y-3">
          {receipts.map(receipt => (
            <div key={receipt.id} className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{new Date(receipt.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                <div className="text-sm text-gray-500">{receipt.items} товаров</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">€{receipt.total.toFixed(2)}</div>
                <div className="text-xs text-green-600">Обработан</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Страница аналитики
  const AnalyticsPage = () => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [dateRange, setDateRange] = useState('month'); // week, month, 3months, all
    const [showProductSelect, setShowProductSelect] = useState(false);
    const [chartType, setChartType] = useState('quantity'); // quantity, price

    // Моковые данные для графика продукта
    const productHistory = {
      1: [ // Молоко
        { date: '2024-09-15', quantity: 1, price: 1.89, unitPrice: 1.89 },
        { date: '2024-09-22', quantity: 1, price: 1.89, unitPrice: 1.89 },
        { date: '2024-09-29', quantity: 2, price: 3.78, unitPrice: 1.89 },
        { date: '2024-10-06', quantity: 1, price: 1.95, unitPrice: 1.95 },
        { date: '2024-10-13', quantity: 1, price: 1.95, unitPrice: 1.95 },
        { date: '2024-10-21', quantity: 1, price: 1.89, unitPrice: 1.89 },
      ],
      2: [ // Хлеб
        { date: '2024-10-02', quantity: 1, price: 1.25, unitPrice: 1.25 },
        { date: '2024-10-05', quantity: 1, price: 1.25, unitPrice: 1.25 },
        { date: '2024-10-09', quantity: 2, price: 2.50, unitPrice: 1.25 },
        { date: '2024-10-12', quantity: 1, price: 1.30, unitPrice: 1.30 },
        { date: '2024-10-16', quantity: 1, price: 1.30, unitPrice: 1.30 },
        { date: '2024-10-19', quantity: 1, price: 1.25, unitPrice: 1.25 },
        { date: '2024-10-22', quantity: 1, price: 1.25, unitPrice: 1.25 },
        { date: '2024-10-25', quantity: 1, price: 1.20, unitPrice: 1.20 },
      ],
      3: [ // Сникерс
        { date: '2024-09-10', quantity: 1, price: 0.89, unitPrice: 0.89 },
        { date: '2024-09-24', quantity: 1, price: 0.89, unitPrice: 0.89 },
        { date: '2024-10-08', quantity: 1, price: 0.95, unitPrice: 0.95 },
        { date: '2024-10-20', quantity: 1, price: 0.95, unitPrice: 0.95 },
      ],
      4: [ // Творог
        { date: '2024-10-15', quantity: 1, price: 2.49, unitPrice: 2.49 },
        { date: '2024-10-27', quantity: 1, price: 2.39, unitPrice: 2.39 },
      ]
    };

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
                  {selectedProduct ? products.find(p => p.id === selectedProduct)?.name : 'Выберите продукт'}
                </span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showProductSelect ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProductSelect && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {products.filter(p => p.purchaseCount >= 3).map(product => (
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
                      {productHistory[selectedProduct]?.length} покупок
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-48 border-b border-gray-200 pb-2">
                    {productHistory[selectedProduct]?.map((item, i) => {
                      const data = chartType === 'quantity' ? item.quantity : item.unitPrice;
                      const maxValue = chartType === 'quantity' 
                        ? Math.max(...productHistory[selectedProduct].map(h => h.quantity))
                        : Math.max(...productHistory[selectedProduct].map(h => h.unitPrice));
                      const height = (data / maxValue) * 100;
                      
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-xs font-semibold text-gray-700">
                            {chartType === 'quantity' ? item.quantity : `€${item.unitPrice.toFixed(2)}`}
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
                    {productHistory[selectedProduct]?.map((item, i) => (
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
                            {productHistory[selectedProduct]?.reduce((sum, item) => sum + item.quantity, 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Потрачено</div>
                          <div className="text-lg font-bold text-gray-900">
                            €{productHistory[selectedProduct]?.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Частота</div>
                          <div className="text-lg font-bold text-gray-900">
                            {products.find(p => p.id === selectedProduct)?.avgDays} дн
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-xs text-gray-500">Средняя цена</div>
                          <div className="text-lg font-bold text-gray-900">
                            €{(productHistory[selectedProduct]?.reduce((sum, item) => sum + item.unitPrice, 0) / productHistory[selectedProduct]?.length).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Изменение</div>
                          <div className={`text-lg font-bold ${
                            (() => {
                              const history = productHistory[selectedProduct];
                              if (!history || history.length < 2) return 'text-gray-900';
                              const firstPrice = history[0].unitPrice;
                              const lastPrice = history[history.length - 1].unitPrice;
                              const change = ((lastPrice - firstPrice) / firstPrice) * 100;
                              return change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-900';
                            })()
                          }`}>
                            {(() => {
                              const history = productHistory[selectedProduct];
                              if (!history || history.length < 2) return '—';
                              const firstPrice = history[0].unitPrice;
                              const lastPrice = history[history.length - 1].unitPrice;
                              const change = ((lastPrice - firstPrice) / firstPrice) * 100;
                              return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Диапазон</div>
                          <div className="text-lg font-bold text-gray-900">
                            €{Math.min(...productHistory[selectedProduct]?.map(h => h.unitPrice)).toFixed(2)} - €{Math.max(...productHistory[selectedProduct]?.map(h => h.unitPrice)).toFixed(2)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
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
            {products.sort((a, b) => b.calories - a.calories).map(product => (
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
        <div className="bg-white rounded-xl p-5 border-2 border-indigo-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-3 rounded-full">
                <Users size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Моя семья</h3>
                <p className="text-sm text-gray-500">2 участника</p>
              </div>
            </div>
            <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-semibold">
              Активна
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Расход за месяц: <span className="font-semibold">€456.78</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 opacity-60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-3 rounded-full">
                <Users size={24} className="text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Родители</h3>
                <p className="text-sm text-gray-500">3 участника</p>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Расход за месяц: <span className="font-semibold">€234.50</span>
          </div>
        </div>
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

    const startEditing = (product: typeof products[0]) => {
      setEditingId(product.id);
      setEditedCalories(product.calories.toString());
    };

    const cancelEditing = () => {
      setEditingId(null);
      setEditedCalories('');
    };

    const saveCalories = (productId: number) => {
      const newCalories = parseInt(editedCalories);
      if (!isNaN(newCalories) && newCalories >= 0) {
        setProducts(prevProducts =>
          prevProducts.map(p =>
            p.id === productId ? { ...p, calories: newCalories } : p
          )
        );
      }
      setEditingId(null);
      setEditedCalories('');
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Мои продукты</h2>
        
        <div className="space-y-3">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
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
          ))}
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <ShoppingCart size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Всего продуктов: {products.length}</h4>
              <div className="text-sm text-gray-600">
                Общая калорийность: {products.reduce((sum, p) => sum + p.calories, 0)} ккал
              </div>
              <div className="text-sm text-gray-600">
                Средняя цена: €{(products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2)}
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