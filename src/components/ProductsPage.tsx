import React, { useState } from 'react';
import { Loader2, RefreshCw, CheckCircle, Save, X, Edit2 } from 'lucide-react';
import { clearAppCache } from '../utils/cacheHelper';
import { SupabaseService } from '../services/supabaseService';

interface ProcessedProduct {
  id: number;
  name: string;
  originalName?: string;
  product_type?: string;
  lastPurchase: string;
  avgDays: number | null;
  predictedEnd: string | null;
  status: 'ending-soon' | 'ok' | 'calculating';
  calories: number;
  price: number;
  purchaseCount: number;
}

interface ProductsPageProps {
  products: ProcessedProduct[];
  loading: boolean;
  hasMore: boolean;
  loadMore?: (limit: number) => Promise<void>;
  loadingMore: boolean;
  updateProduct: (id: number, updates: any) => Promise<any>;
  familyId: number;
}

const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  loading,
  hasMore,
  loadMore,
  loadingMore,
  updateProduct,
  familyId
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedCalories, setEditedCalories] = useState<string>('');
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editedProductType, setEditedProductType] = useState<string>('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isClearingCache, setIsClearingCache] = useState(false);

  const startEditing = (product: ProcessedProduct) => {
    setEditingId(product.id);
    setEditedCalories(product.calories.toString());
  };

  const startEditingType = (product: ProcessedProduct) => {
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
      await SupabaseService.updateProductStats(productId, familyId);
      
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

      // Используем общую функцию очистки кэша
      // true - сохраняем авторизацию (чтобы не разлогинивало)
      await clearAppCache(familyId, true);

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
        {loading ? (
           <div className="flex flex-col items-center justify-center py-12 gap-3">
             <Loader2 className="animate-spin text-surface-400" size={32} />
             <span className="text-surface-400 font-medium">Загрузка продуктов...</span>
           </div>
        ) : (
          products.map((product, index) => (
            <div 
              key={product.id} 
              className="bg-white rounded-[24px] p-4 sm:p-5 shadow-sm border border-surface-100 hover:shadow-md transition-all duration-300"
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
      
      {!loading && hasMore && products.length > 0 && loadMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => loadMore(20)}
            disabled={loadingMore}
            className="px-8 py-3 rounded-2xl font-semibold bg-white border border-surface-200 text-surface-900 shadow-sm hover:bg-surface-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="animate-spin" /> : 'Загрузить еще'}
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-primary-900 to-surface-900 rounded-[24px] p-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
            <React.Fragment>
                {/* ShoppingCart icon from parent */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-300"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            </React.Fragment>
          </div>
          <div>
            <div className="text-surface-300 text-sm font-medium mb-1">Итого в списке</div>
            <div className="text-2xl font-bold">{products.length} <span className="text-base font-normal text-surface-400">товаров</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;

