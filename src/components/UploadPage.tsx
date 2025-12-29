import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, XCircle, X, CheckCircle, Eye, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { SupabaseService } from '../services/supabaseService';
import ReceiptDetailModal from './ReceiptDetailModal';
import { Receipt } from '../lib/supabase';

interface UploadPageProps {
  familyId: number;
  userId?: string;
  receipts: Receipt[];
  receiptsLoading: boolean;
  hasMoreReceipts: boolean;
  loadMoreReceipts?: (limit: number) => Promise<void>;
  loadingMoreReceipts: boolean;
  onDeleteReceipt: (id: number) => Promise<void>;
  onDateUpdated: () => Promise<void>;
}

const UploadPage = ({
  familyId,
  userId,
  receipts,
  receiptsLoading,
  hasMoreReceipts,
  loadMoreReceipts,
  loadingMoreReceipts,
  onDeleteReceipt,
  onDateUpdated
}: UploadPageProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSuccessClosing, setUploadSuccessClosing] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Process receipts for display
  const processedReceipts = receipts.map(receipt => ({
    id: receipt.id,
    date: receipt.date,
    items: receipt.items_count,
    total: receipt.total_amount,
    status: receipt.status
  }));

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
        familyId,
        file,
        userId
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
      
      await onDeleteReceipt(receiptId);
      
      console.log('✅ Чек успешно удален');
      setDeleteConfirmId(null);
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
    await onDateUpdated();
  };

  return (
    <>
      {/* Receipt Detail Modal */}
      {selectedReceiptId && (
        <ReceiptDetailModal
          receiptId={selectedReceiptId}
          familyId={familyId}
          receipts={receipts}
          onClose={() => setSelectedReceiptId(null)}
          onDateUpdated={handleDateUpdated}
        />
      )}

      <div className="space-y-8 animate-fadeIn">
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
    </>
  );
};

export default UploadPage;

