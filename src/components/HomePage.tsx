import React, { useState, useEffect } from 'react';
import { ShoppingCart, Clock, AlertCircle, CheckCircle, Trash2, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Snowflake, Eye, Receipt as ReceiptIcon } from 'lucide-react';
import { SupabaseService } from '../services/supabaseService';
import ConfirmationModal from './ConfirmationModal';
import ReceiptDetailModal from './ReceiptDetailModal';
import { Loader2 } from 'lucide-react';
import { Receipt } from '../lib/supabase';

interface HomePageProps {
  monthlyStats: {
    totalSpent: number;
    receiptsCount: number;
  };
  currentMonth: { month: string, year: number };
  productTypeStats: Record<string, { status: 'ending-soon' | 'ok' | 'calculating', productCount: number }>;
  setProductTypeStats: React.Dispatch<React.SetStateAction<Record<string, { status: 'ending-soon' | 'ok' | 'calculating', productCount: number }>>>;
  familyId: number;
  onNavigateMonth: {
    prev: () => void;
    next: () => void;
    canNext: () => boolean;
  };
  slideDirection: 'left' | 'right';
  statsError: string | null;
  statsLoading: boolean;
  refetchProducts: () => Promise<void>;
  receipts: Receipt[];
  receiptsLoading: boolean;
  hasMoreReceipts: boolean;
  loadMoreReceipts?: (limit: number) => Promise<void>;
  loadingMoreReceipts: boolean;
  onDeleteReceipt: (id: number) => Promise<void>;
  onDateUpdated: () => Promise<void>;
}

const HomePage: React.FC<HomePageProps> = ({
  monthlyStats,
  currentMonth,
  productTypeStats,
  setProductTypeStats,
  familyId,
  onNavigateMonth,
  slideDirection,
  statsError,
  statsLoading,
  refetchProducts,
  receipts,
  receiptsLoading,
  hasMoreReceipts,
  loadMoreReceipts,
  loadingMoreReceipts,
  onDeleteReceipt,
  onDateUpdated
}) => {
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState(false);
  const [virtualPurchaseLoading, setVirtualPurchaseLoading] = useState<string | null>(null);
  const [earlyDepletionLoading, setEarlyDepletionLoading] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [deleteConfirmReceiptId, setDeleteConfirmReceiptId] = useState<number | null>(null);
  const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);

  const handleDeleteReceipt = async (receiptId: number) => {
    try {
      setDeletingReceiptId(receiptId);
      await onDeleteReceipt(receiptId);
      setDeleteConfirmReceiptId(null);
    } catch (error) {
      console.error('❌ Ошибка удаления чека:', error);
      alert('Не удалось удалить чек. Попробуйте ещё раз.');
    } finally {
      setDeletingReceiptId(null);
    }
  };

  // Отслеживаем изменения в productTypeStats
  useEffect(() => {
    console.log('🔄 [STATE CHANGE] productTypeStats обновлен:', productTypeStats);
  }, [productTypeStats]);

  const handleDeleteProductType = async () => {
    if (!deleteTypeConfirm) return;
    
    try {
      setDeletingType(true);
      console.log('🗑️ Удаляем тип продукта:', deleteTypeConfirm);
      
      await SupabaseService.deleteProductType(deleteTypeConfirm, familyId);
      
      // Обновляем статистику типов
      const stats = await SupabaseService.getProductTypeStats(familyId);
      setProductTypeStats(stats);
      
      console.log('✅ Тип продукта успешно удален');
      setDeleteTypeConfirm(null);
    } catch (error) {
      console.error('❌ Ошибка удаления типа продукта:', error);
      alert('Ошибка удаления типа продукта. Попробуйте еще раз.');
    } finally {
      setDeletingType(false);
    }
  };

  const handleVirtualPurchase = async (productType: string) => {
    try {
      setVirtualPurchaseLoading(productType);
      console.log('🔄 Добавляем виртуальную покупку для типа:', productType);
      
      // Добавляем виртуальную покупку для всех продуктов этого типа
      const updatedCount = await SupabaseService.addVirtualPurchaseForType(productType, familyId);
      
      if (updatedCount === 0) {
        console.warn('⚠️ Нет продуктов для этого типа');
        alert('Не найдено продуктов этого типа');
        return;
      }
      
      console.log(`✅ Виртуальные покупки добавлены для ${updatedCount} продуктов`);
      
      // ВАЖНО: Ждем немного, чтобы триггеры БД успели сработать
      console.log('⏳ Ждем завершения обновлений в БД...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ВАЖНО: Явно пересчитываем кэш типов продуктов ПЕРЕД его чтением
      console.log('🔄 Пересчитываем кэш статистики типов продуктов...');
      await SupabaseService.recalculateProductTypeStats(familyId);
      
      // Ждем еще немного после пересчета кэша
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Обновляем список продуктов (чтобы получить новые статусы)
      console.log('🔄 Обновляем список продуктов...');
      await refetchProducts();
      
      // Обновляем статистику типов из пересчитанного кэша
      console.log('🔄 Загружаем обновленную статистику типов...');
      const stats = await SupabaseService.getProductTypeStats(familyId);
      console.log('📊 Новая статистика типов:', stats);
      setProductTypeStats({...stats});
      
      console.log('✅ Продукты и статистика обновлены');
    } catch (error) {
      console.error('❌ Ошибка добавления виртуальной покупки:', error);
      alert('Ошибка обновления. Попробуйте еще раз.');
    } finally {
      setVirtualPurchaseLoading(null);
    }
  };

  const handleEarlyDepletion = async (productType: string) => {
    try {
      setEarlyDepletionLoading(productType);
      console.log('⚠️ Отмечаем продукты типа как досрочно закончившиеся:', productType);
      
      // Отмечаем все продукты этого типа как досрочно закончившиеся
      const updatedCount = await SupabaseService.markTypeAsDepletedEarly(productType, familyId);
      
      if (updatedCount === 0) {
        console.warn('⚠️ Нет продуктов для этого типа');
        alert('Не найдено продуктов этого типа');
        return;
      }
      
      console.log(`✅ ${updatedCount} продуктов отмечены как досрочно закончившиеся`);
      
      // ВАЖНО: Ждем немного, чтобы триггеры БД успели сработать
      console.log('⏳ Ждем завершения обновлений в БД...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ВАЖНО: Явно пересчитываем кэш типов продуктов ПЕРЕД его чтением
      console.log('🔄 Пересчитываем кэш статистики типов продуктов...');
      await SupabaseService.recalculateProductTypeStats(familyId);
      
      // Ждем еще немного после пересчета кэша
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Обновляем список продуктов (чтобы получить новые статусы)
      console.log('🔄 Обновляем список продуктов...');
      await refetchProducts();
      
      // Обновляем статистику типов из пересчитанного кэша
      console.log('🔄 Загружаем обновленную статистику типов...');
      const stats = await SupabaseService.getProductTypeStats(familyId);
      console.log('📊 Новая статистика типов:', stats);
      setProductTypeStats({...stats});
      
      console.log('✅ Продукты и статистика обновлены');
    } catch (error) {
      console.error('❌ Ошибка отметки досрочного окончания:', error);
      alert('Ошибка обновления. Попробуйте еще раз.');
    } finally {
      setEarlyDepletionLoading(null);
    }
  };

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
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          onNavigateMonth.prev();
        } else {
          if (onNavigateMonth.canNext()) {
            onNavigateMonth.next();
          }
        }
      }
      
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
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
        className="relative overflow-hidden bg-gradient-to-br from-[#8B5CF6] via-[#6366F1] to-[#3B82F6] rounded-[36px] p-6 text-white shadow-2xl shadow-indigo-500/30 transition-all duration-500 hover:shadow-indigo-500/40 ring-1 ring-white/20"
        onTouchStart={handleTouchStart}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

        {(() => {
          const monthStr = currentMonth.month.includes('-') 
            ? currentMonth.month.split('-')[1] 
            : currentMonth.month;
          const isDecember = parseInt(monthStr) === 12;
          
          if (!isDecember) return null;

          return (
            <>
              <div className="absolute top-4 right-20 animate-pulse opacity-50 pointer-events-none">
                <Snowflake className="w-6 h-6 text-white" />
              </div>
              <div className="absolute top-12 left-8 animate-pulse opacity-30 pointer-events-none" style={{ animationDelay: '1s' }}>
                <Snowflake className="w-4 h-4 text-white" />
              </div>
              <div className="absolute bottom-8 right-8 animate-pulse opacity-40 pointer-events-none" style={{ animationDelay: '2s' }}>
                <Snowflake className="w-8 h-8 text-white" />
              </div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            </>
          );
        })()}

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideInLeft {
            from { transform: translateX(-20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <div className="relative z-10 flex items-center justify-between mb-8">
          <button
            onClick={onNavigateMonth.prev}
            className="p-3 rounded-2xl bg-white/20 hover:bg-white/30 transition-all active:scale-95 backdrop-blur-md border border-white/10 shadow-lg shadow-black/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="overflow-hidden px-4">
            <h2 
              key={`${currentMonth.year}-${currentMonth.month}`}
              className="text-lg sm:text-xl font-bold tracking-tight drop-shadow-sm"
              style={{ 
                animation: `${slideDirection === 'right' ? 'slideInRight' : 'slideInLeft'} 0.3s ease-out forwards` 
              }}
            >
              {(() => {
                const monthStr = currentMonth.month.includes('-') 
                  ? currentMonth.month.split('-')[1] 
                  : currentMonth.month;
                const monthName = new Date(currentMonth.year, parseInt(monthStr) - 1).toLocaleString('ru', { month: 'long' });
                return `${monthName} ${currentMonth.year}`;
              })()}
            </h2>
          </div>
          
          <button
            onClick={onNavigateMonth.next}
            disabled={!onNavigateMonth.canNext()}
            className={`p-3 rounded-2xl transition-all active:scale-95 backdrop-blur-md border border-white/10 shadow-lg shadow-black/5 ${
              onNavigateMonth.canNext()
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
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
        ) : (
          <div className="relative z-10">
            {statsLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] rounded-2xl z-20 transition-all duration-300">
                <Loader2 className="animate-spin text-white drop-shadow-md" size={32} />
              </div>
            )}
            
            <div className={`transition-opacity duration-300 ${statsLoading ? 'opacity-80' : 'opacity-100'}`}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2">
                <div className="bg-white/10 rounded-3xl p-4 sm:p-5 backdrop-blur-md border border-white/10 shadow-lg shadow-black/5 transition-all duration-300 hover:bg-white/15 hover:scale-[1.02] group">
                  <div className="flex flex-col items-start">
                    <div className="p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors mb-2">
                      <ShoppingCart size={20} className="text-white/90" />
                    </div>
                    <div className="text-sm text-white/80 font-medium mb-0.5">Потрачено</div>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                      €{monthlyStats.totalSpent.toFixed(0)}
                      <span className="text-base sm:text-lg text-white/60 font-medium">.{monthlyStats.totalSpent.toFixed(2).split('.')[1]}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 rounded-3xl p-4 sm:p-5 backdrop-blur-md border border-white/10 shadow-lg shadow-black/5 transition-all duration-300 hover:bg-white/15 hover:scale-[1.02] group">
                  <div className="flex flex-col items-start">
                    <div className="p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors mb-2">
                      <CheckCircle size={20} className="text-white/90" />
                    </div>
                    <div className="text-sm text-white/80 font-medium mb-0.5">Чеков</div>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                      {monthlyStats.receiptsCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedReceiptId && (
        <ReceiptDetailModal
          receiptId={selectedReceiptId}
          familyId={familyId}
          receipts={receipts}
          onClose={() => setSelectedReceiptId(null)}
          onDateUpdated={onDateUpdated}
        />
      )}

      {Object.keys(productTypeStats).length > 0 && (() => {
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
            <div className="flex flex-col gap-3">
              {sortedTypes.map(([type, typeData], index) => {
                const typeStatus = typeData.status;
                const isLoading = virtualPurchaseLoading === type;
                
                let cardStyle = "bg-white border-slate-100 shadow-sm hover:shadow-md";
                let iconBg = "bg-slate-100 text-slate-500";
                let statusColor = "text-slate-500";
                
                if (typeStatus === 'ending-soon') {
                  cardStyle = "bg-white border-rose-100 shadow-[0_8px_20px_-6px_rgba(244,63,94,0.15)] hover:shadow-[0_12px_24px_-6px_rgba(244,63,94,0.2)] hover:-translate-y-1 ring-1 ring-rose-50";
                  iconBg = "bg-white border-2 border-rose-500 text-rose-500 shadow-sm";
                  statusColor = "text-rose-600 bg-rose-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-rose-100 inline-block mt-0 sm:mt-1";
                } else if (typeStatus === 'ok') {
                  cardStyle = "bg-white border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5";
                  iconBg = "bg-white border-2 border-emerald-500 text-emerald-500 shadow-sm";
                  statusColor = "text-emerald-600 bg-emerald-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-emerald-100 inline-block mt-0 sm:mt-1";
                } else if (typeStatus === 'calculating') {
                   cardStyle = "bg-white border-amber-100 shadow-sm hover:shadow-md hover:border-amber-200 hover:-translate-y-0.5";
                   iconBg = "bg-white border-2 border-amber-500 text-amber-500 shadow-sm";
                   statusColor = "text-amber-600 bg-amber-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-amber-100 inline-block mt-0 sm:mt-1";
                }
                
                return (
                  <div 
                    key={type} 
                    className={`group relative rounded-[20px] p-2.5 sm:p-3 border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${cardStyle}`}
                    style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 sm:p-3 rounded-2xl flex-shrink-0 ${iconBg} transition-colors`}>
                        {typeStatus === 'ending-soon' ? <AlertCircle size={24} /> : 
                         typeStatus === 'ok' ? <CheckCircle size={24} /> : 
                         <Clock size={24} />}
                      </div>

                      <div className="flex-1 min-w-0 py-0.5 sm:py-1">
                        <h4 className="font-bold text-surface-900 capitalize text-base sm:text-lg leading-tight truncate pr-1 sm:pr-2">{type}</h4>
                        <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${statusColor} mt-0.5`}>
                          {typeStatus === 'ending-soon' && 'Заканчивается'}
                          {typeStatus === 'ok' && 'В наличии'}
                          {typeStatus === 'calculating' && 'Расчет...'}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {typeStatus === 'ok' && (
                           <button
                             onClick={() => handleEarlyDepletion(type)}
                             disabled={earlyDepletionLoading === type}
                             className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
                           >
                             <AlertTriangle size={16} />
                             <span className="hidden sm:inline">Кончилось</span>
                           </button>
                        )}
                        
                        {typeStatus === 'ending-soon' && (
                          <button
                            onClick={() => handleVirtualPurchase(type)}
                            disabled={isLoading}
                            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                          >
                             <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} strokeWidth={2.5} />
                             <span className="hidden sm:inline">В наличии</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTypeConfirm(type);
                      }}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-surface-100 p-1.5 rounded-full text-surface-400 hover:text-red-500 hover:bg-red-50 transition-all z-10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Чеки */}
      <div className="animate-fadeIn" style={{animationDelay: '0.2s'}}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xl font-bold text-surface-900">Чеки</h3>
          {receipts.length > 0 && (
            <span className="text-xs font-bold bg-surface-100 text-surface-500 px-2 py-1 rounded-lg">{receipts.length}</span>
          )}
        </div>

        <div className="space-y-3">
          {receiptsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-surface-400" size={24} />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12 text-surface-400 bg-surface-50 rounded-[24px] border border-dashed border-surface-200">
              <ReceiptIcon size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Пока нет чеков</p>
            </div>
          ) : (
            receipts.map((receipt, index) => (
              <div
                key={receipt.id}
                className="bg-white rounded-[24px] p-5 border border-surface-100 hover:shadow-lg hover:border-surface-200 transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {deleteConfirmReceiptId === receipt.id ? (
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
                        onClick={() => setDeleteConfirmReceiptId(null)}
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
                      <div className="font-bold text-surface-900 text-lg mb-0.5">
                        {new Date(receipt.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                      </div>
                      <div className="text-sm text-surface-500 font-medium">{receipt.items_count} товаров</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-primary-600 text-lg">€{Number(receipt.total_amount || 0).toFixed(2)}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedReceiptId(receipt.id)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmReceiptId(receipt.id)}
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

        {!receiptsLoading && hasMoreReceipts && receipts.length > 0 && loadMoreReceipts && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => loadMoreReceipts(20)}
              disabled={loadingMoreReceipts}
              className="px-8 py-3 rounded-2xl font-bold bg-white border border-surface-200 text-surface-900 shadow-sm hover:bg-surface-50 transition-all active:scale-95"
            >
              {loadingMoreReceipts ? <Loader2 className="animate-spin" /> : 'Показать ещё'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

